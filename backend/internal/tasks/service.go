package tasks

import (
	"context"
	"log/slog"

	"deadline-tracker/internal/catalog"
	"deadline-tracker/internal/domain"
)

type Repository interface {
	List(ctx context.Context, userID int64) ([]domain.Task, error)
	Delete(ctx context.Context, userID, taskID int64) error
	Transaction(ctx context.Context, run func(Transaction) error) error
}

type Transaction interface {
	catalog.ReferenceReader
	Lock(ctx context.Context, userID, taskID int64) (domain.Task, error)
	Get(ctx context.Context, userID, taskID int64) (domain.Task, error)
	Insert(ctx context.Context, userID int64, task domain.Task) (int64, error)
	Update(ctx context.Context, userID, taskID int64, task domain.Task, newCycle bool) error
	ClaimExamples(ctx context.Context, userID int64) (bool, error)
	ActiveCatalogIDs(ctx context.Context, userID int64, kind string) ([]int64, error)
}

type DeadlineChecker interface {
	Check(ctx context.Context, taskID int64) error
}

type Service struct {
	Repository Repository
	Deadlines  DeadlineChecker
}

type TaskPatch struct {
	HasStatus    bool
	StatusID     *int64
	HasCompleted bool
	Completed    bool
}

func (service *Service) List(ctx context.Context, userID int64) ([]domain.Task, error) {
	return service.Repository.List(ctx, userID)
}

func (service *Service) Create(ctx context.Context, userID int64, input domain.Task) (domain.Task, error) {
	return service.save(ctx, userID, 0, func(domain.Task) domain.Task { return input })
}

func (service *Service) Update(ctx context.Context, userID, id int64, input domain.Task) (domain.Task, error) {
	if id <= 0 {
		return domain.Task{}, domain.Invalid("Некорректный ID")
	}
	return service.save(ctx, userID, id, func(domain.Task) domain.Task { return input })
}

func (service *Service) Patch(ctx context.Context, userID, id int64, patch TaskPatch) (domain.Task, error) {
	if id <= 0 {
		return domain.Task{}, domain.Invalid("Некорректный ID")
	}
	if !patch.HasStatus && !patch.HasCompleted {
		return domain.Task{}, domain.Invalid("Нет изменений")
	}
	return service.save(ctx, userID, id, func(task domain.Task) domain.Task {
		if patch.HasStatus {
			task.StatusID = patch.StatusID
		}
		if patch.HasCompleted {
			task.Completed = patch.Completed
		}
		return task
	})
}

func (service *Service) save(ctx context.Context, userID, id int64, apply func(domain.Task) domain.Task) (domain.Task, error) {
	var result domain.Task
	err := service.Repository.Transaction(ctx, func(tx Transaction) error {
		var previous domain.Task
		var err error
		if id != 0 {
			previous, err = tx.Lock(ctx, userID, id)
			if err != nil {
				return err
			}
		}
		task := apply(previous)
		if err := validateTask(&task); err != nil {
			return err
		}
		if err := validateReferences(ctx, tx, userID, task, previous); err != nil {
			return err
		}
		if id == 0 {
			id, err = tx.Insert(ctx, userID, task)
		} else {
			newCycle := !previous.Deadline.Equal(task.Deadline) || (previous.Completed && !task.Completed)
			err = tx.Update(ctx, userID, id, task, newCycle)
		}
		if err != nil {
			return err
		}
		result, err = tx.Get(ctx, userID, id)
		return err
	})
	if err != nil {
		return domain.Task{}, err
	}
	// Delivery errors are retried by the periodic worker after the save has committed.
	if err := service.Deadlines.Check(ctx, id); err != nil {
		slog.Error("notification_delivery_error", "task_id", id, "error", err)
	}
	return result, nil
}

func validateReferences(ctx context.Context, reader catalog.ReferenceReader, userID int64, task, previous domain.Task) error {
	var previousPlatform *int64
	if previous.ID > 0 {
		previousPlatform = &previous.PlatformID
	}
	if err := catalog.ValidateReference(ctx, reader, userID, &task.PlatformID, "platform", previousPlatform, true); err != nil {
		return err
	}
	if err := catalog.ValidateReference(ctx, reader, userID, task.SpecialtyID, "specialty", previous.SpecialtyID, false); err != nil {
		return err
	}
	return catalog.ValidateReference(ctx, reader, userID, task.StatusID, "status", previous.StatusID, false)
}

func (service *Service) Delete(ctx context.Context, userID, id int64) error {
	return service.Repository.Delete(ctx, userID, id)
}
