package auth

import (
	"errors"
	"log/slog"
	"net/http"
	"strings"
	"unicode/utf8"

	"deadline-tracker/internal/database"
	"deadline-tracker/internal/domain"
	"deadline-tracker/internal/httpx"
	"deadline-tracker/internal/security"

	"github.com/jackc/pgx/v5"
)

func (handler *Service) Register(w http.ResponseWriter, r *http.Request) error {
	var input struct {
		Login    string `json:"login"`
		Name     string `json:"name"`
		Password string `json:"password"`
		Code     string `json:"code"`
	}
	if err := httpx.Decode(w, r, &input); err != nil {
		return err
	}
	if err := handler.limitAuth(r, "register:"+clientAddress(r), 20); err != nil {
		return err
	}
	input.Login = normalizeLogin(input.Login)
	input.Name = strings.TrimSpace(input.Name)
	input.Code = normalizeCode(input.Code)
	if !validLogin.MatchString(input.Login) {
		return httpx.Invalid("Логин: 3–64 латинских символа, цифры, точка, дефис или подчёркивание")
	}
	if input.Name == "" || utf8.RuneCountInString(input.Name) > 100 {
		return httpx.Invalid("Укажите имя до 100 символов")
	}
	if err := validatePassword(input.Password); err != nil {
		return err
	}
	if len(input.Code) != 32 {
		return httpx.Invalid("Неверный или недействительный код приглашения")
	}
	ctx := r.Context()
	tx, err := handler.DB.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)
	var inviteID int64
	err = tx.QueryRow(ctx, "SELECT id FROM invitations WHERE code_hash=$1 AND expires_at>now() AND NOT revoked AND used_by IS NULL FOR UPDATE", security.Digest(input.Code)).Scan(&inviteID)
	if errors.Is(err, pgx.ErrNoRows) {
		return httpx.Invalid("Код приглашения недействителен, истёк или уже использован")
	}
	if err != nil {
		return err
	}
	hash, err := security.HashPassword(input.Password)
	if err != nil {
		return err
	}
	var user domain.User
	if err = tx.QueryRow(ctx, "INSERT INTO users(login,name,password_hash) VALUES($1,$2,$3) RETURNING id,login,name,role,disabled,created_at", input.Login, input.Name, hash).Scan(&user.ID, &user.Login, &user.Name, &user.Role, &user.Disabled, &user.CreatedAt); err != nil {
		return err
	}
	if err = database.SeedUserCatalog(ctx, tx, user.ID); err != nil {
		return err
	}
	if _, err = tx.Exec(ctx, "UPDATE invitations SET used_by=$1,used_at=now() WHERE id=$2", user.ID, inviteID); err != nil {
		return err
	}
	token, err := sessionToken(ctx, tx, user.ID)
	if err != nil {
		return err
	}
	if err = tx.Commit(ctx); err != nil {
		return err
	}
	setSession(w, r, token)
	slog.Info("user_registered", "user_id", user.ID, "invitation_id", inviteID)
	return httpx.Respond(w, 201, user)
}
