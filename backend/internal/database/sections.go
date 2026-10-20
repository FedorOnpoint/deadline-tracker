package database

import (
	"context"
	"encoding/json"

	"deadline-tracker/internal/domain"
	"github.com/jackc/pgx/v5"
)

func SeedUserSections(ctx context.Context, tx pgx.Tx, userID int64) error {
	fields, err := json.Marshal(domain.DefaultCardFields())
	if err != nil {
		return err
	}
	for i, section := range []struct{ key, label string }{{"medznat", "Медзнат"}, {"onpoint", "Онпоинт"}, {"medpoint", "Медпоинт"}, {"special", "Спецпроекты"}} {
		if _, err := tx.Exec(ctx, `INSERT INTO task_sections(user_id,key,label,position,fields) VALUES($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING`, userID, section.key, section.label, i, fields); err != nil {
			return err
		}
	}
	return nil
}

func initializeSections(ctx context.Context, tx pgx.Tx) error {
	if _, err := tx.Exec(ctx, `CREATE TABLE IF NOT EXISTS task_sections (
 user_id bigint NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 key text NOT NULL,
 label text NOT NULL CHECK(length(btrim(label)) BETWEEN 1 AND 150),
 position integer NOT NULL DEFAULT 0,
 revision integer NOT NULL DEFAULT 1,
 fields jsonb NOT NULL,
 PRIMARY KEY(user_id,key)
);
CREATE UNIQUE INDEX IF NOT EXISTS task_sections_label ON task_sections(user_id,lower(btrim(label)));`); err != nil {
		return err
	}
	tag, err := tx.Exec(ctx, "INSERT INTO migrations(name) VALUES('card_constructor_v1') ON CONFLICT DO NOTHING")
	if err != nil || tag.RowsAffected() == 0 {
		return err
	}
	rows, err := tx.Query(ctx, "SELECT id FROM users")
	if err != nil {
		return err
	}
	var ids []int64
	for rows.Next() {
		var id int64
		if err := rows.Scan(&id); err != nil {
			rows.Close()
			return err
		}
		ids = append(ids, id)
	}
	rows.Close()
	if err := rows.Err(); err != nil {
		return err
	}
	for _, id := range ids {
		if err := SeedUserSections(ctx, tx, id); err != nil {
			return err
		}
	}
	_, err = tx.Exec(ctx, `ALTER TABLE catalog DROP CONSTRAINT IF EXISTS catalog_section_check;
ALTER TABLE catalog ADD COLUMN platform_section text GENERATED ALWAYS AS (CASE WHEN kind='platform' THEN section ELSE NULL END) STORED;
ALTER TABLE catalog ADD CONSTRAINT catalog_section_owner FOREIGN KEY(user_id,platform_section) REFERENCES task_sections(user_id,key);`)
	return err
}
