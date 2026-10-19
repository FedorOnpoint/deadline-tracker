CREATE TABLE IF NOT EXISTS migrations (name text PRIMARY KEY);
CREATE TABLE IF NOT EXISTS catalog (
 id bigserial PRIMARY KEY,
 kind text NOT NULL CHECK (kind IN ('platform','specialty','status')),
 name text NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 150),
 color text NOT NULL DEFAULT '#aac4d6' CHECK (color ~ '^#[0-9A-Fa-f]{6}$'),
 position integer NOT NULL DEFAULT 0,
 archived boolean NOT NULL DEFAULT false
);
CREATE UNIQUE INDEX IF NOT EXISTS catalog_unique_name ON catalog(kind, lower(btrim(name)));
ALTER TABLE catalog ADD COLUMN IF NOT EXISTS section text NOT NULL DEFAULT 'special'
 CHECK (section IN ('medznat','onpoint','medpoint','special'));
CREATE TABLE IF NOT EXISTS tasks (
 id bigserial PRIMARY KEY,
 platform_id bigint NOT NULL REFERENCES catalog(id),
 specialty_id bigint REFERENCES catalog(id),
 status_id bigint REFERENCES catalog(id),
 deadline timestamptz NOT NULL,
 email_date date,
 data jsonb NOT NULL,
 completed boolean NOT NULL DEFAULT false,
 completed_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 cycle bigint NOT NULL DEFAULT 1,
 CHECK (completed = (completed_at IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS tasks_deadline ON tasks(completed, deadline);
CREATE TABLE IF NOT EXISTS notifications (
 task_id bigint NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
 cycle bigint NOT NULL,
 urgency text NOT NULL,
 delivered_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(task_id,cycle,urgency)
);
