package domain

import (
	"time"
)

type Catalog struct {
	ID       int64  `json:"id"`
	Kind     string `json:"kind"`
	Name     string `json:"name"`
	Color    string `json:"color"`
	Position int    `json:"position"`
	Archived bool   `json:"archived"`
	Section  string `json:"section"`
}
type Task struct {
	ID          int64      `json:"id"`
	PlatformID  int64      `json:"platform_id"`
	SpecialtyID *int64     `json:"specialty_id"`
	StatusID    *int64     `json:"status_id"`
	Deadline    time.Time  `json:"deadline"`
	EmailDate   string     `json:"email_date"`
	Topic       string     `json:"topic"`
	Project     string     `json:"project"`
	Header      string     `json:"header"`
	Preheader   string     `json:"preheader"`
	Comment     string     `json:"comment"`
	Owner       string     `json:"owner"`
	Completed   bool       `json:"completed"`
	CompletedAt *time.Time `json:"completed_at"`
	CreatedAt   time.Time  `json:"created_at"`
	UpdatedAt   time.Time  `json:"updated_at"`
}
