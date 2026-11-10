package sections

import (
	"context"

	"deadline-tracker/internal/catalog"
	"deadline-tracker/internal/domain"
)

func ValidateCompletionStatuses(ctx context.Context, reader catalog.ReferenceReader, userID int64, fields, previous []domain.CardField) error {
	oldStatuses := map[string]*int64{}
	for _, field := range previous {
		oldStatuses[field.ID] = field.CompletionStatusID
	}
	for _, field := range fields {
		if err := catalog.ValidateReference(ctx, reader, userID, field.CompletionStatusID, "status", oldStatuses[field.ID], false); err != nil {
			return err
		}
	}
	return nil
}
