package main

import (
	"context"
	"fmt"
	"net/http"
	"regexp"
	"strings"
	"unicode/utf8"

	"github.com/jackc/pgx/v5"
)

func (a *App) listCatalog(w http.ResponseWriter, r *http.Request) error {
	rows, err := a.db.Query(r.Context(), "SELECT id,kind,name,color,position,archived,section FROM catalog WHERE user_id=$1 ORDER BY kind,position,id", userID(r.Context()))
	if err != nil {
		return err
	}
	defer rows.Close()
	result := []Catalog{}
	for rows.Next() {
		var c Catalog
		if err = rows.Scan(&c.ID, &c.Kind, &c.Name, &c.Color, &c.Position, &c.Archived, &c.Section); err != nil {
			return err
		}
		result = append(result, c)
	}
	if err = rows.Err(); err != nil {
		return err
	}
	return respond(w, 200, result)
}

var hexColor = regexp.MustCompile(`^#[0-9a-fA-F]{6}$`)

func (a *App) saveCatalog(w http.ResponseWriter, r *http.Request) error {
	var c Catalog
	if err := decode(w, r, &c); err != nil {
		return err
	}
	c.Name = strings.TrimSpace(c.Name)
	if c.Section != "" && c.Section != "medznat" && c.Section != "onpoint" && c.Section != "medpoint" && c.Section != "special" {
		return invalid("Выберите раздел задач")
	}
	if c.Kind != "platform" && c.Kind != "specialty" && c.Kind != "status" {
		return invalid("Выберите тип справочника")
	}
	if c.Name == "" || utf8.RuneCountInString(c.Name) > 150 {
		return invalid("Название должно содержать от 1 до 150 символов")
	}
	if c.Color == "" {
		c.Color = "#aac4d6"
	}
	if !hexColor.MatchString(c.Color) {
		return invalid("Некорректный цвет")
	}
	if c.Position < 0 || c.Position > 1000000 {
		return invalid("Порядок должен быть от 0 до 1000000")
	}
	ctx := r.Context()
	tx, err := a.db.Begin(ctx)
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
		c.ID, err = pathID(r)
		if err != nil {
			return err
		}
		var ownedID int64
		if err = tx.QueryRow(ctx, "SELECT id FROM catalog WHERE id=$1 AND user_id=$2 FOR UPDATE", c.ID, userID(ctx)).Scan(&ownedID); err != nil {
			return err
		}
	}
	if err = tx.QueryRow(ctx, "SELECT EXISTS(SELECT 1 FROM catalog WHERE kind=$1 AND lower(btrim(name))=lower($2) AND id<>$3 AND user_id=$4)", c.Kind, c.Name, c.ID, userID(ctx)).Scan(&duplicate); err != nil {
		return err
	}
	if duplicate {
		return &apiError{409, "Такое название уже существует, в том числе в архиве"}
	}
	if r.Method == "POST" {
		if c.Section == "" {
			c.Section = "special"
		}
		if err = tx.QueryRow(ctx, "SELECT coalesce(max(position),-1)+1 FROM catalog WHERE kind=$1 AND user_id=$2", c.Kind, userID(ctx)).Scan(&c.Position); err != nil {
			return err
		}
		err = tx.QueryRow(ctx, "INSERT INTO catalog(kind,name,color,position,archived,section,user_id) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING id", c.Kind, c.Name, c.Color, c.Position, c.Archived, c.Section, userID(ctx)).Scan(&c.ID)
	} else {
		var oldKind string
		var oldPosition int
		var oldSection string
		if err = tx.QueryRow(ctx, "SELECT kind,position,section FROM catalog WHERE id=$1 AND user_id=$2 FOR UPDATE", c.ID, userID(ctx)).Scan(&oldKind, &oldPosition, &oldSection); err != nil {
			return err
		}
		if oldKind != c.Kind {
			return invalid("Нельзя менять тип существующего значения")
		}
		if c.Section == "" {
			c.Section = oldSection
		}
		if c.Position < oldPosition {
			_, err = tx.Exec(ctx, "UPDATE catalog SET position=position+1 WHERE kind=$1 AND id<>$2 AND position >= $3 AND position < $4 AND user_id=$5", c.Kind, c.ID, c.Position, oldPosition, userID(ctx))
		} else if c.Position > oldPosition {
			_, err = tx.Exec(ctx, "UPDATE catalog SET position=position-1 WHERE kind=$1 AND id<>$2 AND position > $3 AND position <= $4 AND user_id=$5", c.Kind, c.ID, oldPosition, c.Position, userID(ctx))
		}
		if err != nil {
			return err
		}
		_, err = tx.Exec(ctx, "UPDATE catalog SET name=$2,color=$3,position=$4,archived=$5,section=$6 WHERE id=$1 AND user_id=$7", c.ID, c.Name, c.Color, c.Position, c.Archived, c.Section, userID(ctx))
	}
	if err != nil {
		return err
	}
	if err = tx.Commit(ctx); err != nil {
		return err
	}
	return respond(w, 200, c)
}

func validateReference(ctx context.Context, tx pgx.Tx, id *int64, kind string, oldID *int64, required bool) error {
	if id == nil {
		if required {
			return invalid("Укажите площадку")
		}
		return nil
	}
	var actualKind string
	var archived bool
	err := tx.QueryRow(ctx, "SELECT kind,archived FROM catalog WHERE id=$1 AND user_id=$2 FOR SHARE", *id, userID(ctx)).Scan(&actualKind, &archived)
	if err == pgx.ErrNoRows {
		return invalid("Значение справочника не найдено")
	}
	if err != nil {
		return err
	}
	if actualKind != kind {
		return invalid("Значение относится к другому справочнику")
	}
	if archived && (oldID == nil || *oldID != *id) {
		return invalid(fmt.Sprintf("Значение справочника «%s» архивировано", kind))
	}
	return nil
}
