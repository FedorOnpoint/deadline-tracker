package notifications

import (
	"context"

	"deadline-tracker/internal/database"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type PostgresSettingsRepository struct{ DB *pgxpool.Pool }

func (repo *PostgresSettingsRepository) Settings(ctx context.Context, userID int64) (TelegramSettings, error) {
	var settings TelegramSettings
	if _, err := repo.DB.Exec(ctx, `INSERT INTO telegram_settings(user_id) VALUES($1) ON CONFLICT DO NOTHING`, userID); err != nil {
		return settings, err
	}
	err := repo.DB.QueryRow(ctx, `SELECT chat_id IS NOT NULL,digest_time,timezone,digest_enabled,status_enabled FROM telegram_settings WHERE user_id=$1`, userID).Scan(&settings.Connected, &settings.DigestTime, &settings.Timezone, &settings.DigestEnabled, &settings.StatusEnabled)
	return settings, err
}

func (repo *PostgresSettingsRepository) SaveSettings(ctx context.Context, userID int64, input TelegramPreferences) error {
	_, err := repo.DB.Exec(ctx, `
 INSERT INTO telegram_settings(user_id,digest_time,timezone,digest_enabled,status_enabled)
 VALUES($1,$2,$3,$4,$5)
 ON CONFLICT(user_id)
 DO UPDATE SET digest_time=$2,timezone=$3,digest_enabled=$4,status_enabled=$5`, userID, input.DigestTime, input.Timezone, input.DigestEnabled, input.StatusEnabled)
	return err
}

func (repo *PostgresSettingsRepository) SaveLink(ctx context.Context, userID int64, tokenHash string) error {
	_, err := repo.DB.Exec(ctx, `
 INSERT INTO telegram_links(user_id,token_hash)
 VALUES($1,$2)
 ON CONFLICT(user_id)
 DO UPDATE SET token_hash=$2,expires_at=now()+interval '10 minutes'`, userID, tokenHash)
	return err
}

func (repo *PostgresSettingsRepository) Disconnect(ctx context.Context, userID int64) error {
	return database.InTransaction(ctx, repo.DB, func(tx pgx.Tx) error {
		if _, err := tx.Exec(ctx, `UPDATE telegram_settings SET chat_id=NULL,connected_at=NULL WHERE user_id=$1`, userID); err != nil {
			return err
		}
		_, err := tx.Exec(ctx, `DELETE FROM telegram_links WHERE user_id=$1`, userID)
		return err
	})
}
