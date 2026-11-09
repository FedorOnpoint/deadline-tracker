package auth

import (
	"context"
	"errors"

	"deadline-tracker/internal/domain"
)

var (
	ErrInvalidCredentials = errors.New("Неверный логин или пароль")
	ErrRateLimited        = errors.New("Слишком много попыток. Попробуйте через 15 минут")
)

type Credentials struct {
	User         domain.User
	PasswordHash string
}

type Session struct {
	User  domain.User
	Token string
}

type Repository interface {
	SaveAvatar(context.Context, int64, []byte) error
	Avatar(context.Context, int64) ([]byte, error)
	IncrementAttempts(ctx context.Context, scopeHash string) (int, error)
	FindSession(ctx context.Context, tokenHash string) (domain.User, error)
	DeleteSession(ctx context.Context, tokenHash string) error
	Transaction(context.Context, func(Transaction) error) error
}

type Transaction interface {
	FindCredentials(ctx context.Context, login string) (Credentials, error)
	LockPassword(ctx context.Context, userID int64) (string, error)
	LockInvitation(ctx context.Context, codeHash string) (int64, error)
	CreateUser(ctx context.Context, login, name, passwordHash string) (domain.User, error)
	UseInvitation(ctx context.Context, invitationID, userID int64) error
	UpdatePassword(ctx context.Context, userID int64, passwordHash string) error
	DeleteUserSessions(ctx context.Context, userID int64) error
	InsertSession(ctx context.Context, userID int64, tokenHash string) error
	DeleteSession(ctx context.Context, tokenHash string) error
	CleanupExpired(ctx context.Context) error
}

type Service struct{ Repository Repository }
