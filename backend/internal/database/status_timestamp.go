package database

import (
	"context"

	"github.com/jackc/pgx/v5"
)

func initializeStatusTimestamp(ctx context.Context, tx pgx.Tx) error {
	tag, err := tx.Exec(ctx, "INSERT INTO migrations(name) VALUES('status_changed_at_v1') ON CONFLICT DO NOTHING")
	if err != nil || tag.RowsAffected() == 0 {
		return err
	}
	_, err = tx.Exec(ctx, "ALTER TABLE tasks ADD COLUMN status_changed_at timestamptz")
	return err
}
