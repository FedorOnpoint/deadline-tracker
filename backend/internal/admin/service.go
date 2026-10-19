package admin

import (
	"context"
	"strings"
	"time"

	"deadline-tracker/internal/domain"
	"deadline-tracker/internal/security"
)

type Invitation struct {
	ID        int64      `json:"id"`
	Code      string     `json:"code,omitempty"`
	CreatedAt time.Time  `json:"created_at"`
	ExpiresAt time.Time  `json:"expires_at"`
	UsedAt    *time.Time `json:"used_at"`
	UsedBy    string     `json:"used_by"`
	Revoked   bool       `json:"revoked"`
}

type Repository interface {
	CreateInvitation(ctx context.Context, adminID int64, codeHash string) (Invitation, error)
	ListInvitations(ctx context.Context) ([]Invitation, error)
	RevokeInvitation(ctx context.Context, invitationID int64) (bool, error)
	ListUsers(ctx context.Context) ([]domain.User, error)
}

type Service struct{ Repository Repository }

func (service *Service) CreateInvitation(ctx context.Context, adminID int64) (Invitation, error) {
	token, err := security.RandomToken(16)
	if err != nil {
		return Invitation{}, err
	}
	token = strings.ToUpper(token)
	invitation, err := service.Repository.CreateInvitation(ctx, adminID, security.Digest(token))
	if err != nil {
		return Invitation{}, err
	}
	invitation.Code = token[:8] + "-" + token[8:16] + "-" + token[16:24] + "-" + token[24:]
	return invitation, nil
}

func (service *Service) ListInvitations(ctx context.Context) ([]Invitation, error) {
	return service.Repository.ListInvitations(ctx)
}

func (service *Service) RevokeInvitation(ctx context.Context, id int64) error {
	found, err := service.Repository.RevokeInvitation(ctx, id)
	if err != nil {
		return err
	}
	if !found {
		return domain.Missing("Приглашение не найдено или уже использовано")
	}
	return nil
}

func (service *Service) ListUsers(ctx context.Context) ([]domain.User, error) {
	return service.Repository.ListUsers(ctx)
}
