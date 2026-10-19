package auth

import (
	"context"
	"errors"
	"net/http"
	"os"
	"time"

	"deadline-tracker/internal/domain"
	"deadline-tracker/internal/httpx"
	"deadline-tracker/internal/security"

	"github.com/jackc/pgx/v5"
)

const sessionCookie = "deadline_session"

const sessionLifetime = 7 * 24 * time.Hour

type userContextKey struct{}

func CurrentUser(ctx context.Context) domain.User {
	user, _ := ctx.Value(userContextKey{}).(domain.User)
	return user
}

func UserID(ctx context.Context) int64 { return CurrentUser(ctx).ID }

func (handler *Service) Authenticated(fn func(http.ResponseWriter, *http.Request) error, admin bool) func(http.ResponseWriter, *http.Request) error {
	return func(w http.ResponseWriter, r *http.Request) error {
		cookie, err := r.Cookie(sessionCookie)
		if err != nil || len(cookie.Value) != 64 {
			return &httpx.Error{Code: 401, Message: "Войдите в свой аккаунт"}
		}
		var user domain.User
		err = handler.DB.QueryRow(r.Context(), `
 SELECT u.id, u.login, u.name, u.role, u.disabled, u.created_at
 FROM sessions s
 JOIN users u ON u.id = s.user_id
 WHERE s.token_hash = $1 AND s.expires_at > now() AND NOT u.disabled`,
			security.Digest(cookie.Value),
		).Scan(&user.ID, &user.Login, &user.Name, &user.Role, &user.Disabled, &user.CreatedAt)
		if errors.Is(err, pgx.ErrNoRows) {
			return &httpx.Error{Code: 401, Message: "Сессия завершена. Войдите снова"}
		}
		if err != nil {
			return err
		}
		if admin && user.Role != "admin" {
			return &httpx.Error{Code: 403, Message: "Доступ только для администратора"}
		}
		return fn(w, r.WithContext(context.WithValue(r.Context(), userContextKey{}, user)))
	}
}

func sessionToken(ctx context.Context, tx pgx.Tx, id int64) (string, error) {
	token, err := security.RandomToken(32)
	if err != nil {
		return "", err
	}
	_, err = tx.Exec(ctx, "INSERT INTO sessions(token_hash,user_id,expires_at) VALUES($1,$2,now()+interval '7 days')", security.Digest(token), id)
	return token, err
}

func setSession(w http.ResponseWriter, r *http.Request, token string) {
	age := int(sessionLifetime.Seconds())
	if token == "" {
		age = -1
	}
	http.SetCookie(w, &http.Cookie{
		Name:     sessionCookie,
		Value:    token,
		Path:     "/",
		HttpOnly: true,
		Secure:   os.Getenv("VERCEL") == "1" || r.TLS != nil,
		SameSite: http.SameSiteStrictMode,
		MaxAge:   age,
	})
}

func (handler *Service) Me(w http.ResponseWriter, r *http.Request) error {
	return httpx.Respond(w, 200, CurrentUser(r.Context()))
}

func (handler *Service) Logout(w http.ResponseWriter, r *http.Request) error {
	if c, err := r.Cookie(sessionCookie); err == nil {
		if _, err = handler.DB.Exec(r.Context(), "DELETE FROM sessions WHERE token_hash=$1", security.Digest(c.Value)); err != nil {
			return err
		}
	}
	setSession(w, r, "")
	return httpx.Respond(w, 200, map[string]bool{"ok": true})
}
