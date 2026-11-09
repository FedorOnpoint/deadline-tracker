package notifications

import (
	"context"
	"time"

	"deadline-tracker/internal/domain"

	"github.com/jackc/pgx/v5"
)

type digestTask struct {
	ID       int64
	Topic    string
	Deadline time.Time
	Status   string
}

// SendDigestNow sends a separate preview without consuming today's scheduled digest.
func (service *Service) SendDigestNow(ctx context.Context, userID int64) error {
	if service.Telegram == nil {
		return ErrTelegramUnavailable
	}
	return service.deliverDigest(ctx, userID, true)
}

func (service *Service) sendDigest(ctx context.Context, userID int64) error {
	return service.deliverDigest(ctx, userID, false)
}

func (service *Service) deliverDigest(ctx context.Context, userID int64, manual bool) error {
	tx, err := service.DB.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)
	// Lock accessible tasks first, matching edits and access revocation. Settings are locked second.
	rows, err := tx.Query(ctx, `
 SELECT id
 FROM tasks
 WHERE user_id=$1 OR EXISTS(SELECT 1
 FROM task_members m
 WHERE m.task_id=tasks.id AND m.user_id=$1)
 ORDER BY id FOR SHARE`, userID)
	if err != nil {
		return err
	}
	var taskIDs []int64
	for rows.Next() {
		var id int64
		if err := rows.Scan(&id); err != nil {
			rows.Close()
			return err
		}
		taskIDs = append(taskIDs, id)
	}
	rows.Close()
	if err := rows.Err(); err != nil {
		return err
	}
	var chatID int64
	var clock, zone string
	var lastDate, lastManual *time.Time
	err = tx.QueryRow(ctx, `
 SELECT s.chat_id,s.digest_time,s.timezone,s.last_digest_date,s.last_manual_digest_at
 FROM telegram_settings s
 JOIN users u ON u.id=s.user_id
 WHERE s.user_id=$1 AND s.chat_id IS NOT NULL AND ($2 OR s.digest_enabled) AND NOT u.disabled
 FOR UPDATE OF s SKIP LOCKED`, userID, manual).Scan(&chatID, &clock, &zone, &lastDate, &lastManual)
	if err == pgx.ErrNoRows {
		if manual {
			return domain.AlreadyExists("Подключите Telegram или дождитесь завершения предыдущей отправки")
		}
		return nil
	}
	if err != nil {
		return err
	}
	loc, err := time.LoadLocation(zone)
	if err != nil {
		return err
	}
	now := time.Now().In(loc)
	if manual && lastManual != nil && now.Sub(*lastManual) < time.Minute {
		return domain.AlreadyExists("Сводка уже отправлена. Повторить можно через минуту")
	}
	if !manual && !digestDue(clock, lastDate, now) {
		return nil
	}
	tasks := []digestTask{}
	rows, err = tx.Query(ctx, `
 SELECT t.id,coalesce(t.data->>'topic',''),t.deadline,coalesce(c.name,'Не задан')
 FROM tasks t
 LEFT JOIN catalog c ON c.id=t.status_id
 WHERE t.id=ANY($3::bigint[]) AND NOT t.completed AND t.deadline<$2 AND (t.user_id=$1 OR EXISTS(SELECT 1
 FROM task_members m
 WHERE m.task_id=t.id AND m.user_id=$1))
 ORDER BY t.deadline,t.id`, userID, time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, loc).AddDate(0, 0, 8), taskIDs)
	if err != nil {
		return err
	}
	for rows.Next() {
		var task digestTask
		if err := rows.Scan(&task.ID, &task.Topic, &task.Deadline, &task.Status); err != nil {
			rows.Close()
			return err
		}
		tasks = append(tasks, task)
	}
	rows.Close()
	if err := rows.Err(); err != nil {
		return err
	}
	messages := formatDigestMessages(tasks, now)
	if err := service.Telegram.SendFormatted(ctx, chatID, messages, service.AppURL); err != nil {
		return err
	}
	if manual {
		_, err = tx.Exec(ctx, `UPDATE telegram_settings SET last_manual_digest_at=now() WHERE user_id=$1`, userID)
	} else {
		_, err = tx.Exec(ctx, `UPDATE telegram_settings SET last_digest_date=$2 WHERE user_id=$1`, userID, now.Format("2006-01-02"))
	}
	if err != nil {
		return err
	}
	return tx.Commit(ctx)
}

func digestDue(clock string, lastDate *time.Time, now time.Time) bool {
	return now.Format("15:04") >= clock && (lastDate == nil || lastDate.Format("2006-01-02") < now.Format("2006-01-02"))
}
