package admin

import (
	"context"

	"deadline-tracker/internal/domain"

	"github.com/jackc/pgx/v5/pgxpool"
)

type PostgresRepository struct{ DB *pgxpool.Pool }

func (repo *PostgresRepository) CreateInvitation(ctx context.Context, adminID int64, codeHash string) (Invitation, error) {
	var invitation Invitation
	err := repo.DB.QueryRow(ctx, "INSERT INTO invitations(code_hash,created_by) VALUES($1,$2) RETURNING id,created_at,expires_at", codeHash, adminID).Scan(&invitation.ID, &invitation.CreatedAt, &invitation.ExpiresAt)
	return invitation, err
}

func (repo *PostgresRepository) ListInvitations(ctx context.Context) ([]Invitation, error) {
	rows, err := repo.DB.Query(ctx, `SELECT i.id,i.created_at,i.expires_at,i.used_at,coalesce(u.name,''),i.revoked FROM invitations i LEFT JOIN users u ON u.id=i.used_by ORDER BY i.id DESC LIMIT 200`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	result := []Invitation{}
	for rows.Next() {
		var i Invitation
		if err = rows.Scan(&i.ID, &i.CreatedAt, &i.ExpiresAt, &i.UsedAt, &i.UsedBy, &i.Revoked); err != nil {
			return nil, err
		}
		result = append(result, i)
	}
	if err = rows.Err(); err != nil {
		return nil, err
	}
	return result, nil
}

func (repo *PostgresRepository) ListUsers(ctx context.Context) ([]domain.User, error) {
	rows, err := repo.DB.Query(ctx, "SELECT id,login,name,role,disabled,created_at FROM users ORDER BY id")
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	users := []domain.User{}
	for rows.Next() {
		var user domain.User
		if err = rows.Scan(&user.ID, &user.Login, &user.Name, &user.Role, &user.Disabled, &user.CreatedAt); err != nil {
			return nil, err
		}
		users = append(users, user)
	}
	if err = rows.Err(); err != nil {
		return nil, err
	}
	return users, nil
}

func (repo *PostgresRepository) RevokeInvitation(ctx context.Context, id int64) (bool, error) {
	tag, err := repo.DB.Exec(ctx, "UPDATE invitations SET revoked=true WHERE id=$1 AND used_by IS NULL", id)
	return tag.RowsAffected() > 0, err
}
