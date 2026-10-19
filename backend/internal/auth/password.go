package auth

import (
	"fmt"
	"log/slog"
	"net/http"

	"deadline-tracker/internal/httpx"
	"deadline-tracker/internal/security"

	"golang.org/x/crypto/bcrypt"
)

func (handler *Service) ChangePassword(w http.ResponseWriter, r *http.Request) error {
	var input struct {
		Current string `json:"current_password"`
		New     string `json:"new_password"`
	}
	if err := httpx.Decode(w, r, &input); err != nil {
		return err
	}
	if err := validatePassword(input.New); err != nil {
		return err
	}
	if len(input.Current) > 72 {
		return httpx.Invalid("Неверный текущий пароль")
	}
	if err := handler.limitAuth(r, fmt.Sprintf("password:%d", UserID(r.Context())), 10); err != nil {
		return err
	}
	ctx := r.Context()
	tx, err := handler.DB.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)
	var old string
	if err = tx.QueryRow(ctx, "SELECT password_hash FROM users WHERE id=$1 FOR UPDATE", UserID(ctx)).Scan(&old); err != nil {
		return err
	}
	if bcrypt.CompareHashAndPassword([]byte(old), []byte(input.Current)) != nil {
		return httpx.Invalid("Неверный текущий пароль")
	}
	hash, err := security.HashPassword(input.New)
	if err != nil {
		return err
	}
	if _, err = tx.Exec(ctx, "UPDATE users SET password_hash=$1 WHERE id=$2", hash, UserID(ctx)); err != nil {
		return err
	}
	if _, err = tx.Exec(ctx, "DELETE FROM sessions WHERE user_id=$1", UserID(ctx)); err != nil {
		return err
	}
	token, err := sessionToken(ctx, tx, UserID(ctx))
	if err != nil {
		return err
	}
	if err = tx.Commit(ctx); err != nil {
		return err
	}
	setSession(w, r, token)
	slog.Info("password_changed", "user_id", UserID(ctx))
	return httpx.Respond(w, 200, map[string]bool{"ok": true})
}
