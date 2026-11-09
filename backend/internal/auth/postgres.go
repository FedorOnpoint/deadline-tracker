package auth

import (
	"context"
	"errors"

	"deadline-tracker/internal/database"
	"deadline-tracker/internal/domain"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type PostgresRepository struct{ DB *pgxpool.Pool }
type postgresTransaction struct{ tx pgx.Tx }

func (repo *PostgresRepository) Transaction(ctx context.Context, run func(Transaction) error) error {
	return database.InTransaction(ctx, repo.DB, func(tx pgx.Tx) error { return run(&postgresTransaction{tx: tx}) })
}

func (repo *PostgresRepository) FindSession(ctx context.Context, tokenHash string) (domain.User, error) {
	var user domain.User
	err := repo.DB.QueryRow(ctx, `
 SELECT u.id,u.login,u.name,u.role,u.disabled,u.created_at,u.avatar IS NOT NULL
 FROM sessions s JOIN users u ON u.id=s.user_id
 WHERE s.token_hash=$1 AND s.expires_at>now() AND NOT u.disabled`, tokenHash).Scan(&user.ID, &user.Login, &user.Name, &user.Role, &user.Disabled, &user.CreatedAt, &user.HasAvatar)
	if errors.Is(err, pgx.ErrNoRows) {
		return user, domain.ErrNotFound
	}
	return user, err
}

func (repo *PostgresRepository) DeleteSession(ctx context.Context, tokenHash string) error {
	_, err := repo.DB.Exec(ctx, `DELETE FROM sessions WHERE token_hash=$1`, tokenHash)
	return err
}

func (repo *PostgresRepository) IncrementAttempts(ctx context.Context, scopeHash string) (int, error) {
	var attempts int
	err := repo.DB.QueryRow(ctx, `
 INSERT INTO auth_limits(scope,attempts,resets_at) VALUES($1,1,now()+interval '15 minutes')
 ON CONFLICT(scope) DO UPDATE SET
 attempts=CASE WHEN auth_limits.resets_at<=now() THEN 1 ELSE auth_limits.attempts+1 END,
 resets_at=CASE WHEN auth_limits.resets_at<=now() THEN now()+interval '15 minutes' ELSE auth_limits.resets_at END
 RETURNING attempts`, scopeHash).Scan(&attempts)
	return attempts, err
}

func (repo *postgresTransaction) FindCredentials(ctx context.Context, login string) (Credentials, error) {
	var credentials Credentials
	user := &credentials.User
	err := repo.tx.QueryRow(ctx, `SELECT id,login,name,role,disabled,created_at,password_hash FROM users WHERE lower(login)=$1 FOR SHARE`, login).Scan(&user.ID, &user.Login, &user.Name, &user.Role, &user.Disabled, &user.CreatedAt, &credentials.PasswordHash)
	if errors.Is(err, pgx.ErrNoRows) {
		return credentials, domain.ErrNotFound
	}
	return credentials, err
}

func (repo *postgresTransaction) LockPassword(ctx context.Context, userID int64) (string, error) {
	var hash string
	err := repo.tx.QueryRow(ctx, `SELECT password_hash FROM users WHERE id=$1 FOR UPDATE`, userID).Scan(&hash)
	return hash, err
}

func (repo *postgresTransaction) LockInvitation(ctx context.Context, codeHash string) (int64, error) {
	var id int64
	err := repo.tx.QueryRow(ctx, `SELECT id FROM invitations WHERE code_hash=$1 AND expires_at>now() AND NOT revoked AND used_by IS NULL FOR UPDATE`, codeHash).Scan(&id)
	if errors.Is(err, pgx.ErrNoRows) {
		return 0, domain.ErrNotFound
	}
	return id, err
}

func (repo *postgresTransaction) CreateUser(ctx context.Context, login, name, passwordHash string) (domain.User, error) {
	var user domain.User
	err := repo.tx.QueryRow(ctx, `INSERT INTO users(login,name,password_hash) VALUES($1,$2,$3) RETURNING id,login,name,role,disabled,created_at`, login, name, passwordHash).Scan(&user.ID, &user.Login, &user.Name, &user.Role, &user.Disabled, &user.CreatedAt)
	return user, err
}

func (repo *postgresTransaction) UseInvitation(ctx context.Context, invitationID, userID int64) error {
	_, err := repo.tx.Exec(ctx, `UPDATE invitations SET used_by=$1,used_at=now() WHERE id=$2`, userID, invitationID)
	return err
}

func (repo *postgresTransaction) UpdatePassword(ctx context.Context, userID int64, passwordHash string) error {
	_, err := repo.tx.Exec(ctx, `UPDATE users SET password_hash=$1 WHERE id=$2`, passwordHash, userID)
	return err
}

func (repo *postgresTransaction) DeleteUserSessions(ctx context.Context, userID int64) error {
	_, err := repo.tx.Exec(ctx, `DELETE FROM sessions WHERE user_id=$1`, userID)
	return err
}

func (repo *postgresTransaction) InsertSession(ctx context.Context, userID int64, tokenHash string) error {
	_, err := repo.tx.Exec(ctx, `INSERT INTO sessions(token_hash,user_id,expires_at) VALUES($1,$2,now()+interval '7 days')`, tokenHash, userID)
	return err
}

func (repo *postgresTransaction) DeleteSession(ctx context.Context, tokenHash string) error {
	_, err := repo.tx.Exec(ctx, `DELETE FROM sessions WHERE token_hash=$1`, tokenHash)
	return err
}

func (repo *postgresTransaction) CleanupExpired(ctx context.Context) error {
	_, err := repo.tx.Exec(ctx, `DELETE FROM sessions WHERE expires_at<=now(); DELETE FROM auth_limits WHERE resets_at<=now()`)
	return err
}

func (repo *PostgresRepository) SaveAvatar(ctx context.Context, userID int64, data []byte) error {
	_, err := repo.DB.Exec(ctx, `UPDATE users SET avatar=$2 WHERE id=$1 AND NOT disabled`, userID, data)
	return err
}
func (repo *PostgresRepository) Avatar(ctx context.Context, userID int64) ([]byte, error) {
	var data []byte
	err := repo.DB.QueryRow(ctx, `SELECT avatar FROM users WHERE id=$1 AND NOT disabled`, userID).Scan(&data)
	return data, err
}
