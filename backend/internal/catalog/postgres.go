package catalog

import (
	"context"
	"errors"

	"deadline-tracker/internal/database"
	"deadline-tracker/internal/domain"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type PostgresRepository struct{ DB *pgxpool.Pool }
type postgresTransaction struct{ tx pgx.Tx }

type PostgresReferences struct {
	DB interface {
		QueryRow(context.Context, string, ...any) pgx.Row
	}
}

func (reader PostgresReferences) FindReference(ctx context.Context, userID, id int64) (*domain.Catalog, error) {
	item := &domain.Catalog{ID: id}
	err := reader.DB.QueryRow(ctx, "SELECT kind,archived,section,platform_ids FROM catalog WHERE id=$1 AND user_id=$2 FOR SHARE", id, userID).Scan(&item.Kind, &item.Archived, &item.Section, &item.PlatformIDs)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	return item, err
}

func (repo *PostgresRepository) List(ctx context.Context, userID int64) ([]domain.Catalog, error) {
	rows, err := repo.DB.Query(ctx, "SELECT id,kind,name,color,position,archived,section,platform_ids,reminder_text FROM catalog WHERE user_id=$1 ORDER BY kind,position,id", userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	items := []domain.Catalog{}
	for rows.Next() {
		var item domain.Catalog
		if err := rows.Scan(&item.ID, &item.Kind, &item.Name, &item.Color, &item.Position, &item.Archived, &item.Section, &item.PlatformIDs, &item.ReminderText); err != nil {
			return nil, err
		}
		items = append(items, item)
	}
	return items, rows.Err()
}

func (repo *PostgresRepository) Transaction(ctx context.Context, run func(Transaction) error) error {
	return database.InTransaction(ctx, repo.DB, func(tx pgx.Tx) error {
		// Serialize ordering and duplicate-name checks across dictionary writes.
		if _, err := tx.Exec(ctx, "SELECT pg_advisory_xact_lock(71248902)"); err != nil {
			return err
		}
		return run(&postgresTransaction{tx: tx})
	})
}

func (repo *postgresTransaction) Lock(ctx context.Context, userID, id int64) (domain.Catalog, error) {
	item := domain.Catalog{ID: id}
	// Task saves lock the task before its catalog references. Use the same order when moving a platform.
	if _, err := repo.tx.Exec(ctx, "SELECT id FROM tasks WHERE user_id=$1 AND platform_id=$2 ORDER BY id FOR UPDATE", userID, id); err != nil {
		return item, err
	}
	err := repo.tx.QueryRow(ctx, "SELECT kind,position,section,platform_ids FROM catalog WHERE id=$1 AND user_id=$2 FOR UPDATE", id, userID).Scan(&item.Kind, &item.Position, &item.Section, &item.PlatformIDs)
	return item, err
}

func (repo *postgresTransaction) NameExists(ctx context.Context, userID int64, item domain.Catalog) (bool, error) {
	var duplicate bool
	err := repo.tx.QueryRow(ctx, "SELECT EXISTS(SELECT 1 FROM catalog WHERE kind=$1 AND lower(btrim(name))=lower($2) AND id<>$3 AND user_id=$4)", item.Kind, item.Name, item.ID, userID).Scan(&duplicate)
	return duplicate, err
}

func (repo *postgresTransaction) NextPosition(ctx context.Context, userID int64, kind string) (int, error) {
	var position int
	err := repo.tx.QueryRow(ctx, "SELECT coalesce(max(position),-1)+1 FROM catalog WHERE kind=$1 AND user_id=$2", kind, userID).Scan(&position)
	return position, err
}

func (repo *postgresTransaction) Insert(ctx context.Context, userID int64, item domain.Catalog) (int64, error) {
	var id int64
	err := repo.tx.QueryRow(ctx, "INSERT INTO catalog(kind,name,color,position,archived,section,user_id,platform_ids,reminder_text) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id", item.Kind, item.Name, item.Color, item.Position, item.Archived, item.Section, userID, item.PlatformIDs, item.ReminderText).Scan(&id)
	return id, err
}

func (repo *postgresTransaction) Move(ctx context.Context, userID int64, item domain.Catalog, oldPosition int) error {
	var err error
	if item.Position < oldPosition {
		_, err = repo.tx.Exec(ctx, "UPDATE catalog SET position=position+1 WHERE kind=$1 AND id<>$2 AND position >= $3 AND position < $4 AND user_id=$5", item.Kind, item.ID, item.Position, oldPosition, userID)
	} else if item.Position > oldPosition {
		_, err = repo.tx.Exec(ctx, "UPDATE catalog SET position=position-1 WHERE kind=$1 AND id<>$2 AND position > $3 AND position <= $4 AND user_id=$5", item.Kind, item.ID, oldPosition, item.Position, userID)
	}
	return err
}

func (repo *postgresTransaction) Update(ctx context.Context, userID int64, item domain.Catalog) error {
	_, err := repo.tx.Exec(ctx, "UPDATE catalog SET name=$2,color=$3,position=$4,archived=$5,section=$6,platform_ids=$8,reminder_text=$9 WHERE id=$1 AND user_id=$7", item.ID, item.Name, item.Color, item.Position, item.Archived, item.Section, userID, item.PlatformIDs, item.ReminderText)
	if err == nil && item.Kind == "platform" {
		_, err = repo.tx.Exec(ctx, "UPDATE tasks SET section=$3 WHERE user_id=$1 AND platform_id=$2 AND section<>$3", userID, item.ID, item.Section)
	}
	return err
}

func (repo *postgresTransaction) FindReference(ctx context.Context, userID, id int64) (*domain.Catalog, error) {
	return (PostgresReferences{DB: repo.tx}).FindReference(ctx, userID, id)
}
