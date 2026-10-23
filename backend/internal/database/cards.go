package database

import (
	"context"
	"encoding/json"

	"deadline-tracker/internal/domain"
	"github.com/jackc/pgx/v5"
)

func initializeCards(ctx context.Context, tx pgx.Tx) error {
	tag, err := tx.Exec(ctx, "INSERT INTO migrations(name) VALUES('individual_cards_v1') ON CONFLICT DO NOTHING")
	if err != nil || tag.RowsAffected() == 0 {
		return err
	}
	// Snapshot the old layout before changing defaults; existing cards keep their data and dates.
	if _, err := tx.Exec(ctx, `
ALTER TABLE task_sections ADD COLUMN deadline_field text NOT NULL DEFAULT 'deadline';
ALTER TABLE tasks ADD COLUMN section text;
UPDATE tasks t SET section=c.section FROM catalog c WHERE c.id=t.platform_id;
UPDATE tasks t SET data=t.data || jsonb_build_object(
 'fields', s.fields || '[{"id":"status_id","label":"Рабочий статус","type":"catalog","required":false,"visibility":"summary"}]'::jsonb,
 'base_date',t.deadline,'deadline_field','deadline','timezone','UTC'
) FROM task_sections s WHERE s.user_id=t.user_id AND s.key=t.section;
ALTER TABLE tasks ALTER COLUMN section SET NOT NULL;
ALTER TABLE tasks ADD CONSTRAINT tasks_section_owner FOREIGN KEY(user_id,section) REFERENCES task_sections(user_id,key);
ALTER TABLE tasks ALTER COLUMN platform_id DROP NOT NULL;
CREATE INDEX tasks_user_section_deadline ON tasks(user_id,section,completed,deadline);`); err != nil {
		return err
	}
	defaults, err := json.Marshal(domain.DefaultCardFields())
	if err != nil {
		return err
	}
	// Only reset the former built-in template. User-created fields and customized layouts stay intact.
	_, err = tx.Exec(ctx, `UPDATE task_sections SET fields=$1,revision=revision+1
 WHERE fields='[
 {"id":"topic","label":"Тема","type":"textarea","required":true,"visibility":"summary"},
 {"id":"platform_id","label":"Площадка","type":"catalog","required":true,"visibility":"summary"},
 {"id":"deadline","label":"Срок загрузки в Mhub+","type":"datetime","required":true,"visibility":"summary"},
 {"id":"email_date","label":"Дата e-mail","type":"date","required":false,"visibility":"summary"},
 {"id":"specialty_id","label":"Специальность","type":"catalog","required":false,"visibility":"details"},
 {"id":"project","label":"Материал / проект","type":"text","required":false,"visibility":"summary"},
 {"id":"owner","label":"Ответственный","type":"text","required":false,"visibility":"details"},
 {"id":"header","label":"Хедер","type":"textarea","required":false,"visibility":"details"},
 {"id":"preheader","label":"Прехедер","type":"textarea","required":false,"visibility":"details"},
 {"id":"comment","label":"Комментарий","type":"textarea","required":false,"visibility":"details"}
 ]'::jsonb`, defaults)
	return err
}
