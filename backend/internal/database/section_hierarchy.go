package database

import (
	"context"

	"deadline-tracker/internal/domain"
	"github.com/jackc/pgx/v5"
)

func initializeSectionHierarchy(ctx context.Context, tx pgx.Tx) error {
	tag, err := tx.Exec(ctx, "INSERT INTO migrations(name) VALUES('section_hierarchy_v1') ON CONFLICT DO NOTHING")
	if err != nil || tag.RowsAffected() == 0 {
		return err
	}
	_, err = tx.Exec(ctx, `ALTER TABLE task_sections ADD COLUMN parent_key text;
ALTER TABLE task_sections ADD CONSTRAINT section_parent_owner
 FOREIGN KEY(user_id,parent_key) REFERENCES task_sections(user_id,key);
ALTER TABLE task_sections ADD CONSTRAINT section_parent_not_self CHECK(parent_key IS NULL OR parent_key<>key);
CREATE INDEX task_sections_parent ON task_sections(user_id,parent_key);`)
	return err
}

// Keep the section a child throughout the card or platform write.
func LockLeafSection(ctx context.Context, tx pgx.Tx, userID int64, key string) error {
	var parentKey string
	if err := tx.QueryRow(ctx, "SELECT coalesce(parent_key,'') FROM task_sections WHERE user_id=$1 AND key=$2 FOR SHARE", userID, key).Scan(&parentKey); err != nil {
		return err
	}
	if parentKey == "" {
		return domain.Invalid("Сначала создайте дочерний раздел для карточек и площадок")
	}
	return nil
}
