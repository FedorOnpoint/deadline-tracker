package catalog

import (
	"context"
	"fmt"

	"deadline-tracker/internal/domain"
)

type ReferenceReader interface {
	FindReference(ctx context.Context, userID, itemID int64) (*domain.Catalog, error)
}

func ValidateReference(ctx context.Context, reader ReferenceReader, userID int64, id *int64, kind string, oldID *int64, required bool) error {
	if id == nil {
		if required {
			return domain.Invalid("Укажите площадку")
		}
		return nil
	}
	item, err := reader.FindReference(ctx, userID, *id)
	if err != nil {
		return err
	}
	if item == nil {
		return domain.Invalid("Значение справочника не найдено")
	}
	if item.Kind != kind {
		return domain.Invalid("Значение относится к другому справочнику")
	}
	if item.Archived && (oldID == nil || *oldID != *id) {
		return domain.Invalid(fmt.Sprintf("Значение справочника «%s» архивировано", kind))
	}
	return nil
}
