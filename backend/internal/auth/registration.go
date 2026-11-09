package auth

import (
	"context"
	"errors"
	"log/slog"
	"strings"
	"unicode/utf8"

	"deadline-tracker/internal/domain"
	"deadline-tracker/internal/security"
)

type RegistrationInput struct {
	Login    string `json:"login"`
	Name     string `json:"name"`
	Password string `json:"password"`
	Code     string `json:"code"`
}

func (service *Service) Register(ctx context.Context, input RegistrationInput, address string) (Session, error) {
	var session Session
	if err := service.limitAuth(ctx, "register:"+address, 20); err != nil {
		return session, err
	}
	input.Login = normalizeLogin(input.Login)
	input.Name = strings.TrimSpace(input.Name)
	input.Code = normalizeCode(input.Code)
	if !validLogin.MatchString(input.Login) {
		return session, domain.Invalid("Логин: 3–64 латинских символа, цифры, точка, дефис или подчёркивание")
	}
	if input.Name == "" || utf8.RuneCountInString(input.Name) > 100 {
		return session, domain.Invalid("Укажите имя до 100 символов")
	}
	if err := validatePassword(input.Password); err != nil {
		return session, err
	}
	if len(input.Code) != 32 {
		return session, domain.Invalid("Неверный или недействительный код приглашения")
	}
	var invitationID int64
	err := service.Repository.Transaction(ctx, func(tx Transaction) error {
		var err error
		invitationID, err = tx.LockInvitation(ctx, security.Digest(input.Code))
		if errors.Is(err, domain.ErrNotFound) {
			return domain.Invalid("Код приглашения недействителен, истёк или уже использован")
		}
		if err != nil {
			return err
		}
		hash, err := security.HashPassword(input.Password)
		if err != nil {
			return err
		}
		session.User, err = tx.CreateUser(ctx, input.Login, input.Name, hash)
		if err != nil {
			return err
		}
		if err := tx.UseInvitation(ctx, invitationID, session.User.ID); err != nil {
			return err
		}
		session.Token, err = sessionToken(ctx, tx, session.User.ID)
		return err
	})
	if err != nil {
		return Session{}, err
	}
	slog.Info("user_registered", "user_id", session.User.ID, "invitation_id", invitationID)
	return session, nil
}
