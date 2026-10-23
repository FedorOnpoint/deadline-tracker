package tasks

import (
	"strings"
	"time"
	"unicode/utf8"

	"deadline-tracker/internal/domain"
)

func validateTask(task *domain.Task) error {
	task.Topic = strings.TrimSpace(task.Topic)
	if task.Topic == "" {
		return domain.Invalid("Укажите тему")
	}
	for _, s := range []string{task.Topic, task.Project, task.Header, task.Preheader, task.Comment, task.Owner} {
		if utf8.RuneCountInString(s) > 20000 {
			return domain.Invalid("В каждом текстовом поле допускается не более 20000 символов")
		}
	}
	if task.PlatformID < 0 || task.Section == "" || len(task.Section) > 100 {
		return domain.Invalid("Выберите раздел карточки")
	}
	if task.Deadline.IsZero() || task.Deadline.Year() < 1900 || task.Deadline.Year() > 9999 {
		return domain.Invalid("Укажите корректный дедлайн (1900–9999)")
	}
	task.Deadline = task.Deadline.UTC().Truncate(time.Microsecond)
	if task.EmailDate != "" {
		d, err := time.Parse("2006-01-02", task.EmailDate)
		if err != nil || d.Year() < 1900 {
			return domain.Invalid("Укажите корректную дату e-mail (1900–9999)")
		}
	}
	return nil
}

func validateRequiredFields(task domain.Task, fields []domain.CardField) error {
	values := map[string]string{"email_date": task.EmailDate, "project": task.Project, "owner": task.Owner, "header": task.Header, "preheader": task.Preheader, "comment": task.Comment}
	for _, field := range fields {
		if !field.Required {
			continue
		}
		if field.ID == "sms" && !task.SMS {
			return domain.Invalid("Установите флажок «" + field.Label + "»")
		}
		value, exists := values[field.ID]
		if (field.ID == "platform_id" && task.PlatformID == 0) || (field.ID == "status_id" && task.StatusID == nil) {
			return domain.Invalid("Заполните поле «" + field.Label + "»")
		}
		if (exists && strings.TrimSpace(value) == "") || (field.ID == "specialty_id" && task.SpecialtyID == nil) {
			return domain.Invalid("Заполните поле «" + field.Label + "»")
		}
	}
	return nil
}
