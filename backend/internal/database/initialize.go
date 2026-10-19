package database

import (
	"context"
	_ "embed"

	"github.com/jackc/pgx/v5/pgxpool"
)

//go:embed schema/base.sql
var schema string

func Initialize(ctx context.Context, db *pgxpool.Pool) error {
	tx, err := db.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)
	if _, err = tx.Exec(ctx, "SELECT pg_advisory_xact_lock(71248901)"); err != nil {
		return err
	}
	if _, err = tx.Exec(ctx, schema); err != nil {
		return err
	}
	tag, err := tx.Exec(ctx, "INSERT INTO migrations(name) VALUES ('initial_catalog_v1') ON CONFLICT DO NOTHING")
	if err != nil {
		return err
	}
	if tag.RowsAffected() > 0 {
		names := map[string][]string{"platform": {"База Медзнат", "Отправки Medpoint", "Отправки Onpoint"}, "specialty": {"Gastro", "GP"}, "status": {"Пишем", "На согласовании", "Дорабатываем", "Загружено DROID", "Mhub", "Дизайн", "Согласовано БМ", "Ждем размещение МЗ", "Корректор"}}
		colors := []string{"#a9b9cf", "#e2be77", "#edaa87", "#b4a1df", "#8ebfd1", "#d39bbb", "#9fc5a3", "#b2c88e", "#c1b4a4"}
		for kind, values := range names {
			for i, name := range values {
				color := "#aac4d6"
				if kind == "status" {
					color = colors[i]
				}
				if _, err = tx.Exec(ctx, "INSERT INTO catalog(kind,name,color,position) VALUES($1,$2,$3,$4)", kind, name, color, i); err != nil {
					return err
				}
			}
		}
	}
	tag, err = tx.Exec(ctx, "INSERT INTO migrations(name) VALUES ('platform_sections_v1') ON CONFLICT DO NOTHING")
	if err != nil {
		return err
	}
	if tag.RowsAffected() > 0 {
		_, err = tx.Exec(ctx, `UPDATE catalog SET section=CASE name WHEN 'База Медзнат' THEN 'medznat' WHEN 'Отправки Onpoint' THEN 'onpoint' WHEN 'Отправки Medpoint' THEN 'medpoint' ELSE 'special' END WHERE kind='platform'`)
		if err != nil {
			return err
		}
	}
	if err = initializeAuth(ctx, tx); err != nil {
		return err
	}
	return tx.Commit(ctx)
}
