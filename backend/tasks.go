package main

import (
	"context"
	"encoding/json"
	"net/http"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/jackc/pgx/v5"
)

const taskJSON = `data || jsonb_build_object('id',id,'platform_id',platform_id,'specialty_id',specialty_id,'status_id',status_id,'deadline',deadline,'email_date',coalesce(email_date::text,''),'completed',completed,'completed_at',completed_at,'created_at',created_at,'updated_at',updated_at)`

func readTask(ctx context.Context, tx pgx.Tx, id int64) (Task, error) {
	var t Task
	var raw []byte
	err := tx.QueryRow(ctx, "SELECT "+taskJSON+" FROM tasks WHERE id=$1", id).Scan(&raw)
	if err != nil {
		return t, err
	}
	err = json.Unmarshal(raw, &t)
	return t, err
}
func (a *App) listTasks(w http.ResponseWriter, r *http.Request) error {
	rows, err := a.db.Query(r.Context(), "SELECT "+taskJSON+" FROM tasks ORDER BY completed,deadline,id")
	if err != nil {
		return err
	}
	defer rows.Close()
	result := []Task{}
	for rows.Next() {
		var raw []byte
		var t Task
		if err = rows.Scan(&raw); err != nil {
			return err
		}
		if err = json.Unmarshal(raw, &t); err != nil {
			return err
		}
		result = append(result, t)
	}
	if err = rows.Err(); err != nil {
		return err
	}
	return respond(w, 200, result)
}
func validateTask(t *Task) error {
	t.Topic = strings.TrimSpace(t.Topic)
	if t.Topic == "" {
		return invalid("Укажите тему")
	}
	for _, s := range []string{t.Topic, t.Project, t.Header, t.Preheader, t.Comment, t.Owner} {
		if utf8.RuneCountInString(s) > 20000 {
			return invalid("В каждом текстовом поле допускается не более 20000 символов")
		}
	}
	if t.PlatformID <= 0 {
		return invalid("Выберите площадку")
	}
	if t.Deadline.IsZero() || t.Deadline.Year() < 1900 || t.Deadline.Year() > 9999 {
		return invalid("Укажите корректный дедлайн (1900–9999)")
	}
	t.Deadline = t.Deadline.UTC().Truncate(time.Microsecond)
	if t.EmailDate != "" {
		d, err := time.Parse("2006-01-02", t.EmailDate)
		if err != nil || d.Year() < 1900 {
			return invalid("Укажите корректную дату e-mail (1900–9999)")
		}
	}
	return nil
}
func (a *App) saveTask(w http.ResponseWriter, r *http.Request) error {
	ctx := r.Context()
	tx, err := a.db.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)
	var t, old Task
	var id int64
	if r.Method != "POST" {
		id, err = pathID(r)
		if err != nil {
			return err
		}
		if err = tx.QueryRow(ctx, "SELECT id FROM tasks WHERE id=$1 FOR UPDATE", id).Scan(&id); err != nil {
			return err
		}
		old, err = readTask(ctx, tx, id)
		if err != nil {
			return err
		}
	}
	if r.Method == "PATCH" {
		t = old
		var fields map[string]json.RawMessage
		if err = decode(w, r, &fields); err != nil {
			return err
		}
		if len(fields) == 0 {
			return invalid("Нет изменений")
		}
		for key, value := range fields {
			switch key {
			case "status_id":
				err = json.Unmarshal(value, &t.StatusID)
			case "completed":
				if string(value) == "null" {
					return invalid("Выполнение должно быть true или false")
				}
				err = json.Unmarshal(value, &t.Completed)
			default:
				return invalid("В списке можно менять только статус и выполнение")
			}
			if err != nil {
				return invalid("Некорректное значение поля")
			}
		}
	} else {
		if err = decode(w, r, &t); err != nil {
			return err
		}
	}
	if err = validateTask(&t); err != nil {
		return err
	}
	var oldPlatform *int64
	if old.ID > 0 {
		oldPlatform = &old.PlatformID
	}
	if err = validateReference(ctx, tx, &t.PlatformID, "platform", oldPlatform, true); err != nil {
		return err
	}
	if err = validateReference(ctx, tx, t.SpecialtyID, "specialty", old.SpecialtyID, false); err != nil {
		return err
	}
	if err = validateReference(ctx, tx, t.StatusID, "status", old.StatusID, false); err != nil {
		return err
	}
	raw, err := json.Marshal(map[string]string{"topic": t.Topic, "project": t.Project, "header": t.Header, "preheader": t.Preheader, "comment": t.Comment, "owner": t.Owner})
	if err != nil {
		return err
	}
	if r.Method == "POST" {
		err = tx.QueryRow(ctx, `INSERT INTO tasks(platform_id,specialty_id,status_id,deadline,email_date,data,completed,completed_at) VALUES($1,$2,$3,$4,NULLIF($5,'')::date,$6,$7,CASE WHEN $7 THEN now() ELSE NULL END) RETURNING id`, t.PlatformID, t.SpecialtyID, t.StatusID, t.Deadline, t.EmailDate, raw, t.Completed).Scan(&id)
	} else {
		newCycle := !old.Deadline.Equal(t.Deadline) || (old.Completed && !t.Completed)
		_, err = tx.Exec(ctx, `UPDATE tasks SET platform_id=$2,specialty_id=$3,status_id=$4,deadline=$5,email_date=NULLIF($6,'')::date,data=$7,completed=$8,completed_at=CASE WHEN $8 THEN coalesce(completed_at,now()) ELSE NULL END,updated_at=now(),cycle=cycle+CASE WHEN $9 THEN 1 ELSE 0 END WHERE id=$1`, id, t.PlatformID, t.SpecialtyID, t.StatusID, t.Deadline, t.EmailDate, raw, t.Completed, newCycle)
	}
	if err != nil {
		return err
	}
	result, err := readTask(ctx, tx, id)
	if err != nil {
		return err
	}
	if err = tx.Commit(ctx); err != nil {
		return err
	}
	// Delivery failure must not turn a successful save into an API failure; the periodic worker retries.
	if err = a.checkNotification(ctx, id); err != nil {
		slogDeliveryError(id, err)
	}
	code := 200
	if r.Method == "POST" {
		code = 201
	}
	return respond(w, code, result)
}
func (a *App) deleteTask(w http.ResponseWriter, r *http.Request) error {
	id, err := pathID(r)
	if err != nil {
		return err
	}
	tag, err := a.db.Exec(r.Context(), "DELETE FROM tasks WHERE id=$1", id)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return pgx.ErrNoRows
	}
	return respond(w, 200, map[string]bool{"deleted": true})
}

func (a *App) demo(w http.ResponseWriter, r *http.Request) error {
	ctx := r.Context()
	tx, err := a.db.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)
	tag, err := tx.Exec(ctx, "INSERT INTO migrations(name) VALUES('demo_v1') ON CONFLICT DO NOTHING")
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return respond(w, 200, map[string]string{"message": "Демонстрационные записи уже создавались. Удалённые записи не восстановлены."})
	}
	// Seed only from current, active dictionary values; never resurrect edited dictionaries.
	rows, err := tx.Query(ctx, "SELECT id FROM catalog WHERE kind='platform' AND NOT archived ORDER BY position,id")
	if err != nil {
		return err
	}
	var platforms []int64
	for rows.Next() {
		var id int64
		if err = rows.Scan(&id); err != nil {
			rows.Close()
			return err
		}
		platforms = append(platforms, id)
	}
	err = rows.Err()
	rows.Close()
	if err != nil {
		return err
	}
	if len(platforms) == 0 {
		return invalid("Для примеров нужна хотя бы одна активная площадка")
	}
	var statuses []int64
	rows, err = tx.Query(ctx, "SELECT id FROM catalog WHERE kind='status' AND NOT archived ORDER BY position,id")
	if err != nil {
		return err
	}
	for rows.Next() {
		var id int64
		if err = rows.Scan(&id); err != nil {
			rows.Close()
			return err
		}
		statuses = append(statuses, id)
	}
	err = rows.Err()
	rows.Close()
	if err != nil {
		return err
	}
	now := time.Now().UTC()
	topics := []string{"ШР_1: Эрозивная ГЭРБ: как повысить вероятность заживления", "Тегопрекс — баннеры", "Новости клинической практики", "БАННЕР", "Подготовка экспертного материала", "ШР_1: Эрозивная ГЭРБ: как повысить вероятность заживления", "Обзор исследований", "Письмо для врачей общей практики", "Редакционная подборка", "Итоги месяца"}
	days := []int{-2, 2, 5, 8, 14, 21, 30, 3, -3, 10}
	for i, topic := range topics {
		var status any
		if i < len(statuses) {
			status = statuses[i]
		}
		deadline := now.Add(time.Duration(days[i]) * 24 * time.Hour)
		email := ""
		if i%3 != 0 {
			email = deadline.Add(24 * time.Hour).Format("2006-01-02")
		}
		raw, _ := json.Marshal(map[string]string{"topic": topic, "project": "Тегопразан Эрозивная ГЭРБ", "header": "Практика, которая помогает пациентам", "preheader": "Материалы для медицинских специалистов", "comment": "Демонстрационная запись. Даты заданы относительно момента создания примеров.", "owner": "Анна"})
		_, err = tx.Exec(ctx, `INSERT INTO tasks(platform_id,status_id,deadline,email_date,data,completed,completed_at) VALUES($1,$2,$3,NULLIF($4,'')::date,$5,$6,CASE WHEN $6 THEN now() ELSE NULL END)`, platforms[i%len(platforms)], status, deadline, email, raw, i >= 8)
		if err != nil {
			return err
		}
	}
	if err = tx.Commit(ctx); err != nil {
		return err
	}
	a.checkNotifications(ctx)
	return respond(w, 201, map[string]string{"message": "Создано 10 демонстрационных записей"})
}
