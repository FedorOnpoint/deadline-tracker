package tasks

import (
	"time"

	"deadline-tracker/internal/domain"
)

func setDateDeadlines(task *domain.Task) error {
	zone := task.Timezone
	if zone == "" {
		zone = "UTC"
	}
	location, err := time.LoadLocation(zone)
	if err != nil {
		return domain.Invalid("Неизвестный часовой пояс")
	}
	if task.BaseDate.IsZero() {
		task.BaseDate = task.Deadline
	}
	task.DateDeadlines = map[string]time.Time{}
	for _, field := range task.Fields {
		if field.Visibility == "hidden" || (field.Type != "date" && field.Type != "datetime") {
			continue
		}
		if field.ID == "deadline" {
			task.DateDeadlines[field.ID] = task.BaseDate
			continue
		}
		value := task.CustomFields[field.ID]
		if field.ID == "email_date" {
			value = task.EmailDate
		}
		if value == "" {
			continue
		}
		var date time.Time
		if field.Type == "date" {
			date, err = time.ParseInLocation("2006-01-02", value, location)
			if err == nil {
				date = time.Date(date.Year(), date.Month(), date.Day(), 23, 59, 0, 0, location)
			}
		} else {
			date, err = time.Parse(time.RFC3339, value)
		}
		if err != nil {
			return domain.Invalid("Некорректная дата в поле «" + field.Label + "»")
		}
		task.DateDeadlines[field.ID] = date.UTC()
	}
	// Completion belongs to a particular status binding and planned date.
	// Moving to another status preserves it; rescheduling the date starts a new stage.
	completed := map[string]domain.CompletedDateField{}
	task.HasActiveDeadlines = false
	task.DeadlineField = ""
	// Keep the effective deadline aligned with the most urgent unfinished date.
	var earliest time.Time
	for _, field := range task.Fields {
		date, exists := task.DateDeadlines[field.ID]
		if !exists {
			continue
		}
		if field.CompletionStatusID != nil {
			saved, done := task.CompletedDateFields[field.ID]
			if (done && saved.StatusID == *field.CompletionStatusID && saved.Deadline.Equal(date)) ||
				(task.StatusID != nil && *task.StatusID == *field.CompletionStatusID) {
				completed[field.ID] = domain.CompletedDateField{StatusID: *field.CompletionStatusID, Deadline: date}
				continue
			}
		}
		task.HasActiveDeadlines = true
		if earliest.IsZero() || date.Before(earliest) {
			earliest = date
			task.DeadlineField = field.ID
		}
	}
	task.CompletedDateFields = completed
	if !earliest.IsZero() {
		task.Deadline = earliest
	} else {
		task.Deadline = task.BaseDate
	}
	return nil
}
