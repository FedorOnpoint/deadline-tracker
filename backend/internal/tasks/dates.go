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
	// Keep the effective deadline aligned with the most urgent visible date.
	var earliest time.Time
	for _, field := range task.Fields {
		date, exists := task.DateDeadlines[field.ID]
		if exists && (earliest.IsZero() || date.Before(earliest)) {
			earliest = date
			task.DeadlineField = field.ID
		}
	}
	if !earliest.IsZero() {
		task.Deadline = earliest
	}
	return nil
}
