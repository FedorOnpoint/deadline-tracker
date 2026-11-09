package tasks

import (
	"context"
	"encoding/json"

	"deadline-tracker/internal/database"
	"deadline-tracker/internal/domain"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type PostgresSharingRepository struct{ DB *pgxpool.Pool }
type postgresSharingTransaction struct{ tx pgx.Tx }

func (repo *PostgresSharingRepository) Transaction(ctx context.Context, run func(SharingTransaction) error) error {
	return database.InTransaction(ctx, repo.DB, func(tx pgx.Tx) error { return run(&postgresSharingTransaction{tx: tx}) })
}

func (repo *PostgresSharingRepository) ListShared(ctx context.Context, userID int64) ([]SharedTask, error) {
	result := []SharedTask{}
	err := database.InTransaction(ctx, repo.DB, func(tx pgx.Tx) error {
		rows, err := tx.Query(ctx, `SELECT task_id FROM task_members WHERE user_id=$1 ORDER BY task_id`, userID)
		if err != nil {
			return err
		}
		var ids []int64
		for rows.Next() {
			var id int64
			if err := rows.Scan(&id); err != nil {
				rows.Close()
				return err
			}
			ids = append(ids, id)
		}
		rows.Close()
		if err := rows.Err(); err != nil {
			return err
		}
		for _, id := range ids {
			shared, err := sharedContext(ctx, tx, userID, id)
			if err != nil {
				return err
			}
			result = append(result, shared)
		}
		return nil
	})
	return result, err
}

func sharedContext(ctx context.Context, tx pgx.Tx, userID, id int64) (SharedTask, error) {
	var result SharedTask
	// Membership changes take the same task lock, so access remains valid while reading context.
	var lockedID int64
	if err := tx.QueryRow(ctx, `
 SELECT id
 FROM tasks
 WHERE id=$1 AND (user_id=$2 OR EXISTS(SELECT 1
 FROM task_members m
 WHERE m.task_id=tasks.id AND m.user_id=$2)) FOR SHARE`, id, userID).Scan(&lockedID); err != nil {
		return result, err
	}
	repo := &postgresTransaction{tx: tx}
	task, err := repo.Get(ctx, userID, id)
	if err != nil {
		return result, err
	}
	normalizeAudiences(&task)
	if err := setDateDeadlines(&task); err != nil {
		return result, err
	}
	result.Task = task
	var fields []byte
	err = tx.QueryRow(ctx, `
 SELECT s.key,s.label,s.position,s.revision,s.fields,coalesce(s.parent_key,''),u.name
 FROM task_sections s
 JOIN users u ON u.id=s.user_id
 WHERE s.user_id=$1 AND s.key=$2`, task.OwnerID, task.Section).Scan(&result.Section.Key, &result.Section.Label, &result.Section.Position, &result.Section.Revision, &fields, &result.Section.ParentKey, &result.OwnerName)
	if err != nil {
		return result, err
	}
	if err := json.Unmarshal(fields, &result.Section.Fields); err != nil {
		return result, err
	}
	rows, err := tx.Query(ctx, `
 SELECT id,kind,name,color,position,archived,section,platform_ids,reminder_text
 FROM catalog
 WHERE user_id=$1 AND (kind='status' OR id=$2 OR (kind='specialty' AND ($2=ANY(platform_ids) OR id=ANY($3::bigint[]))))
 ORDER BY kind,position,id`, task.OwnerID, task.PlatformID, task.SpecialtyIDs)
	if err != nil {
		return result, err
	}
	defer rows.Close()
	result.Catalog = []domain.Catalog{}
	for rows.Next() {
		var entry domain.Catalog
		if err := rows.Scan(&entry.ID, &entry.Kind, &entry.Name, &entry.Color, &entry.Position, &entry.Archived, &entry.Section, &entry.PlatformIDs, &entry.ReminderText); err != nil {
			return result, err
		}
		result.Catalog = append(result.Catalog, entry)
	}
	return result, rows.Err()
}

func (repo *postgresSharingTransaction) LockOwner(ctx context.Context, userID, taskID int64) error {
	var id int64
	return repo.tx.QueryRow(ctx, `SELECT id FROM tasks WHERE id=$1 AND user_id=$2 FOR UPDATE`, taskID, userID).Scan(&id)
}

func (repo *postgresSharingTransaction) ListMembers(ctx context.Context, taskID int64) ([]Member, error) {
	rows, err := repo.tx.Query(ctx, `
 SELECT u.id,u.login,u.name,u.avatar IS NOT NULL
 FROM task_members m
 JOIN users u ON u.id=m.user_id
 WHERE m.task_id=$1
 ORDER BY lower(u.name),u.id`, taskID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	members := []Member{}
	for rows.Next() {
		var member Member
		if err := rows.Scan(&member.ID, &member.Login, &member.Name, &member.HasAvatar); err != nil {
			return nil, err
		}
		members = append(members, member)
	}
	return members, rows.Err()
}

func (repo *postgresSharingTransaction) FindMember(ctx context.Context, login string) (Member, error) {
	var member Member
	err := repo.tx.QueryRow(ctx, `SELECT id,login,name FROM users WHERE lower(login)=lower($1) AND NOT disabled`, login).Scan(&member.ID, &member.Login, &member.Name)
	return member, err
}

func (repo *postgresSharingTransaction) AddMember(ctx context.Context, taskID, memberID int64) error {
	_, err := repo.tx.Exec(ctx, `INSERT INTO task_members(task_id,user_id) VALUES($1,$2) ON CONFLICT DO NOTHING`, taskID, memberID)
	return err
}

func (repo *postgresSharingTransaction) RemoveMember(ctx context.Context, taskID, memberID int64) error {
	_, err := repo.tx.Exec(ctx, `DELETE FROM task_members WHERE task_id=$1 AND user_id=$2`, taskID, memberID)
	return err
}

func (repo *postgresSharingTransaction) ListCandidates(ctx context.Context, ownerID int64) ([]Member, error) {
	rows, err := repo.tx.Query(ctx, `SELECT id,login,name,avatar IS NOT NULL FROM users WHERE NOT disabled AND id<>$1 ORDER BY lower(name),lower(login),id`, ownerID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	users := []Member{}
	for rows.Next() {
		var user Member
		if err := rows.Scan(&user.ID, &user.Login, &user.Name, &user.HasAvatar); err != nil {
			return nil, err
		}
		users = append(users, user)
	}
	return users, rows.Err()
}
