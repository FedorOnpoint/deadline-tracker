package tasks

import (
	"context"
	"strings"

	"deadline-tracker/internal/domain"
)

type SharedTask struct {
	Task      domain.Task        `json:"task"`
	Catalog   []domain.Catalog   `json:"catalog"`
	Section   domain.TaskSection `json:"section"`
	OwnerName string             `json:"owner_name"`
}

type Member struct {
	ID    int64  `json:"id"`
	Login string `json:"login"`
	Name  string `json:"name"`
}

type SharingRepository interface {
	ListShared(context.Context, int64) ([]SharedTask, error)
	Transaction(context.Context, func(SharingTransaction) error) error
}

type SharingTransaction interface {
	LockOwner(ctx context.Context, userID, taskID int64) error
	ListMembers(ctx context.Context, taskID int64) ([]Member, error)
	FindMember(ctx context.Context, login string) (Member, error)
	AddMember(ctx context.Context, taskID, memberID int64) error
	RemoveMember(ctx context.Context, taskID, memberID int64) error
}

type SharingService struct{ Repository SharingRepository }

func (service *SharingService) List(ctx context.Context, userID int64) ([]SharedTask, error) {
	return service.Repository.ListShared(ctx, userID)
}

func (service *SharingService) Members(ctx context.Context, ownerID, taskID int64) ([]Member, error) {
	var members []Member
	err := service.Repository.Transaction(ctx, func(tx SharingTransaction) error {
		if err := tx.LockOwner(ctx, ownerID, taskID); err != nil {
			return err
		}
		var err error
		members, err = tx.ListMembers(ctx, taskID)
		return err
	})
	return members, err
}

func (service *SharingService) Add(ctx context.Context, ownerID, taskID int64, login string) error {
	login = strings.TrimSpace(strings.TrimPrefix(strings.TrimSpace(login), "@"))
	if login == "" || len(login) > 100 {
		return domain.Invalid("Укажите логин участника")
	}
	return service.Repository.Transaction(ctx, func(tx SharingTransaction) error {
		if err := tx.LockOwner(ctx, ownerID, taskID); err != nil {
			return err
		}
		member, err := tx.FindMember(ctx, login)
		if err != nil {
			return err
		}
		if member.ID == ownerID {
			return domain.Invalid("Вы уже владелец карточки")
		}
		return tx.AddMember(ctx, taskID, member.ID)
	})
}

func (service *SharingService) Remove(ctx context.Context, ownerID, taskID, memberID int64) error {
	return service.Repository.Transaction(ctx, func(tx SharingTransaction) error {
		if err := tx.LockOwner(ctx, ownerID, taskID); err != nil {
			return err
		}
		return tx.RemoveMember(ctx, taskID, memberID)
	})
}
