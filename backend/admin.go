package main

import (
	"net/http"
	"strings"
	"time"
)

type Invitation struct {
	ID        int64      `json:"id"`
	Code      string     `json:"code,omitempty"`
	CreatedAt time.Time  `json:"created_at"`
	ExpiresAt time.Time  `json:"expires_at"`
	UsedAt    *time.Time `json:"used_at"`
	UsedBy    string     `json:"used_by"`
	Revoked   bool       `json:"revoked"`
}

func (a *App) createInvitation(w http.ResponseWriter, r *http.Request) error {
	token, err := randomToken(16)
	if err != nil {
		return err
	}
	token = strings.ToUpper(token)
	var invitation Invitation
	if err = a.db.QueryRow(r.Context(), "INSERT INTO invitations(code_hash,created_by) VALUES($1,$2) RETURNING id,created_at,expires_at", digest(token), userID(r.Context())).Scan(&invitation.ID, &invitation.CreatedAt, &invitation.ExpiresAt); err != nil {
		return err
	}
	invitation.Code = token[:8] + "-" + token[8:16] + "-" + token[16:24] + "-" + token[24:]
	return respond(w, 201, invitation)
}
func (a *App) listInvitations(w http.ResponseWriter, r *http.Request) error {
	rows, err := a.db.Query(r.Context(), `SELECT i.id,i.created_at,i.expires_at,i.used_at,coalesce(u.name,''),i.revoked FROM invitations i LEFT JOIN users u ON u.id=i.used_by ORDER BY i.id DESC LIMIT 200`)
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
	return respond(w, 200, result)
}
func (a *App) revokeInvitation(w http.ResponseWriter, r *http.Request) error {
	id, err := pathID(r)
	if err != nil {
		return err
	}
	result, err := a.db.Exec(r.Context(), "UPDATE invitations SET revoked=true WHERE id=$1 AND used_by IS NULL", id)
	if err != nil {
		return err
	}
	if result.RowsAffected() == 0 {
		return &apiError{404, "Приглашение не найдено или уже использовано"}
	}
	return respond(w, 200, map[string]bool{"ok": true})
}
func (a *App) listUsers(w http.ResponseWriter, r *http.Request) error {
	rows, err := a.db.Query(r.Context(), "SELECT id,login,name,role,disabled,created_at FROM users ORDER BY id")
	if err != nil {
		return err
	}
	defer rows.Close()
	users := []User{}
	for rows.Next() {
		var u User
		if err = rows.Scan(&u.ID, &u.Login, &u.Name, &u.Role, &u.Disabled, &u.CreatedAt); err != nil {
			return err
		}
		users = append(users, u)
	}
	if err = rows.Err(); err != nil {
		return err
	}
	return respond(w, 200, users)
}
