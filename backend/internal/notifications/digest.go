package notifications

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
)

type digestTask struct {
	ID       int64
	Topic    string
	Deadline time.Time
	Status   string
}

func formatDigest(tasks []digestTask, now time.Time) string {
	start := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, now.Location())
	tomorrow := start.AddDate(0, 0, 1)
	end := tomorrow.AddDate(0, 0, 7)
	groups := make([][]digestTask, 3)
	for _, task := range tasks {
		switch {
		case task.Deadline.Before(start):
			groups[0] = append(groups[0], task)
		case task.Deadline.Before(tomorrow):
			groups[1] = append(groups[1], task)
		case task.Deadline.Before(end):
			groups[2] = append(groups[2], task)
		}
	}
	var text strings.Builder
	fmt.Fprintf(&text, "Утренняя сводка · %s\n", now.Format("02.01.2006"))
	for i, title := range []string{"Просроченные", "Сегодня", "Ближайшие 7 дней"} {
		fmt.Fprintf(&text, "\n%s: %d\n", title, len(groups[i]))
		for _, task := range groups[i][:min(len(groups[i]), 20)] {
			fmt.Fprintf(&text, "• #%d %.200s · %s · %s\n", task.ID, task.Topic, task.Deadline.In(now.Location()).Format("02.01 15:04"), task.Status)
		}
		if len(groups[i]) > 20 {
			fmt.Fprintf(&text, "…и ещё %d. Полный список — в приложении.\n", len(groups[i])-20)
		}
	}
	return text.String()
}

func (service *Service) sendDigest(ctx context.Context, userID int64) error {
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
	var lastDate *time.Time
	err = tx.QueryRow(ctx, `
 SELECT s.chat_id,s.digest_time,s.timezone,s.last_digest_date
 FROM telegram_settings s
 JOIN users u ON u.id=s.user_id
 WHERE s.user_id=$1 AND s.chat_id IS NOT NULL AND s.digest_enabled AND NOT u.disabled
 FOR UPDATE OF s SKIP LOCKED`, userID).Scan(&chatID, &clock, &zone, &lastDate)
	if err == pgx.ErrNoRows {
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
	if !digestDue(clock, lastDate, now) {
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
	if err := service.Telegram.Send(ctx, chatID, formatDigest(tasks, now)); err != nil {
		return err
	}
	if _, err := tx.Exec(ctx, `UPDATE telegram_settings SET last_digest_date=$2 WHERE user_id=$1`, userID, now.Format("2006-01-02")); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

func digestDue(clock string, lastDate *time.Time, now time.Time) bool {
	return now.Format("15:04") >= clock && (lastDate == nil || lastDate.Format("2006-01-02") < now.Format("2006-01-02"))
}
