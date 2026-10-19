package main

import (
	"context"
	"log/slog"
	"time"
)

type Notification struct {
	Type     string    `json:"event"`
	TaskID   int64     `json:"task_id"`
	Cycle    int64     `json:"cycle"`
	Topic    string    `json:"topic"`
	Platform string    `json:"platform"`
	Deadline time.Time `json:"deadline"`
	Status   string    `json:"status"`
	Urgency  string    `json:"urgency"`
}
type Notifier interface {
	Deliver(context.Context, Notification) error
}
type ConsoleNotifier struct{}

func (ConsoleNotifier) Deliver(ctx context.Context, n Notification) error {
	if err := ctx.Err(); err != nil {
		return err
	}
	slog.Info(n.Type, "task_id", n.TaskID, "cycle", n.Cycle, "topic", n.Topic, "platform", n.Platform, "deadline", n.Deadline, "status", n.Status, "urgency", n.Urgency)
	return nil
}
func slogDeliveryError(id int64, err error) {
	slog.Error("notification_delivery_error", "task_id", id, "error", err)
}

func (a *App) checkNotification(ctx context.Context, id int64) error {
	tx, err := a.db.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)
	var n Notification
	var completed bool
	// Every writer locks the same task row. Checks and deadline/completion edits are serialized.
	err = tx.QueryRow(ctx, `SELECT t.id,t.cycle,t.data->>'topic',p.name,t.deadline,coalesce(s.name,'Не задан'),t.completed FROM tasks t JOIN catalog p ON p.id=t.platform_id LEFT JOIN catalog s ON s.id=t.status_id WHERE t.id=$1 FOR UPDATE OF t`, id).Scan(&n.TaskID, &n.Cycle, &n.Topic, &n.Platform, &n.Deadline, &n.Status, &completed)
	if err != nil {
		return err
	}
	n.Type = "deadline_notification"
	n.Urgency = urgency(n.Deadline, completed, time.Now())
	if n.Urgency == "neutral" || n.Urgency == "done" {
		return nil
	}
	var sent bool
	if err = tx.QueryRow(ctx, "SELECT EXISTS(SELECT 1 FROM notifications WHERE task_id=$1 AND cycle=$2 AND urgency=$3)", id, n.Cycle, n.Urgency).Scan(&sent); err != nil {
		return err
	}
	if sent {
		return nil
	}
	if err = a.notifier.Deliver(ctx, n); err != nil {
		return err
	}
	if _, err = tx.Exec(ctx, "INSERT INTO notifications(task_id,cycle,urgency) VALUES($1,$2,$3)", id, n.Cycle, n.Urgency); err != nil {
		return err
	}
	return tx.Commit(ctx)
}
func (a *App) checkNotifications(ctx context.Context) {
	rows, err := a.db.Query(ctx, "SELECT id FROM tasks WHERE NOT completed AND deadline <= now()+interval '14 days'")
	if err != nil {
		slogDeliveryError(0, err)
		return
	}
	var ids []int64
	for rows.Next() {
		var id int64
		if err = rows.Scan(&id); err != nil {
			rows.Close()
			slogDeliveryError(0, err)
			return
		}
		ids = append(ids, id)
	}
	err = rows.Err()
	rows.Close()
	if err != nil {
		slogDeliveryError(0, err)
		return
	}
	for _, id := range ids {
		if err = a.checkNotification(ctx, id); err != nil {
			slogDeliveryError(id, err)
		}
	}
}
func (a *App) runNotifications(ctx context.Context) {
	a.checkNotifications(ctx)
	ticker := time.NewTicker(time.Minute)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			a.checkNotifications(ctx)
		}
	}
}
