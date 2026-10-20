package tasks

import (
	"context"
	"encoding/json"

	"deadline-tracker/internal/catalog"
	"deadline-tracker/internal/database"
	"deadline-tracker/internal/domain"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type PostgresRepository struct{ DB *pgxpool.Pool }
type postgresTransaction struct {
	tx pgx.Tx
	catalog.PostgresReferences
}

func (repo *PostgresRepository) Transaction(ctx context.Context, run func(Transaction) error) error {
	return database.InTransaction(ctx, repo.DB, func(tx pgx.Tx) error {
		return run(&postgresTransaction{tx: tx, PostgresReferences: catalog.PostgresReferences{DB: tx}})
	})
}

func (repo *PostgresRepository) List(ctx context.Context, userID int64) ([]domain.Task, error) {
	rows, err := repo.DB.Query(ctx, "SELECT "+taskJSON+" FROM tasks WHERE user_id=$1 ORDER BY completed,deadline,id", userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	tasks := []domain.Task{}
	for rows.Next() {
		var raw []byte
		var task domain.Task
		if err := rows.Scan(&raw); err != nil {
			return nil, err
		}
		if err := json.Unmarshal(raw, &task); err != nil {
			return nil, err
		}
		tasks = append(tasks, task)
	}
	return tasks, rows.Err()
}

func (repo *PostgresRepository) Delete(ctx context.Context, userID, id int64) error {
	tag, err := repo.DB.Exec(ctx, "DELETE FROM tasks WHERE id=$1 AND user_id=$2", id, userID)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return domain.ErrNotFound
	}
	return nil
}

func (repo *postgresTransaction) Lock(ctx context.Context, userID, id int64) (domain.Task, error) {
	if err := repo.tx.QueryRow(ctx, "SELECT id FROM tasks WHERE id=$1 AND user_id=$2 FOR UPDATE", id, userID).Scan(&id); err != nil {
		return domain.Task{}, err
	}
	return repo.Get(ctx, userID, id)
}

func (repo *postgresTransaction) Insert(ctx context.Context, userID int64, task domain.Task) (int64, error) {
	raw, err := taskData(task)
	if err != nil {
		return 0, err
	}
	var id int64
	err = repo.tx.QueryRow(ctx, `
 INSERT INTO tasks(
   platform_id, specialty_id, status_id, deadline, email_date,
   data, completed, completed_at, user_id
 ) VALUES(
   $1, $2, $3, $4, NULLIF($5, '')::date,
   $6, $7, CASE WHEN $7 THEN now() ELSE NULL END, $8
 ) RETURNING id`,
		task.PlatformID, task.SpecialtyID, task.StatusID, task.Deadline,
		task.EmailDate, raw, task.Completed, userID,
	).Scan(&id)
	return id, err
}

func (repo *postgresTransaction) Update(ctx context.Context, userID, id int64, task domain.Task, newCycle bool) error {
	raw, err := taskData(task)
	if err != nil {
		return err
	}
	_, err = repo.tx.Exec(ctx, `
 UPDATE tasks SET
   platform_id = $2,
   specialty_id = $3,
   status_id = $4,
   deadline = $5,
   email_date = NULLIF($6, '')::date,
   data = $7,
   completed = $8,
   completed_at = CASE WHEN $8 THEN coalesce(completed_at, now()) ELSE NULL END,
   updated_at = now(),
   cycle = cycle + CASE WHEN $9 THEN 1 ELSE 0 END
 WHERE id = $1 AND user_id = $10`,
		id, task.PlatformID, task.SpecialtyID, task.StatusID, task.Deadline,
		task.EmailDate, raw, task.Completed, newCycle, userID,
	)
	return err
}

func taskData(task domain.Task) ([]byte, error) {
	return json.Marshal(map[string]any{
		"topic":         task.Topic,
		"project":       task.Project,
		"header":        task.Header,
		"preheader":     task.Preheader,
		"comment":       task.Comment,
		"owner":         task.Owner,
		"custom_fields": task.CustomFields,
	})
}

func (repo *postgresTransaction) CardFields(ctx context.Context, userID, platformID int64) ([]domain.CardField, error) {
	var raw []byte
	err := repo.tx.QueryRow(ctx, `SELECT s.fields FROM task_sections s JOIN catalog c ON c.user_id=s.user_id AND c.section=s.key WHERE c.user_id=$1 AND c.id=$2 FOR SHARE OF s,c`, userID, platformID).Scan(&raw)
	if err != nil {
		return nil, err
	}
	var fields []domain.CardField
	err = json.Unmarshal(raw, &fields)
	return fields, err
}

func (repo *postgresTransaction) ClaimExamples(ctx context.Context, userID int64) (bool, error) {
	tag, err := repo.tx.Exec(ctx, "INSERT INTO user_demos(user_id) VALUES($1) ON CONFLICT DO NOTHING", userID)
	return tag.RowsAffected() > 0, err
}

func (repo *postgresTransaction) ActiveCatalogIDs(ctx context.Context, userID int64, kind string) ([]int64, error) {
	rows, err := repo.tx.Query(ctx, "SELECT id FROM catalog WHERE kind=$1 AND NOT archived AND user_id=$2 ORDER BY position,id", kind, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	ids := []int64{}
	for rows.Next() {
		var id int64
		if err := rows.Scan(&id); err != nil {
			return nil, err
		}
		ids = append(ids, id)
	}
	return ids, rows.Err()
}
