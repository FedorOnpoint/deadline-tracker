package admin

import (
	"net/http"
	"strings"
	"time"

	"deadline-tracker/internal/auth"
	"deadline-tracker/internal/httpx"
	"deadline-tracker/internal/security"

	"github.com/jackc/pgx/v5/pgxpool"
)

type Handler struct{ DB *pgxpool.Pool }

type Invitation struct {
	ID        int64      `json:"id"`
	Code      string     `json:"code,omitempty"`
	CreatedAt time.Time  `json:"created_at"`
	ExpiresAt time.Time  `json:"expires_at"`
	UsedAt    *time.Time `json:"used_at"`
	UsedBy    string     `json:"used_by"`
	Revoked   bool       `json:"revoked"`
}

func (a *Handler) CreateInvitation(w http.ResponseWriter, r *http.Request) error {
	token, err := security.RandomToken(16)
	if err != nil {
		return err
	}
	token = strings.ToUpper(token)
	var invitation Invitation
	if err = a.DB.QueryRow(r.Context(), "INSERT INTO invitations(code_hash,created_by) VALUES($1,$2) RETURNING id,created_at,expires_at", security.Digest(token), auth.UserID(r.Context())).Scan(&invitation.ID, &invitation.CreatedAt, &invitation.ExpiresAt); err != nil {
		return err
	}
	invitation.Code = token[:8] + "-" + token[8:16] + "-" + token[16:24] + "-" + token[24:]
	return httpx.Respond(w, 201, invitation)
}
func (a *Handler) ListInvitations(w http.ResponseWriter, r *http.Request) error {
	rows, err := a.DB.Query(r.Context(), `SELECT i.id,i.created_at,i.expires_at,i.used_at,coalesce(u.name,''),i.revoked FROM invitations i LEFT JOIN users u ON u.id=i.used_by ORDER BY i.id DESC LIMIT 200`)
	if err != nil {
		return err
	}
	defer rows.Close()
	result := []Invitation{}
	for rows.Next() {
		var i Invitation
		if err = rows.Scan(&i.ID, &i.CreatedAt, &i.ExpiresAt, &i.UsedAt, &i.UsedBy, &i.Revoked); err != nil {
			return err
		}
		result = append(result, i)
	}
	if err = rows.Err(); err != nil {
		return err
	}
	return httpx.Respond(w, 200, result)
}
func (a *Handler) RevokeInvitation(w http.ResponseWriter, r *http.Request) error {
	id, err := httpx.PathID(r)
	if err != nil {
		return err
	}
	result, err := a.DB.Exec(r.Context(), "UPDATE invitations SET revoked=true WHERE id=$1 AND used_by IS NULL", id)
	if err != nil {
		return err
	}
	if result.RowsAffected() == 0 {
		return &httpx.Error{Code: 404, Message: "Приглашение не найдено или уже использовано"}
	}
	return httpx.Respond(w, 200, map[string]bool{"ok": true})
}
func (a *Handler) ListUsers(w http.ResponseWriter, r *http.Request) error {
	rows, err := a.DB.Query(r.Context(), "SELECT id,login,name,role,disabled,created_at FROM users ORDER BY id")
	if err != nil {
		return err
	}
	defer rows.Close()
	users := []auth.User{}
	for rows.Next() {
		var u auth.User
		if err = rows.Scan(&u.ID, &u.Login, &u.Name, &u.Role, &u.Disabled, &u.CreatedAt); err != nil {
			return err
		}
		users = append(users, u)
	}
	if err = rows.Err(); err != nil {
		return err
	}
	return httpx.Respond(w, 200, users)
}
