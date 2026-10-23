package sections

import (
	"context"
	"crypto/rand"
	"strings"
	"unicode/utf8"

	"deadline-tracker/internal/domain"
)

type Repository interface {
	List(context.Context, int64) ([]domain.TaskSection, error)
	Transaction(context.Context, func(Transaction) error) error
}

type Transaction interface {
	List(context.Context, int64) ([]domain.TaskSection, error)
	Insert(context.Context, int64, domain.TaskSection) error
	Update(context.Context, int64, domain.TaskSection) error
	Delete(context.Context, int64, string) error
	InUse(context.Context, int64, string) (bool, error)
}

type Service struct{ Repository Repository }

func (s *Service) List(ctx context.Context, userID int64) ([]domain.TaskSection, error) {
	return s.Repository.List(ctx, userID)
}

func (s *Service) Save(ctx context.Context, userID int64, key string, input domain.TaskSection) (domain.TaskSection, error) {
	input.Label = strings.TrimSpace(input.Label)
	if input.Label == "" || utf8.RuneCountInString(input.Label) > 150 {
		return input, domain.Invalid("Название раздела: от 1 до 150 символов")
	}
	if input.Position < 0 || input.Position > 1000000 {
		return input, domain.Invalid("Некорректный порядок раздела")
	}
	err := s.Repository.Transaction(ctx, func(tx Transaction) error {
		all, err := tx.List(ctx, userID)
		if err != nil {
			return err
		}
		if key == "" {
			if len(all) >= 100 {
				return domain.Invalid("Допускается не более 100 разделов")
			}
			input.Key, input.Position, input.Revision = "section_"+rand.Text(), len(all), 1
			input.Fields = domain.DefaultCardFields()
			return tx.Insert(ctx, userID, input)
		}
		for _, old := range all {
			if old.Key != key {
				continue
			}
			if old.Revision != input.Revision {
				return domain.AlreadyExists("Раздел изменён в другом окне. Закройте конструктор и обновите данные.")
			}
			if err := ValidateFields(input.Fields, old.Fields); err != nil {
				return err
			}
			if err := ValidateDeadlineField(input.Fields, input.DeadlineField); err != nil {
				return err
			}
			input.Key = key
			input.Revision++
			if input.Position >= len(all) {
				input.Position = len(all) - 1
			}
			// Persist a contiguous order, including revisions for displaced sections.
			ordered := make([]domain.TaskSection, 0, len(all))
			for _, section := range all {
				if section.Key != key {
					ordered = append(ordered, section)
				}
			}
			ordered = append(ordered, domain.TaskSection{})
			copy(ordered[input.Position+1:], ordered[input.Position:])
			ordered[input.Position] = input
			for position, section := range ordered {
				if section.Key != key && section.Position == position {
					continue
				}
				if section.Key != key {
					section.Revision++
				}
				section.Position = position
				if err := tx.Update(ctx, userID, section); err != nil {
					return err
				}
			}
			return nil
		}
		return domain.ErrNotFound
	})
	return input, err
}

func (s *Service) Delete(ctx context.Context, userID int64, key string) error {
	return s.Repository.Transaction(ctx, func(tx Transaction) error {
		all, err := tx.List(ctx, userID)
		if err != nil {
			return err
		}
		found := false
		for _, section := range all {
			if section.Key == key {
				found = true
			}
		}
		if !found {
			return domain.ErrNotFound
		}
		if len(all) <= 1 {
			return domain.Invalid("Нужно оставить хотя бы один раздел")
		}
		used, err := tx.InUse(ctx, userID, key)
		if err != nil {
			return err
		}
		if used {
			return domain.AlreadyExists("Раздел содержит карточки или площадки. Сначала перенесите их в другой раздел.")
		}
		if err := tx.Delete(ctx, userID, key); err != nil {
			return err
		}
		position := 0
		for _, section := range all {
			if section.Key == key {
				continue
			}
			if section.Position != position {
				section.Position = position
				section.Revision++
				if err := tx.Update(ctx, userID, section); err != nil {
					return err
				}
			}
			position++
		}
		return nil
	})
}
