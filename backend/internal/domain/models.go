package domain

import "time"

type Catalog struct {
	ID           int64   `json:"id"`
	Kind         string  `json:"kind"`
	Name         string  `json:"name"`
	Color        string  `json:"color"`
	Position     int     `json:"position"`
	Archived     bool    `json:"archived"`
	Section      string  `json:"section"`
	PlatformIDs  []int64 `json:"platform_ids"`
	ReminderText string  `json:"reminder_text"`
}
type Task struct {
	Section       string               `json:"section"`
	Fields        []CardField          `json:"fields,omitempty"`
	BaseDate      time.Time            `json:"base_date"`
	DeadlineField string               `json:"deadline_field"`
	DateDeadlines map[string]time.Time `json:"date_deadlines,omitempty"`
	Timezone      string               `json:"timezone"`
	ID            int64                `json:"id"`
	PlatformID    int64                `json:"platform_id"`
	SpecialtyID   *int64               `json:"specialty_id"`
	SpecialtyIDs  []int64              `json:"specialty_ids"`
	StatusID      *int64               `json:"status_id"`
	Deadline      time.Time            `json:"deadline"`
	EmailDate     string               `json:"email_date"`
	SMS           bool                 `json:"sms"`
	Topic         string               `json:"topic"`
	Project       string               `json:"project"`
	Header        string               `json:"header"`
	Preheader     string               `json:"preheader"`
	Comment       string               `json:"comment"`
	Owner         string               `json:"owner"`
	CustomFields  map[string]string    `json:"custom_fields"`
	Completed     bool                 `json:"completed"`
	CompletedAt   *time.Time           `json:"completed_at"`
	CreatedAt     time.Time            `json:"created_at"`
	UpdatedAt     time.Time            `json:"updated_at"`
}
