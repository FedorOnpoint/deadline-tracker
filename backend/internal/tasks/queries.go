package tasks

import (
	"context"
	"encoding/json"

	"deadline-tracker/internal/domain"
)

const taskJSON = `data || jsonb_build_object(
 'custom_fields', coalesce(nullif(data->'custom_fields', 'null'::jsonb), '{}'::jsonb),
 'id', id,
 'owner_id', user_id,
 'members', coalesce((
   SELECT jsonb_agg(jsonb_build_object(
     'id', u.id, 'login', u.login, 'name', u.name, 'has_avatar', u.avatar IS NOT NULL
   ) ORDER BY lower(u.name), u.id)
   FROM task_members m
   JOIN users u ON u.id=m.user_id
   WHERE m.task_id=tasks.id
 ), '[]'::jsonb),
 'platform_id', coalesce(platform_id, 0),
 'section', section,
 'specialty_id', specialty_id,
 'status_id', status_id,
 'status_changed_at', status_changed_at,
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
	err := repo.tx.QueryRow(ctx, "SELECT "+taskJSON+" FROM tasks WHERE id=$1 AND (user_id=$2 OR EXISTS(SELECT 1 FROM task_members m WHERE m.task_id=tasks.id AND m.user_id=$2))", id, userID).Scan(&raw)
	if err != nil {
		return task, err
	}
	err = json.Unmarshal(raw, &task)
	return task, err
}
