package auth

import (
	"context"

	"deadline-tracker/internal/security"
)

func (service *Service) limitAuth(ctx context.Context, scope string, max int) error {
	attempts, err := service.Repository.IncrementAttempts(ctx, security.Digest(scope))
	if err != nil {
		return err
	}
	if attempts > max {
		return ErrRateLimited
	}
	return nil
}
