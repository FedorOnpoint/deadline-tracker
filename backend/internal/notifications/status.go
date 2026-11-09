package notifications

import (
	"context"
	"encoding/json"
	"fmt"

	"deadline-tracker/internal/domain"
	"github.com/jackc/pgx/v5"
)

type StatusRecorder struct{}

func (StatusRecorder) Record(ctx context.Context, tx pgx.Tx, actorID int64, previous, current domain.Task) error {
	if previous.ID == 0 || (sameStatus(previous.StatusID, current.StatusID) && previous.Completed == current.Completed) {
		return nil
	}
	var oldStatus, newStatus, actor string
	err := tx.QueryRow(ctx, `
 SELECT
   coalesce((SELECT name FROM catalog WHERE id=$1),'Не задан'),
   coalesce((SELECT name FROM catalog WHERE id=$2),'Не задан'),
   name
 FROM users
 WHERE id=$3`, previous.StatusID, current.StatusID, actorID).Scan(&oldStatus, &newStatus, &actor)
	if err != nil {
		return err
	}
	if previous.Completed != current.Completed {
		if previous.Completed {
			oldStatus = "Выполнено"
		}
		if current.Completed {
			newStatus = "Выполнено"
		}
	}
	message := fmt.Sprintf("Изменён статус карточки #%d\n%.300s\n%s → %s\nИзменил(а): %s", current.ID, current.Topic, oldStatus, newStatus, actor)
	payload, err := json.Marshal(statusChange{TaskID: current.ID, Topic: current.Topic, Previous: oldStatus, Current: newStatus, Actor: actor})
	if err != nil {
		return err
	}
	_, err = tx.Exec(ctx, `INSERT INTO telegram_outbox(task_id,user_id,chat_id,message,payload)
 SELECT $1,s.user_id,s.chat_id,$2,$4 FROM telegram_settings s JOIN users u ON u.id=s.user_id
 WHERE s.chat_id IS NOT NULL AND s.status_enabled AND NOT u.disabled
 AND (s.user_id=$3 OR EXISTS(SELECT 1 FROM task_members m WHERE m.task_id=$1 AND m.user_id=s.user_id))`, current.ID, message, current.OwnerID, payload)
	return err
}

func sameStatus(left, right *int64) bool {
	if left == nil || right == nil {
		return left == nil && right == nil
	}
	return *left == *right
}
