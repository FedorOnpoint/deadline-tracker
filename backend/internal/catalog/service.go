package catalog

import (
	"context"

	"deadline-tracker/internal/domain"
)

type Repository interface {
	List(ctx context.Context, userID int64) ([]domain.Catalog, error)
	Transaction(ctx context.Context, run func(Transaction) error) error
}

type Transaction interface {
	Lock(ctx context.Context, userID, itemID int64) (domain.Catalog, error)
	NameExists(ctx context.Context, userID int64, item domain.Catalog) (bool, error)
	NextPosition(ctx context.Context, userID int64, kind string) (int, error)
	Insert(ctx context.Context, userID int64, item domain.Catalog) (int64, error)
	Move(ctx context.Context, userID int64, item domain.Catalog, oldPosition int) error
	Update(ctx context.Context, userID int64, item domain.Catalog) error
}

type Service struct{ Repository Repository }

func (service *Service) List(ctx context.Context, userID int64) ([]domain.Catalog, error) {
	return service.Repository.List(ctx, userID)
}

func (service *Service) Save(ctx context.Context, userID, id int64, item domain.Catalog) (domain.Catalog, error) {
	if err := validateItem(&item); err != nil {
		return domain.Catalog{}, err
	}
	err := service.Repository.Transaction(ctx, func(tx Transaction) error {
		var previous domain.Catalog
		var err error
		if id != 0 {
			item.ID = id
			previous, err = tx.Lock(ctx, userID, id)
			if err != nil {
				return err
			}
		}
		duplicate, err := tx.NameExists(ctx, userID, item)
		if err != nil {
			return err
		}
		if duplicate {
			return domain.AlreadyExists("Такое название уже существует, в том числе в архиве")
		}
		if id == 0 {
			if item.Section == "" {
				item.Section = "special"
			}
			item.Position, err = tx.NextPosition(ctx, userID, item.Kind)
			if err != nil {
				return err
			}
			item.ID, err = tx.Insert(ctx, userID, item)
			return err
		}
		if previous.Kind != item.Kind {
			return domain.Invalid("Нельзя менять тип существующего значения")
		}
		if item.Section == "" {
			item.Section = previous.Section
		}
		if err := tx.Move(ctx, userID, item, previous.Position); err != nil {
			return err
		}
		return tx.Update(ctx, userID, item)
	})
	return item, err
}
