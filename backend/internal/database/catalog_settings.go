package database

import (
	"context"

	"github.com/jackc/pgx/v5"
)

func initializeCatalogSettings(ctx context.Context, tx pgx.Tx) error {
	tag, err := tx.Exec(ctx, "INSERT INTO migrations(name) VALUES ('tester_feedback_v1') ON CONFLICT DO NOTHING")
	if err != nil || tag.RowsAffected() == 0 {
		return err
	}
	_, err = tx.Exec(ctx, `
 ALTER TABLE catalog ADD COLUMN platform_ids bigint[] NOT NULL DEFAULT '{}';
 ALTER TABLE catalog ADD COLUMN reminder_text text NOT NULL DEFAULT '';
 -- Preserve the choices available in existing accounts; new platforms start with an empty audience list.
 UPDATE catalog AS specialty SET platform_ids=ARRAY(SELECT platform.id FROM catalog AS platform WHERE platform.user_id=specialty.user_id AND platform.kind='platform' ORDER BY platform.id) WHERE specialty.kind='specialty';
 `)
	return err
}
