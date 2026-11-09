package notifications

import (
	"context"
	"errors"
	"log/slog"
	"strings"

	"deadline-tracker/internal/security"
	"github.com/jackc/pgx/v5"
)

type telegramUpdate struct {
	ID      int64 `json:"update_id"`
	Message *struct {
		Text string `json:"text"`
		Chat struct {
			ID   int64  `json:"id"`
			Type string `json:"type"`
		} `json:"chat"`
		From struct {
			ID  int64 `json:"id"`
			Bot bool  `json:"is_bot"`
		} `json:"from"`
	} `json:"message"`
}

func (service *Service) pollTelegram(ctx context.Context) error {
	tx, err := service.DB.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)
	var offset int64
	err = tx.QueryRow(ctx, `SELECT next_offset FROM telegram_poll_state WHERE id=1 FOR UPDATE SKIP LOCKED`).Scan(&offset)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil
	}
	if err != nil {
		return err
	}
	var updates []telegramUpdate
	if err := service.Telegram.call(ctx, "getUpdates", map[string]any{"offset": offset, "limit": 100, "timeout": 0, "allowed_updates": []string{"message"}}, &updates); err != nil {
		return err
	}
	type reply struct {
		chatID int64
		text   string
	}
	var replies []reply
	for _, update := range updates {
		if update.ID < offset {
			continue
		}
		message := update.Message
		if message != nil && message.Chat.Type == "private" && !message.From.Bot && message.From.ID == message.Chat.ID {
			parts := strings.Fields(message.Text)
			if len(parts) == 1 && parts[0] == "/start" {
				replies = append(replies, reply{message.Chat.ID, "Для подключения откройте настройки аккаунта в Дедлайнишной и нажмите «Подключить Telegram»."})
			}
			if len(parts) == 2 && parts[0] == "/start" && len(parts[1]) == 48 {
				var userID int64
				err := tx.QueryRow(ctx, `DELETE FROM telegram_links l USING users u WHERE l.user_id=u.id AND NOT u.disabled AND l.token_hash=$1 AND l.expires_at>now() RETURNING l.user_id`, security.Digest(parts[1])).Scan(&userID)
				if err != nil && !errors.Is(err, pgx.ErrNoRows) {
					return err
				}
				if errors.Is(err, pgx.ErrNoRows) {
					replies = append(replies, reply{message.Chat.ID, "Ссылка истекла или уже использована. Создайте новую в настройках аккаунта."})
				}
				if err == nil {
					// A private chat can belong to one account. Rebinding removes the previous account's access.
					if _, err := tx.Exec(ctx, `UPDATE telegram_settings SET chat_id=NULL,connected_at=NULL WHERE chat_id=$1 AND user_id<>$2`, message.Chat.ID, userID); err != nil {
						return err
					}
					if _, err := tx.Exec(ctx, `INSERT INTO telegram_settings(user_id,chat_id,connected_at,last_digest_date) VALUES($1,$2,now(),NULL) ON CONFLICT(user_id) DO UPDATE SET chat_id=$2,connected_at=now()`, userID, message.Chat.ID); err != nil {
						return err
					}
					replies = append(replies, reply{message.Chat.ID, "Telegram подключён. Здесь будут утренние сводки и изменения статусов ваших и совместных карточек. Время и типы уведомлений можно изменить в настройках аккаунта."})
				}
			}
		}
		offset = update.ID + 1
	}
	if _, err := tx.Exec(ctx, `UPDATE telegram_poll_state SET next_offset=$1 WHERE id=1`, offset); err != nil {
		return err
	}
	if err := tx.Commit(ctx); err != nil {
		return err
	}
	for _, reply := range replies {
		if err := service.Telegram.Send(ctx, reply.chatID, reply.text); err != nil {
			slog.Error("telegram_link_reply_error", "error", err)
		}
	}
	return nil
}
