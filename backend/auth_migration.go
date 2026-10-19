package main

import (
	"context"
	_ "embed"
	"errors"
	"os"

	"github.com/jackc/pgx/v5"
)

//go:embed auth_schema.sql
var authSchema string

func seedUserCatalog(ctx context.Context, tx pgx.Tx, id int64) error {
	names := map[string][]string{"platform": {"База Медзнат", "Отправки Medpoint", "Отправки Onpoint"}, "specialty": {"Gastro", "GP"}, "status": {"Пишем", "На согласовании", "Дорабатываем", "Загружено DROID", "Mhub", "Дизайн", "Согласовано БМ", "Ждем размещение МЗ", "Корректор"}}
	colors := []string{"#a9b9cf", "#e2be77", "#edaa87", "#b4a1df", "#8ebfd1", "#d39bbb", "#9fc5a3", "#b2c88e", "#c1b4a4"}
	for kind, values := range names {
		for i, name := range values {
			color, section := "#aac4d6", "special"
			if kind == "status" {
				color = colors[i]
			}
			if kind == "platform" {
				section = []string{"medznat", "medpoint", "onpoint"}[i]
			}
			if _, err := tx.Exec(ctx, "INSERT INTO catalog(user_id,kind,name,color,position,section) VALUES($1,$2,$3,$4,$5,$6)", id, kind, name, color, i, section); err != nil {
				return err
			}
		}
	}
	return nil
}
func initializeAuth(ctx context.Context, tx pgx.Tx) error {
	if _, err := tx.Exec(ctx, authSchema); err != nil {
		return err
	}
	var migrated bool
	if err := tx.QueryRow(ctx, "SELECT EXISTS(SELECT 1 FROM migrations WHERE name='auth_ownership_v1')").Scan(&migrated); err != nil {
		return err
	}
	if migrated {
		return nil
	}
	adminPassword, mariaPassword := os.Getenv("ADMIN_INITIAL_PASSWORD"), os.Getenv("MARIA_INITIAL_PASSWORD")
	if adminPassword == "" || mariaPassword == "" {
		return errors.New("first auth setup requires ADMIN_INITIAL_PASSWORD and MARIA_INITIAL_PASSWORD")
	}
	adminHash, err := hashPassword(adminPassword)
	if err != nil {
		return err
	}
	mariaHash, err := hashPassword(mariaPassword)
	if err != nil {
		return err
	}
	var adminID, mariaID int64
	if err = tx.QueryRow(ctx, "INSERT INTO users(login,name,password_hash,role) VALUES('admin','Администратор',$1,'admin') RETURNING id", adminHash).Scan(&adminID); err != nil {
		return err
	}
	if err = tx.QueryRow(ctx, "INSERT INTO users(login,name,password_hash) VALUES('maria.panina','Maria Panina',$1) RETURNING id", mariaHash).Scan(&mariaID); err != nil {
		return err
	}
	if _, err = tx.Exec(ctx, `ALTER TABLE catalog ADD COLUMN user_id bigint REFERENCES users(id); ALTER TABLE tasks ADD COLUMN user_id bigint REFERENCES users(id); DROP INDEX catalog_unique_name;`); err != nil {
		return err
	}
	if _, err = tx.Exec(ctx, "UPDATE catalog SET user_id=$1;", mariaID); err != nil {
		return err
	}
	if _, err = tx.Exec(ctx, "UPDATE tasks SET user_id=$1;", mariaID); err != nil {
		return err
	}
	if _, err = tx.Exec(ctx, `ALTER TABLE catalog ALTER COLUMN user_id SET NOT NULL; ALTER TABLE tasks ALTER COLUMN user_id SET NOT NULL;
 CREATE UNIQUE INDEX catalog_unique_name ON catalog(user_id,kind,lower(btrim(name)));
 ALTER TABLE catalog ADD CONSTRAINT catalog_id_user_unique UNIQUE(id,user_id);
 ALTER TABLE tasks ADD CONSTRAINT tasks_platform_owner FOREIGN KEY(platform_id,user_id) REFERENCES catalog(id,user_id);
 ALTER TABLE tasks ADD CONSTRAINT tasks_specialty_owner FOREIGN KEY(specialty_id,user_id) REFERENCES catalog(id,user_id);
 ALTER TABLE tasks ADD CONSTRAINT tasks_status_owner FOREIGN KEY(status_id,user_id) REFERENCES catalog(id,user_id);
 CREATE INDEX tasks_user_deadline ON tasks(user_id,completed,deadline);`); err != nil {
		return err
	}
	if err = seedUserCatalog(ctx, tx, adminID); err != nil {
		return err
	}
	_, err = tx.Exec(ctx, "INSERT INTO migrations(name) VALUES('auth_ownership_v1')")
	return err
}
