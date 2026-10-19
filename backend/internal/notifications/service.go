package notifications

import (
	"context"
	"crypto/subtle"
	"errors"
	"log/slog"
	"net/http"
	"os"
	"time"

	"deadline-tracker/internal/domain"
	"deadline-tracker/internal/httpx"

	"github.com/jackc/pgx/v5/pgxpool"
)

type Service struct {
	DB       *pgxpool.Pool
	Notifier Notifier
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

func (handler *Service) Check(ctx context.Context, id int64) error {
	tx, err := handler.DB.Begin(ctx)
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
	if err = handler.Notifier.Deliver(ctx, n); err != nil {
		return err
	}
	if _, err = tx.Exec(ctx, "INSERT INTO notifications(task_id,cycle,urgency) VALUES($1,$2,$3)", id, n.Cycle, n.Urgency); err != nil {
		return err
	}
	return tx.Commit(ctx)
}
func (handler *Service) CheckAll(ctx context.Context) error {
	rows, err := handler.DB.Query(ctx, "SELECT id FROM tasks WHERE NOT completed AND deadline <= now()+interval '14 days'")
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
		if err = handler.Check(ctx, id); err != nil {
			LogDeliveryError(id, err)
			deliveryErrors = errors.Join(deliveryErrors, err)
		}
	}
	return deliveryErrors
}
func (handler *Service) Daily(w http.ResponseWriter, r *http.Request) error {
	secret := os.Getenv("CRON_SECRET")
	if secret == "" || subtle.ConstantTimeCompare([]byte(r.Header.Get("Authorization")), []byte("Bearer "+secret)) != 1 {
		return &httpx.Error{Code: http.StatusUnauthorized, Message: "Unauthorized"}
	}
	if err := handler.CheckAll(r.Context()); err != nil {
		return err
	}
	return httpx.Respond(w, http.StatusOK, map[string]string{"status": "ok"})
}
func (handler *Service) Run(ctx context.Context) {
	handler.CheckAll(ctx)
	ticker := time.NewTicker(time.Minute)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			handler.CheckAll(ctx)
		}
	}
}
