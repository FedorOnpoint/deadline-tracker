package auth

import (
	"context"
	"time"

	"deadline-tracker/internal/domain"
	"deadline-tracker/internal/security"
)

const sessionLifetime = 7 * 24 * time.Hour

type userContextKey struct{}

func CurrentUser(ctx context.Context) domain.User {
	user, _ := ctx.Value(userContextKey{}).(domain.User)
	return user
}

func UserID(ctx context.Context) int64 { return CurrentUser(ctx).ID }

func (service *Service) SessionUser(ctx context.Context, token string) (domain.User, error) {
	return service.Repository.FindSession(ctx, security.Digest(token))
}

func (service *Service) Logout(ctx context.Context, token string) error {
	if token == "" {
		return nil
	}
	return service.Repository.DeleteSession(ctx, security.Digest(token))
}

func sessionToken(ctx context.Context, tx Transaction, userID int64) (string, error) {
	token, err := security.RandomToken(32)
	if err != nil {
		return "", err
	}
	if err := tx.InsertSession(ctx, userID, security.Digest(token)); err != nil {
		return "", err
	}
	return token, nil
}
