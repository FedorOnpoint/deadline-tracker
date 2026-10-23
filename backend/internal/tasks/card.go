package tasks

import (
	"time"

	"deadline-tracker/internal/domain"
	"deadline-tracker/internal/sections"
)

func prepareCard(task *domain.Task, previous domain.Task, template []domain.CardField, patch bool) error {
	if task.Fields == nil {
		task.Fields = previous.Fields
		if task.Fields == nil {
			task.Fields = template
		}
	}
	if err := sections.ValidateFields(task.Fields, previous.Fields); err != nil {
		return err
	}
	if task.DeadlineField == "" {
		task.DeadlineField = "deadline"
	}
	if err := sections.ValidateDeadlineField(task.Fields, task.DeadlineField); err != nil {
		return err
	}
	if task.BaseDate.IsZero() {
		task.BaseDate = task.Deadline
	}
	if task.BaseDate.IsZero() || task.BaseDate.Year() < 1900 || task.BaseDate.Year() > 9999 {
		return domain.Invalid("Укажите корректную основную дату (1900–9999)")
	}
	if task.Timezone == "" {
		task.Timezone = "UTC"
	}
	if err := sections.ValidateValues(task.Fields, task.CustomFields, previous.CustomFields, patch); err != nil {
		return err
	}
	if !patch {
		if err := validateRequiredFields(*task, task.Fields); err != nil {
			return err
		}
	}
	if err := setDateDeadlines(task); err != nil {
		return err
	}
	deadline, exists := task.DateDeadlines[task.DeadlineField]
	if !exists {
		return domain.Invalid("Заполните выбранную дату для отсчёта дедлайна")
	}
	task.Deadline = deadline
	task.BaseDate = task.BaseDate.UTC().Truncate(time.Microsecond)
	task.Deadline = task.Deadline.UTC().Truncate(time.Microsecond)
	return nil
}
