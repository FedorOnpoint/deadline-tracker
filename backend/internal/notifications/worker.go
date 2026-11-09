package notifications

import (
	"context"
	"errors"
	"log/slog"
	"time"

	"github.com/jackc/pgx/v5"
)

func (service *Service) TickTelegram(ctx context.Context) error {
	var failures error
	if err := service.pollTelegram(ctx); err != nil {
		slog.Error("telegram_poll_error", "error", err)
		failures = errors.Join(failures, err)
	}
	rows, err := service.DB.Query(ctx, `
 SELECT o.id
 FROM telegram_outbox o
 WHERE o.delivered_at IS NULL AND o.next_attempt_at<=now() AND NOT EXISTS(SELECT 1
 FROM telegram_outbox earlier
 WHERE earlier.task_id=o.task_id AND earlier.user_id=o.user_id AND earlier.id<o.id AND earlier.delivered_at IS NULL)
 ORDER BY o.id LIMIT 100`)
	if err != nil {
		return errors.Join(failures, err)
	}
	var events []int64
	for rows.Next() {
		var id int64
		if err := rows.Scan(&id); err != nil {
			rows.Close()
			return errors.Join(failures, err)
		}
		events = append(events, id)
	}
	rows.Close()
	if err := rows.Err(); err != nil {
		return errors.Join(failures, err)
	}
	for _, id := range events {
		if err := service.deliverStatus(ctx, id); err != nil {
			slog.Error("telegram_status_error", "event_id", id, "error", err)
			failures = errors.Join(failures, err)
		}
	}
	rows, err = service.DB.Query(ctx, `
 SELECT s.user_id,s.digest_time,s.timezone,s.last_digest_date
 FROM telegram_settings s
 JOIN users u ON u.id=s.user_id
 WHERE s.chat_id IS NOT NULL AND s.digest_enabled AND NOT u.disabled`)
	if err != nil {
		return errors.Join(failures, err)
	}
	var users []int64
	for rows.Next() {
		var id int64
		var clock, zone string
		var lastDate *time.Time
		if err := rows.Scan(&id, &clock, &zone, &lastDate); err != nil {
			rows.Close()
			return errors.Join(failures, err)
		}
		location, err := time.LoadLocation(zone)
		if err != nil {
			failures = errors.Join(failures, err)
			continue
		}
		if digestDue(clock, lastDate, time.Now().In(location)) {
			users = append(users, id)
		}
	}
	rows.Close()
	if err := rows.Err(); err != nil {
		return errors.Join(failures, err)
	}
	for _, id := range users {
		if err := service.sendDigest(ctx, id); err != nil {
			slog.Error("telegram_digest_error", "user_id", id, "error", err)
			failures = errors.Join(failures, err)
		}
	}
	return failures
}

func (service *Service) deliverStatus(ctx context.Context, id int64) error {
	tx, err := service.DB.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)
	var taskID, ownerID int64
	err = tx.QueryRow(ctx, `SELECT t.id,t.user_id FROM tasks t JOIN telegram_outbox o ON o.task_id=t.id WHERE o.id=$1 FOR SHARE OF t`, id).Scan(&taskID, &ownerID)
	if err == pgx.ErrNoRows {
		return nil
	}
	if err != nil {
		return err
	}
	var userID, expectedChat int64
	var message string
	err = tx.QueryRow(ctx, `
 SELECT user_id,chat_id,message
 FROM telegram_outbox
 WHERE id=$1 AND delivered_at IS NULL AND next_attempt_at<=now()
 FOR UPDATE SKIP LOCKED`, id).Scan(&userID, &expectedChat, &message)
	if err == pgx.ErrNoRows {
		return nil
	}
	if err != nil {
		return err
	}
	var chatID int64
	err = tx.QueryRow(ctx, `
 SELECT s.chat_id
 FROM telegram_settings s
 JOIN users u ON u.id=s.user_id
 WHERE s.user_id=$1 AND NOT u.disabled AND s.status_enabled AND s.chat_id=$2 AND s.connected_at<=(SELECT created_at
 FROM telegram_outbox
 WHERE id=$3) AND ($1=$4 OR EXISTS(SELECT 1
 FROM task_members m
 WHERE m.task_id=$5 AND m.user_id=$1))
 FOR UPDATE OF s`, userID, expectedChat, id, ownerID, taskID).Scan(&chatID)
	if err == pgx.ErrNoRows {
		_, err = tx.Exec(ctx, `UPDATE telegram_outbox SET delivered_at=now() WHERE id=$1`, id)
	} else if err == nil {
		deliveryErr := service.Telegram.Send(ctx, chatID, message)
		if deliveryErr != nil {
			_, err = tx.Exec(ctx, `
 UPDATE telegram_outbox SET attempts=attempts+1,next_attempt_at=now()+make_interval(secs=>least(3600,30*power(2,least(attempts,7)))::integer)
 WHERE id=$1`, id)
			if err != nil {
				return err
			}
			if err := tx.Commit(ctx); err != nil {
				return err
			}
			return deliveryErr
		}
		_, err = tx.Exec(ctx, `UPDATE telegram_outbox SET delivered_at=now() WHERE id=$1`, id)
	}
	if err != nil {
		return err
	}
	return tx.Commit(ctx)
}

func (service *Service) RunTelegram(ctx context.Context) {
	ticker := time.NewTicker(15 * time.Second)
	defer ticker.Stop()
	for {
		if err := service.TickTelegram(ctx); err != nil {
			slog.Error("telegram_worker_error", "error", err)
		}
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
		}
	}
}
