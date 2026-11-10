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

type StatusChangeRecorder interface {
	Record(ctx context.Context, tx pgx.Tx, actorID int64, previous, current domain.Task) error
}

type PostgresRepository struct {
	DB            *pgxpool.Pool
	StatusChanges StatusChangeRecorder
}
type postgresTransaction struct {
	tx            pgx.Tx
	StatusChanges StatusChangeRecorder
	catalog.PostgresReferences
}

func (repo *PostgresRepository) Transaction(ctx context.Context, run func(Transaction) error) error {
	return database.InTransaction(ctx, repo.DB, func(tx pgx.Tx) error {
		return run(&postgresTransaction{tx: tx, StatusChanges: repo.StatusChanges, PostgresReferences: catalog.PostgresReferences{DB: tx}})
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
	if err := repo.tx.QueryRow(ctx, "SELECT id FROM tasks WHERE id=$1 AND (user_id=$2 OR EXISTS(SELECT 1 FROM task_members m WHERE m.task_id=tasks.id AND m.user_id=$2)) FOR UPDATE", id, userID).Scan(&id); err != nil {
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
   data, completed, completed_at, user_id, section, status_changed_at
 ) VALUES(
   $1, $2, $3, $4, NULLIF($5, '')::date,
   $6, $7, CASE WHEN $7 THEN now() ELSE NULL END, $8, $9, CASE WHEN $3::bigint IS NOT NULL THEN now() ELSE NULL END
 ) RETURNING id`,
		nullPlatform(task.PlatformID), task.SpecialtyID, task.StatusID, task.Deadline,
		task.EmailDate, raw, task.Completed, userID, task.Section,
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
   section = $11,
   specialty_id = $3,
   status_changed_at = CASE
     WHEN status_id IS NOT DISTINCT FROM $4::bigint THEN status_changed_at
     WHEN $4::bigint IS NULL THEN NULL
     ELSE now()
   END,
   status_id = $4,
   deadline = $5,
   email_date = NULLIF($6, '')::date,
   data = $7,
   completed = $8,
   completed_at = CASE WHEN $8 THEN coalesce(completed_at, now()) ELSE NULL END,
   updated_at = now(),
   cycle = cycle + CASE WHEN $9 THEN 1 ELSE 0 END
 WHERE id = $1 AND user_id = $10`,
		id, nullPlatform(task.PlatformID), task.SpecialtyID, task.StatusID, task.Deadline,
		task.EmailDate, raw, task.Completed, newCycle, userID, task.Section,
	)
	return err
}

func taskData(task domain.Task) ([]byte, error) {
	return json.Marshal(map[string]any{
		"completed_date_fields": task.CompletedDateFields,
		"has_active_deadlines":  task.HasActiveDeadlines,
		"specialty_ids":         task.SpecialtyIDs,
		"sms":                   task.SMS,
		"topic":                 task.Topic,
		"project":               task.Project,
		"header":                task.Header,
		"preheader":             task.Preheader,
		"comment":               task.Comment,
		"owner":                 task.Owner,
		"custom_fields":         task.CustomFields,
		"fields":                task.Fields,
		"base_date":             task.BaseDate,
		"deadline_field":        task.DeadlineField,
		"timezone":              task.Timezone,
	})
}

func nullPlatform(id int64) any {
	if id == 0 {
		return nil
	}
	return id
}

func (repo *postgresTransaction) CardFields(ctx context.Context, userID int64, section string) ([]domain.CardField, error) {
	if err := database.LockLeafSection(ctx, repo.tx, userID, section); err != nil {
		return nil, err
	}
	var raw []byte
	err := repo.tx.QueryRow(ctx, `SELECT fields FROM task_sections WHERE user_id=$1 AND key=$2 FOR SHARE`, userID, section).Scan(&raw)
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

func (repo *postgresTransaction) RecordStatusChange(ctx context.Context, actorID int64, previous, current domain.Task) error {
	return repo.StatusChanges.Record(ctx, repo.tx, actorID, previous, current)
}
