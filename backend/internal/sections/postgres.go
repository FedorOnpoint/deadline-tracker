package sections

import (
	"context"
	"encoding/json"

	"deadline-tracker/internal/database"
	"deadline-tracker/internal/domain"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type PostgresRepository struct{ DB *pgxpool.Pool }
type postgresTransaction struct{ tx pgx.Tx }

type queryer interface {
	Query(context.Context, string, ...any) (pgx.Rows, error)
}

func list(ctx context.Context, db queryer, userID int64, lock bool) ([]domain.TaskSection, error) {
	sql := "SELECT key,label,position,revision,fields,deadline_field FROM task_sections WHERE user_id=$1 ORDER BY position,key"
	if lock {
		sql += " FOR UPDATE"
	}
	rows, err := db.Query(ctx, sql, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	sections := []domain.TaskSection{}
	for rows.Next() {
		var section domain.TaskSection
		var raw []byte
		if err := rows.Scan(&section.Key, &section.Label, &section.Position, &section.Revision, &raw, &section.DeadlineField); err != nil {
			return nil, err
		}
		if err := json.Unmarshal(raw, &section.Fields); err != nil {
			return nil, err
		}
		sections = append(sections, section)
	}
	return sections, rows.Err()
}

func (r *PostgresRepository) List(ctx context.Context, userID int64) ([]domain.TaskSection, error) {
	return list(ctx, r.DB, userID, false)
}
func (r *postgresTransaction) List(ctx context.Context, userID int64) ([]domain.TaskSection, error) {
	return list(ctx, r.tx, userID, true)
}

func (r *PostgresRepository) Transaction(ctx context.Context, run func(Transaction) error) error {
	return database.InTransaction(ctx, r.DB, func(tx pgx.Tx) error {
		if _, err := tx.Exec(ctx, "SELECT pg_advisory_xact_lock(71248903)"); err != nil {
			return err
		}
		return run(&postgresTransaction{tx: tx})
	})
}

func (r *postgresTransaction) Insert(ctx context.Context, userID int64, section domain.TaskSection) error {
	raw, err := json.Marshal(section.Fields)
	if err != nil {
		return err
	}
	_, err = r.tx.Exec(ctx, "INSERT INTO task_sections(user_id,key,label,position,revision,fields) VALUES($1,$2,$3,$4,$5,$6)", userID, section.Key, section.Label, section.Position, section.Revision, raw)
	return err
}

func (r *postgresTransaction) Update(ctx context.Context, userID int64, section domain.TaskSection) error {
	raw, err := json.Marshal(section.Fields)
	if err != nil {
		return err
	}
	_, err = r.tx.Exec(ctx, "UPDATE task_sections SET label=$3,position=$4,revision=$5,fields=$6,deadline_field=$7 WHERE user_id=$1 AND key=$2", userID, section.Key, section.Label, section.Position, section.Revision, raw, section.DeadlineField)
	return err
}

func (r *postgresTransaction) InUse(ctx context.Context, userID int64, key string) (bool, error) {
	var used bool
	err := r.tx.QueryRow(ctx, "SELECT EXISTS(SELECT 1 FROM catalog WHERE user_id=$1 AND kind='platform' AND section=$2) OR EXISTS(SELECT 1 FROM tasks WHERE user_id=$1 AND section=$2)", userID, key).Scan(&used)
	return used, err
}

func (r *postgresTransaction) Delete(ctx context.Context, userID int64, key string) error {
	_, err := r.tx.Exec(ctx, "DELETE FROM task_sections WHERE user_id=$1 AND key=$2", userID, key)
	return err
}
