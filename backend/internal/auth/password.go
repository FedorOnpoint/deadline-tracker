package auth

import (
	"context"
	"fmt"
	"log/slog"

	"deadline-tracker/internal/domain"
	"deadline-tracker/internal/security"
	"golang.org/x/crypto/bcrypt"
)

type PasswordInput struct {
	Current string `json:"current_password"`
	New     string `json:"new_password"`
}

func (service *Service) ChangePassword(ctx context.Context, userID int64, input PasswordInput) (string, error) {
	if err := validatePassword(input.New); err != nil {
		return "", err
	}
	if len(input.Current) > 72 {
		return "", domain.Invalid("Неверный текущий пароль")
	}
	if err := service.limitAuth(ctx, fmt.Sprintf("password:%d", userID), 10); err != nil {
		return "", err
	}
	var token string
	err := service.Repository.Transaction(ctx, func(tx Transaction) error {
		previous, err := tx.LockPassword(ctx, userID)
		if err != nil {
			return err
		}
		if bcrypt.CompareHashAndPassword([]byte(previous), []byte(input.Current)) != nil {
			return domain.Invalid("Неверный текущий пароль")
		}
		hash, err := security.HashPassword(input.New)
		if err != nil {
			return err
		}
		if err := tx.UpdatePassword(ctx, userID, hash); err != nil {
			return err
		}
		if err := tx.DeleteUserSessions(ctx, userID); err != nil {
			return err
		}
		token, err = sessionToken(ctx, tx, userID)
		return err
	})
	if err != nil {
		return "", err
	}
	slog.Info("password_changed", "user_id", userID)
	return token, nil
}
