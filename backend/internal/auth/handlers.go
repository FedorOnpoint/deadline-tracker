package auth

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"net"
	"net/http"
	"os"
	"regexp"
	"strings"
	"time"
	"unicode/utf8"

	"deadline-tracker/internal/database"
	"deadline-tracker/internal/httpx"
	"deadline-tracker/internal/security"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"golang.org/x/crypto/bcrypt"
)

type Service struct{ DB *pgxpool.Pool }

const sessionCookie = "deadline_session"
const sessionLifetime = 7 * 24 * time.Hour

type User struct {
	ID        int64     `json:"id"`
	Login     string    `json:"login"`
	Name      string    `json:"name"`
	Role      string    `json:"role"`
	Disabled  bool      `json:"disabled"`
	CreatedAt time.Time `json:"created_at"`
}
type userContextKey struct{}

func CurrentUser(ctx context.Context) User { u, _ := ctx.Value(userContextKey{}).(User); return u }
func UserID(ctx context.Context) int64     { return CurrentUser(ctx).ID }
func normalizeCode(code string) string {
	return strings.ToUpper(strings.Join(strings.Fields(strings.ReplaceAll(code, "-", "")), ""))
}

var validLogin = regexp.MustCompile(`^[a-z0-9][a-z0-9._-]{2,63}$`)

func normalizeLogin(login string) string { return strings.ToLower(strings.TrimSpace(login)) }
func validatePassword(password string) error {
	if utf8.RuneCountInString(password) < 8 || len(password) > 72 {
		return httpx.Invalid("Пароль: от 8 символов и не более 72 байт")
	}
	return nil
}
func (a *Service) Authenticated(fn func(http.ResponseWriter, *http.Request) error, admin bool) func(http.ResponseWriter, *http.Request) error {
	return func(w http.ResponseWriter, r *http.Request) error {
		cookie, err := r.Cookie(sessionCookie)
		if err != nil || len(cookie.Value) != 64 {
			return &httpx.Error{Code: 401, Message: "Войдите в свой аккаунт"}
		}
		var u User
		err = a.DB.QueryRow(r.Context(), `SELECT u.id,u.login,u.name,u.role,u.disabled,u.created_at FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=$1 AND s.expires_at>now() AND NOT u.disabled`, security.Digest(cookie.Value)).Scan(&u.ID, &u.Login, &u.Name, &u.Role, &u.Disabled, &u.CreatedAt)
		if errors.Is(err, pgx.ErrNoRows) {
			return &httpx.Error{Code: 401, Message: "Сессия завершена. Войдите снова"}
		}
		if err != nil {
			return err
		}
		if admin && u.Role != "admin" {
			return &httpx.Error{Code: 403, Message: "Доступ только для администратора"}
		}
		return fn(w, r.WithContext(context.WithValue(r.Context(), userContextKey{}, u)))
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
	http.SetCookie(w, &http.Cookie{Name: sessionCookie, Value: token, Path: "/", HttpOnly: true, Secure: os.Getenv("VERCEL") == "1" || r.TLS != nil, SameSite: http.SameSiteStrictMode, MaxAge: age})
}
func (a *Service) limitAuth(r *http.Request, scope string, max int) error {
	ctx := r.Context()
	var attempts int
	err := a.DB.QueryRow(ctx, `INSERT INTO auth_limits(scope,attempts,resets_at) VALUES($1,1,now()+interval '15 minutes') ON CONFLICT(scope) DO UPDATE SET attempts=CASE WHEN auth_limits.resets_at<=now() THEN 1 ELSE auth_limits.attempts+1 END,resets_at=CASE WHEN auth_limits.resets_at<=now() THEN now()+interval '15 minutes' ELSE auth_limits.resets_at END RETURNING attempts`, security.Digest(scope)).Scan(&attempts)
	if err != nil {
		return err
	}
	if attempts > max {
		return &httpx.Error{Code: 429, Message: "Слишком много попыток. Попробуйте через 15 минут"}
	}
	return nil
}
func clientAddress(r *http.Request) string {
	if os.Getenv("VERCEL") == "1" {
		if ip := strings.TrimSpace(strings.Split(r.Header.Get("X-Vercel-Forwarded-For"), ",")[0]); net.ParseIP(ip) != nil {
			return ip
		}
	}
	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err == nil {
		return host
	}
	return r.RemoteAddr
}
func (a *Service) Login(w http.ResponseWriter, r *http.Request) error {
	var in struct {
		Login    string `json:"login"`
		Password string `json:"password"`
	}
	if err := httpx.Decode(w, r, &in); err != nil {
		return err
	}
	in.Login = normalizeLogin(in.Login)
	if err := a.limitAuth(r, "login-ip:"+clientAddress(r), 60); err != nil {
		return err
	}
	if !validLogin.MatchString(in.Login) || len(in.Password) > 72 {
		return &httpx.Error{Code: 401, Message: "Неверный логин или пароль"}
	}
	if err := a.limitAuth(r, "login-user:"+in.Login, 10); err != nil {
		return err
	}
	ctx := r.Context()
	tx, err := a.DB.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)
	var u User
	var hash string
	err = tx.QueryRow(ctx, "SELECT id,login,name,role,disabled,created_at,password_hash FROM users WHERE lower(login)=$1 FOR SHARE", in.Login).Scan(&u.ID, &u.Login, &u.Name, &u.Role, &u.Disabled, &u.CreatedAt, &hash)
	if errors.Is(err, pgx.ErrNoRows) { // Keep an unknown login as expensive as a wrong password.
		_ = bcrypt.CompareHashAndPassword([]byte("$2a$12$R9h/cIPz0gi.URNNX3kh2OPST9/PgBkqquzi.Ss7KIUgO2t0jWMUW"), []byte(in.Password))
		return &httpx.Error{Code: 401, Message: "Неверный логин или пароль"}
	}
	if err != nil {
		return err
	}
	if bcrypt.CompareHashAndPassword([]byte(hash), []byte(in.Password)) != nil || u.Disabled {
		return &httpx.Error{Code: 401, Message: "Неверный логин или пароль"}
	}
	if _, err = tx.Exec(ctx, "DELETE FROM sessions WHERE expires_at<=now(); DELETE FROM auth_limits WHERE resets_at<=now()"); err != nil {
		return err
	}
	token, err := sessionToken(ctx, tx, u.ID)
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
	slog.Info("login_success", "user_id", u.ID)
	return httpx.Respond(w, 200, u)
}
func (a *Service) Me(w http.ResponseWriter, r *http.Request) error {
	return httpx.Respond(w, 200, CurrentUser(r.Context()))
}
func (a *Service) Logout(w http.ResponseWriter, r *http.Request) error {
	if c, err := r.Cookie(sessionCookie); err == nil {
		if _, err = a.DB.Exec(r.Context(), "DELETE FROM sessions WHERE token_hash=$1", security.Digest(c.Value)); err != nil {
			return err
		}
	}
	setSession(w, r, "")
	return httpx.Respond(w, 200, map[string]bool{"ok": true})
}
func (a *Service) ChangePassword(w http.ResponseWriter, r *http.Request) error {
	var in struct {
		Current string `json:"current_password"`
		New     string `json:"new_password"`
	}
	if err := httpx.Decode(w, r, &in); err != nil {
		return err
	}
	if err := validatePassword(in.New); err != nil {
		return err
	}
	if len(in.Current) > 72 {
		return httpx.Invalid("Неверный текущий пароль")
	}
	if err := a.limitAuth(r, fmt.Sprintf("password:%d", UserID(r.Context())), 10); err != nil {
		return err
	}
	ctx := r.Context()
	tx, err := a.DB.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)
	var old string
	if err = tx.QueryRow(ctx, "SELECT password_hash FROM users WHERE id=$1 FOR UPDATE", UserID(ctx)).Scan(&old); err != nil {
		return err
	}
	if bcrypt.CompareHashAndPassword([]byte(old), []byte(in.Current)) != nil {
		return httpx.Invalid("Неверный текущий пароль")
	}
	hash, err := security.HashPassword(in.New)
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
func (a *Service) Register(w http.ResponseWriter, r *http.Request) error {
	var in struct {
		Login    string `json:"login"`
		Name     string `json:"name"`
		Password string `json:"password"`
		Code     string `json:"code"`
	}
	if err := httpx.Decode(w, r, &in); err != nil {
		return err
	}
	if err := a.limitAuth(r, "register:"+clientAddress(r), 20); err != nil {
		return err
	}
	in.Login = normalizeLogin(in.Login)
	in.Name = strings.TrimSpace(in.Name)
	in.Code = normalizeCode(in.Code)
	if !validLogin.MatchString(in.Login) {
		return httpx.Invalid("Логин: 3–64 латинских символа, цифры, точка, дефис или подчёркивание")
	}
	if in.Name == "" || utf8.RuneCountInString(in.Name) > 100 {
		return httpx.Invalid("Укажите имя до 100 символов")
	}
	if err := validatePassword(in.Password); err != nil {
		return err
	}
	if len(in.Code) != 32 {
		return httpx.Invalid("Неверный или недействительный код приглашения")
	}
	ctx := r.Context()
	tx, err := a.DB.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)
	var inviteID int64
	err = tx.QueryRow(ctx, "SELECT id FROM invitations WHERE code_hash=$1 AND expires_at>now() AND NOT revoked AND used_by IS NULL FOR UPDATE", security.Digest(in.Code)).Scan(&inviteID)
	if errors.Is(err, pgx.ErrNoRows) {
		return httpx.Invalid("Код приглашения недействителен, истёк или уже использован")
	}
	if err != nil {
		return err
	}
	hash, err := security.HashPassword(in.Password)
	if err != nil {
		return err
	}
	var u User
	if err = tx.QueryRow(ctx, "INSERT INTO users(login,name,password_hash) VALUES($1,$2,$3) RETURNING id,login,name,role,disabled,created_at", in.Login, in.Name, hash).Scan(&u.ID, &u.Login, &u.Name, &u.Role, &u.Disabled, &u.CreatedAt); err != nil {
		return err
	}
	if err = database.SeedUserCatalog(ctx, tx, u.ID); err != nil {
		return err
	}
	if _, err = tx.Exec(ctx, "UPDATE invitations SET used_by=$1,used_at=now() WHERE id=$2", u.ID, inviteID); err != nil {
		return err
	}
	token, err := sessionToken(ctx, tx, u.ID)
	if err != nil {
		return err
	}
	if err = tx.Commit(ctx); err != nil {
		return err
	}
	setSession(w, r, token)
	slog.Info("user_registered", "user_id", u.ID, "invitation_id", inviteID)
	return httpx.Respond(w, 201, u)
}
