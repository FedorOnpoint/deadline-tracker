package notifications

import (
	"context"
	"errors"
	"log/slog"
	"time"

	"deadline-tracker/internal/domain"

	"github.com/jackc/pgx/v5/pgxpool"
)

type Service struct {
	DB       *pgxpool.Pool
	Notifier Notifier
	Telegram *Telegram
}

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
func LogDeliveryError(id int64, err error) {
	slog.Error("notification_delivery_error", "task_id", id, "error", err)
}

func (service *Service) Check(ctx context.Context, id int64) error {
	tx, err := service.DB.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)
	var n Notification
	var completed bool
	// Every writer locks the same task row. Checks and deadline/completion edits are serialized.
	err = tx.QueryRow(ctx, `SELECT t.id,t.cycle,t.data->>'topic',coalesce(p.name,''),t.deadline,coalesce(s.name,'Не задан'),t.completed FROM tasks t LEFT JOIN catalog p ON p.id=t.platform_id LEFT JOIN catalog s ON s.id=t.status_id WHERE t.id=$1 FOR UPDATE OF t`, id).Scan(&n.TaskID, &n.Cycle, &n.Topic, &n.Platform, &n.Deadline, &n.Status, &completed)
	if err != nil {
		return err
	}
	n.Type = "deadline_notification"
	n.Urgency = domain.Urgency(n.Deadline, completed, time.Now())
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
	if err = service.Notifier.Deliver(ctx, n); err != nil {
		return err
	}
	if _, err = tx.Exec(ctx, "INSERT INTO notifications(task_id,cycle,urgency) VALUES($1,$2,$3)", id, n.Cycle, n.Urgency); err != nil {
		return err
	}
	return tx.Commit(ctx)
}
func (service *Service) CheckAll(ctx context.Context) error {
	rows, err := service.DB.Query(ctx, "SELECT id FROM tasks WHERE NOT completed AND deadline <= now()+interval '14 days'")
	if err != nil {
		LogDeliveryError(0, err)
		return err
	}
	var ids []int64
	for rows.Next() {
		var id int64
		if err = rows.Scan(&id); err != nil {
			rows.Close()
			LogDeliveryError(0, err)
			return err
		}
		ids = append(ids, id)
	}
	err = rows.Err()
	rows.Close()
	if err != nil {
		LogDeliveryError(0, err)
		return err
	}
	var deliveryErrors error
	for _, id := range ids {
		if err = service.Check(ctx, id); err != nil {
			LogDeliveryError(id, err)
			deliveryErrors = errors.Join(deliveryErrors, err)
		}
	}
	return deliveryErrors
}
func (service *Service) Run(ctx context.Context) {
	service.CheckAll(ctx)
	ticker := time.NewTicker(time.Minute)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			service.CheckAll(ctx)
		}
	}
}
