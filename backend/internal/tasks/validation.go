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
	if task.PlatformID <= 0 {
		return domain.Invalid("Выберите площадку")
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
