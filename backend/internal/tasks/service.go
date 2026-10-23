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
	CardFields(ctx context.Context, userID int64, section string) ([]domain.CardField, error)
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
	items, err := service.Repository.List(ctx, userID)
	if err != nil {
		return nil, err
	}
	for i := range items {
		if err := setDateDeadlines(&items[i]); err != nil {
			return nil, err
		}
		normalizeAudiences(&items[i])
	}
	return items, nil
}

func (service *Service) Create(ctx context.Context, userID int64, input domain.Task) (domain.Task, error) {
	return service.save(ctx, userID, 0, false, func(domain.Task) domain.Task { return input })
}

func (service *Service) Update(ctx context.Context, userID, id int64, input domain.Task) (domain.Task, error) {
	if id <= 0 {
		return domain.Task{}, domain.Invalid("Некорректный ID")
	}
	return service.save(ctx, userID, id, false, func(domain.Task) domain.Task { return input })
}

func (service *Service) Patch(ctx context.Context, userID, id int64, patch TaskPatch) (domain.Task, error) {
	if id <= 0 {
		return domain.Task{}, domain.Invalid("Некорректный ID")
	}
	if !patch.HasStatus && !patch.HasCompleted {
		return domain.Task{}, domain.Invalid("Нет изменений")
	}
	return service.save(ctx, userID, id, true, func(task domain.Task) domain.Task {
		if patch.HasStatus {
			task.StatusID = patch.StatusID
		}
		if patch.HasCompleted {
			task.Completed = patch.Completed
		}
		return task
	})
}

func (service *Service) save(ctx context.Context, userID, id int64, patch bool, apply func(domain.Task) domain.Task) (domain.Task, error) {
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
		if task.CustomFields == nil {
			task.CustomFields = previous.CustomFields
		}
		if task.Section == "" {
			task.Section = previous.Section
		}
		if task.Section == "" && task.PlatformID > 0 {
			platform, err := tx.FindReference(ctx, userID, task.PlatformID)
			if err != nil {
				return err
			}
			if platform != nil {
				task.Section = platform.Section
			}
		}
		normalizeAudiences(&task)
		if err := validateReferences(ctx, tx, userID, task, previous); err != nil {
			return err
		}
		fields, err := tx.CardFields(ctx, userID, task.Section)
		if err != nil {
			return err
		}
		if err := prepareCard(&task, previous, fields, patch); err != nil {
			return err
		}
		if err := validateTask(&task); err != nil {
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
		result.DateDeadlines = task.DateDeadlines
		return err
	})
	if err != nil {
		return domain.Task{}, err
	}
	// Delivery errors are retried by the periodic worker after the save has committed.
	if err := service.Deadlines.Check(ctx, id); err != nil {
		slog.Error("notification_delivery_error", "task_id", id, "error", err)
	}
	normalizeAudiences(&result)
	return result, nil
}

func normalizeAudiences(task *domain.Task) {
	if task.SpecialtyIDs == nil {
		task.SpecialtyIDs = []int64{}
		if task.SpecialtyID != nil {
			task.SpecialtyIDs = append(task.SpecialtyIDs, *task.SpecialtyID)
		}
	}
	task.SpecialtyID = nil
	if len(task.SpecialtyIDs) > 0 {
		id := task.SpecialtyIDs[0]
		task.SpecialtyID = &id
	}
}

func validateReferences(ctx context.Context, reader catalog.ReferenceReader, userID int64, task, previous domain.Task) error {
	var previousPlatform *int64
	if previous.ID > 0 {
		previousPlatform = &previous.PlatformID
	}
	var platformID *int64
	if task.PlatformID != 0 {
		platformID = &task.PlatformID
	}
	if err := catalog.ValidateReference(ctx, reader, userID, platformID, "platform", previousPlatform, false); err != nil {
		return err
	}
	if platformID != nil {
		platform, err := reader.FindReference(ctx, userID, *platformID)
		if err != nil {
			return err
		}
		if platform.Section != task.Section {
			return domain.Invalid("Площадка относится к другому разделу")
		}
	}
	if len(task.SpecialtyIDs) > 100 {
		return domain.Invalid("Выберите не более 100 аудиторий")
	}
	normalizeAudiences(&previous)
	seen := map[int64]bool{}
	for _, id := range task.SpecialtyIDs {
		if id <= 0 || seen[id] {
			return domain.Invalid("Некорректный список аудиторий")
		}
		seen[id] = true
		var oldID *int64
		for _, previousID := range previous.SpecialtyIDs {
			if previousID == id {
				value := id
				oldID = &value
			}
		}
		if err := catalog.ValidateReference(ctx, reader, userID, &id, "specialty", oldID, false); err != nil {
			return err
		}
		item, err := reader.FindReference(ctx, userID, id)
		if err != nil {
			return err
		}
		allowed := oldID != nil && previous.PlatformID == task.PlatformID
		for _, platformID := range item.PlatformIDs {
			if platformID == task.PlatformID {
				allowed = true
			}
		}
		if !allowed {
			return domain.Invalid("Аудитория не относится к выбранной площадке")
		}
	}
	return catalog.ValidateReference(ctx, reader, userID, task.StatusID, "status", previous.StatusID, false)
}

func (service *Service) Delete(ctx context.Context, userID, id int64) error {
	return service.Repository.Delete(ctx, userID, id)
}
