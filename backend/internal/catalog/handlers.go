package catalog

import (
	"context"
	"fmt"
	"net/http"
	"regexp"
	"strings"
	"unicode/utf8"

	"deadline-tracker/internal/auth"
	"deadline-tracker/internal/domain"
	"deadline-tracker/internal/httpx"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type Handler struct{ DB *pgxpool.Pool }

func (a *Handler) List(w http.ResponseWriter, r *http.Request) error {
	rows, err := a.DB.Query(r.Context(), "SELECT id,kind,name,color,position,archived,section FROM catalog WHERE user_id=$1 ORDER BY kind,position,id", auth.UserID(r.Context()))
	if err != nil {
		return err
	}
	defer rows.Close()
	result := []domain.Catalog{}
	for rows.Next() {
		var c domain.Catalog
		if err = rows.Scan(&c.ID, &c.Kind, &c.Name, &c.Color, &c.Position, &c.Archived, &c.Section); err != nil {
			return err
		}
		result = append(result, c)
	}
	if err = rows.Err(); err != nil {
		return err
	}
	return httpx.Respond(w, 200, result)
}

var hexColor = regexp.MustCompile(`^#[0-9a-fA-F]{6}$`)

func (a *Handler) Save(w http.ResponseWriter, r *http.Request) error {
	var c domain.Catalog
	if err := httpx.Decode(w, r, &c); err != nil {
		return err
	}
	c.Name = strings.TrimSpace(c.Name)
	if c.Section != "" && c.Section != "medznat" && c.Section != "onpoint" && c.Section != "medpoint" && c.Section != "special" {
		return httpx.Invalid("Выберите раздел задач")
	}
	if c.Kind != "platform" && c.Kind != "specialty" && c.Kind != "status" {
		return httpx.Invalid("Выберите тип справочника")
	}
	if c.Name == "" || utf8.RuneCountInString(c.Name) > 150 {
		return httpx.Invalid("Название должно содержать от 1 до 150 символов")
	}
	if c.Color == "" {
		c.Color = "#aac4d6"
	}
	if !hexColor.MatchString(c.Color) {
		return httpx.Invalid("Некорректный цвет")
	}
	if c.Position < 0 || c.Position > 1000000 {
		return httpx.Invalid("Порядок должен быть от 0 до 1000000")
	}
	ctx := r.Context()
	tx, err := a.DB.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)
	// Serializes ordering and name uniqueness checks across all dictionary writes.
	if _, err = tx.Exec(ctx, "SELECT pg_advisory_xact_lock(71248902)"); err != nil {
		return err
	}
	var duplicate bool
	if r.Method == "PUT" {
		c.ID, err = httpx.PathID(r)
		if err != nil {
			return err
		}
		var ownedID int64
		if err = tx.QueryRow(ctx, "SELECT id FROM catalog WHERE id=$1 AND user_id=$2 FOR UPDATE", c.ID, auth.UserID(ctx)).Scan(&ownedID); err != nil {
			return err
		}
	}
	if err = tx.QueryRow(ctx, "SELECT EXISTS(SELECT 1 FROM catalog WHERE kind=$1 AND lower(btrim(name))=lower($2) AND id<>$3 AND user_id=$4)", c.Kind, c.Name, c.ID, auth.UserID(ctx)).Scan(&duplicate); err != nil {
		return err
	}
	if duplicate {
		return &httpx.Error{Code: 409, Message: "Такое название уже существует, в том числе в архиве"}
	}
	if r.Method == "POST" {
		if c.Section == "" {
			c.Section = "special"
		}
		if err = tx.QueryRow(ctx, "SELECT coalesce(max(position),-1)+1 FROM catalog WHERE kind=$1 AND user_id=$2", c.Kind, auth.UserID(ctx)).Scan(&c.Position); err != nil {
			return err
		}
		err = tx.QueryRow(ctx, "INSERT INTO catalog(kind,name,color,position,archived,section,user_id) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING id", c.Kind, c.Name, c.Color, c.Position, c.Archived, c.Section, auth.UserID(ctx)).Scan(&c.ID)
	} else {
		var oldKind string
		var oldPosition int
		var oldSection string
		if err = tx.QueryRow(ctx, "SELECT kind,position,section FROM catalog WHERE id=$1 AND user_id=$2 FOR UPDATE", c.ID, auth.UserID(ctx)).Scan(&oldKind, &oldPosition, &oldSection); err != nil {
			return err
		}
		if oldKind != c.Kind {
			return httpx.Invalid("Нельзя менять тип существующего значения")
		}
		if c.Section == "" {
			c.Section = oldSection
		}
		if c.Position < oldPosition {
			_, err = tx.Exec(ctx, "UPDATE catalog SET position=position+1 WHERE kind=$1 AND id<>$2 AND position >= $3 AND position < $4 AND user_id=$5", c.Kind, c.ID, c.Position, oldPosition, auth.UserID(ctx))
		} else if c.Position > oldPosition {
			_, err = tx.Exec(ctx, "UPDATE catalog SET position=position-1 WHERE kind=$1 AND id<>$2 AND position > $3 AND position <= $4 AND user_id=$5", c.Kind, c.ID, oldPosition, c.Position, auth.UserID(ctx))
		}
		if err != nil {
			return err
		}
		_, err = tx.Exec(ctx, "UPDATE catalog SET name=$2,color=$3,position=$4,archived=$5,section=$6 WHERE id=$1 AND user_id=$7", c.ID, c.Name, c.Color, c.Position, c.Archived, c.Section, auth.UserID(ctx))
	}
	if err != nil {
		return err
	}
	if err = tx.Commit(ctx); err != nil {
		return err
	}
	return httpx.Respond(w, 200, c)
}

func ValidateReference(ctx context.Context, tx pgx.Tx, id *int64, kind string, oldID *int64, required bool) error {
	if id == nil {
		if required {
			return httpx.Invalid("Укажите площадку")
		}
		return nil
	}
	var actualKind string
	var archived bool
	err := tx.QueryRow(ctx, "SELECT kind,archived FROM catalog WHERE id=$1 AND user_id=$2 FOR SHARE", *id, auth.UserID(ctx)).Scan(&actualKind, &archived)
	if err == pgx.ErrNoRows {
		return httpx.Invalid("Значение справочника не найдено")
	}
	if err != nil {
		return err
	}
	if actualKind != kind {
		return httpx.Invalid("Значение относится к другому справочнику")
	}
	if archived && (oldID == nil || *oldID != *id) {
		return httpx.Invalid(fmt.Sprintf("Значение справочника «%s» архивировано", kind))
	}
	return nil
}
