package database

import (
	"context"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

func InTransaction(ctx context.Context, db *pgxpool.Pool, run func(pgx.Tx) error) error {
	tx, err := db.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)
	if err := run(tx); err != nil {
		return err
	}
	return tx.Commit(ctx)
}
