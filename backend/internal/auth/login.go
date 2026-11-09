package auth

import (
	"context"
	"errors"
	"log/slog"

	"deadline-tracker/internal/domain"
	"deadline-tracker/internal/security"
	"golang.org/x/crypto/bcrypt"
)

type LoginInput struct {
	Login    string `json:"login"`
	Password string `json:"password"`
}

func (service *Service) Login(ctx context.Context, input LoginInput, address, oldToken string) (Session, error) {
	var session Session
	input.Login = normalizeLogin(input.Login)
	if err := service.limitAuth(ctx, "login-ip:"+address, 60); err != nil {
		return session, err
	}
	if !validLogin.MatchString(input.Login) || len(input.Password) > 72 {
		return session, ErrInvalidCredentials
	}
	if err := service.limitAuth(ctx, "login-user:"+input.Login, 10); err != nil {
		return session, err
	}
	err := service.Repository.Transaction(ctx, func(tx Transaction) error {
		credentials, err := tx.FindCredentials(ctx, input.Login)
		if errors.Is(err, domain.ErrNotFound) {
			// An unknown login must cost as much as an incorrect password.
			_ = bcrypt.CompareHashAndPassword([]byte("$2a$12$R9h/cIPz0gi.URNNX3kh2OPST9/PgBkqquzi.Ss7KIUgO2t0jWMUW"), []byte(input.Password))
			return ErrInvalidCredentials
		}
		if err != nil {
			return err
		}
		if bcrypt.CompareHashAndPassword([]byte(credentials.PasswordHash), []byte(input.Password)) != nil || credentials.User.Disabled {
			return ErrInvalidCredentials
		}
		if err := tx.CleanupExpired(ctx); err != nil {
			return err
		}
		session.User = credentials.User
		session.Token, err = sessionToken(ctx, tx, session.User.ID)
		if err != nil {
			return err
		}
		if oldToken != "" {
			return tx.DeleteSession(ctx, security.Digest(oldToken))
		}
		return nil
	})
	if err != nil {
		return Session{}, err
	}
	slog.Info("login_success", "user_id", session.User.ID)
	return session, nil
}
