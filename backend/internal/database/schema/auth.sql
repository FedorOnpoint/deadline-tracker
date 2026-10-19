CREATE TABLE IF NOT EXISTS users (
 id bigserial PRIMARY KEY,
 login text NOT NULL,
 name text NOT NULL,
 password_hash text NOT NULL,
 role text NOT NULL DEFAULT 'user' CHECK (role IN ('admin','user')),
 disabled boolean NOT NULL DEFAULT false,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS users_login ON users(lower(login));
CREATE TABLE IF NOT EXISTS sessions (
 token_hash text PRIMARY KEY,
 user_id bigint NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 expires_at timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS sessions_user ON sessions(user_id);
CREATE TABLE IF NOT EXISTS invitations (
 id bigserial PRIMARY KEY,
 code_hash text NOT NULL UNIQUE,
 created_by bigint NOT NULL REFERENCES users(id),
 created_at timestamptz NOT NULL DEFAULT now(),
 expires_at timestamptz NOT NULL DEFAULT now()+interval '7 days',
 used_by bigint REFERENCES users(id),
 used_at timestamptz,
 revoked boolean NOT NULL DEFAULT false
);
CREATE TABLE IF NOT EXISTS auth_limits (
 scope text PRIMARY KEY,
 attempts integer NOT NULL,
 resets_at timestamptz NOT NULL
);
CREATE TABLE IF NOT EXISTS user_demos (user_id bigint PRIMARY KEY REFERENCES users(id));
