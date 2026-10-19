package tasks

import (
	"context"
	"encoding/json"

	"deadline-tracker/internal/domain"
)

const taskJSON = `data || jsonb_build_object(
 'id', id,
 'platform_id', platform_id,
 'specialty_id', specialty_id,
 'status_id', status_id,
 'deadline', deadline,
 'email_date', coalesce(email_date::text, ''),
 'completed', completed,
 'completed_at', completed_at,
 'created_at', created_at,
 'updated_at', updated_at
)`

func (repo *postgresTransaction) Get(ctx context.Context, userID, id int64) (domain.Task, error) {
	var task domain.Task
	var raw []byte
	err := repo.tx.QueryRow(ctx, "SELECT "+taskJSON+" FROM tasks WHERE id=$1 AND user_id=$2", id, userID).Scan(&raw)
	if err != nil {
		return task, err
	}
	err = json.Unmarshal(raw, &task)
	return task, err
}
