package auth

import (
	"errors"
	"log/slog"
	"net/http"

	"deadline-tracker/internal/domain"
	"deadline-tracker/internal/httpx"
	"deadline-tracker/internal/security"

	"github.com/jackc/pgx/v5"
	"golang.org/x/crypto/bcrypt"
)

func (handler *Service) Login(w http.ResponseWriter, r *http.Request) error {
	var input struct {
		Login    string `json:"login"`
		Password string `json:"password"`
	}
	if err := httpx.Decode(w, r, &input); err != nil {
		return err
	}
	input.Login = normalizeLogin(input.Login)
	if err := handler.limitAuth(r, "login-ip:"+clientAddress(r), 60); err != nil {
		return err
	}
	if !validLogin.MatchString(input.Login) || len(input.Password) > 72 {
		return &httpx.Error{Code: 401, Message: "Неверный логин или пароль"}
	}
	if err := handler.limitAuth(r, "login-user:"+input.Login, 10); err != nil {
		return err
	}
	ctx := r.Context()
	tx, err := handler.DB.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)
	var user domain.User
	var hash string
	err = tx.QueryRow(ctx, "SELECT id,login,name,role,disabled,created_at,password_hash FROM users WHERE lower(login)=$1 FOR SHARE", input.Login).Scan(&user.ID, &user.Login, &user.Name, &user.Role, &user.Disabled, &user.CreatedAt, &hash)
	if errors.Is(err, pgx.ErrNoRows) { // Keep an unknown login as expensive as a wrong password.
		_ = bcrypt.CompareHashAndPassword([]byte("$2a$12$R9h/cIPz0gi.URNNX3kh2OPST9/PgBkqquzi.Ss7KIUgO2t0jWMUW"), []byte(input.Password))
		return &httpx.Error{Code: 401, Message: "Неверный логин или пароль"}
	}
	if err != nil {
		return err
	}
	if bcrypt.CompareHashAndPassword([]byte(hash), []byte(input.Password)) != nil || user.Disabled {
		return &httpx.Error{Code: 401, Message: "Неверный логин или пароль"}
	}
	if _, err = tx.Exec(ctx, "DELETE FROM sessions WHERE expires_at<=now(); DELETE FROM auth_limits WHERE resets_at<=now()"); err != nil {
		return err
	}
	token, err := sessionToken(ctx, tx, user.ID)
	if err != nil {
		return err
	}
	if old, e := r.Cookie(sessionCookie); e == nil {
		if _, err = tx.Exec(ctx, "DELETE FROM sessions WHERE token_hash=$1", security.Digest(old.Value)); err != nil {
			return err
		}
	}
	if err = tx.Commit(ctx); err != nil {
		return err
	}
	setSession(w, r, token)
	slog.Info("login_success", "user_id", user.ID)
	return httpx.Respond(w, 200, user)
}
