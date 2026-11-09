package database

import (
	"context"

	"github.com/jackc/pgx/v5"
)

func initializeCollaboration(ctx context.Context, tx pgx.Tx) error {
	_, err := tx.Exec(ctx, `
 ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar bytea;
 CREATE TABLE IF NOT EXISTS task_members (
   task_id bigint NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
   user_id bigint NOT NULL REFERENCES users(id) ON DELETE CASCADE,
   PRIMARY KEY(task_id,user_id)
 );
 CREATE INDEX IF NOT EXISTS task_members_user ON task_members(user_id,task_id);
 CREATE TABLE IF NOT EXISTS telegram_settings (
   user_id bigint PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
   chat_id bigint UNIQUE,
   digest_time text NOT NULL DEFAULT '09:00' CHECK(digest_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
   timezone text NOT NULL DEFAULT 'Europe/Moscow',
   digest_enabled boolean NOT NULL DEFAULT true,
   status_enabled boolean NOT NULL DEFAULT true,
   last_digest_date date,
   connected_at timestamptz
 );
 ALTER TABLE telegram_settings ADD COLUMN IF NOT EXISTS last_manual_digest_at timestamptz;
 CREATE TABLE IF NOT EXISTS telegram_links (
   user_id bigint PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
   token_hash text UNIQUE NOT NULL,
   expires_at timestamptz NOT NULL DEFAULT now()+interval '10 minutes'
 );
 CREATE TABLE IF NOT EXISTS telegram_outbox (
   id bigserial PRIMARY KEY,
   task_id bigint NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
   user_id bigint NOT NULL REFERENCES users(id) ON DELETE CASCADE,
   chat_id bigint NOT NULL,
   message text NOT NULL,
   created_at timestamptz NOT NULL DEFAULT now(),
   next_attempt_at timestamptz NOT NULL DEFAULT now(),
   attempts integer NOT NULL DEFAULT 0,
   delivered_at timestamptz
 );
 ALTER TABLE telegram_outbox ADD COLUMN IF NOT EXISTS payload jsonb;
 CREATE INDEX IF NOT EXISTS telegram_outbox_pending ON telegram_outbox(next_attempt_at,id) WHERE delivered_at IS NULL;
 CREATE INDEX IF NOT EXISTS telegram_outbox_task_recipient ON telegram_outbox(task_id,user_id,id) WHERE delivered_at IS NULL;
 CREATE TABLE IF NOT EXISTS telegram_poll_state (
   id integer PRIMARY KEY CHECK(id=1),
   next_offset bigint NOT NULL DEFAULT 0
 );
 INSERT INTO telegram_poll_state(id) VALUES(1) ON CONFLICT DO NOTHING;
 `)
	return err
}
