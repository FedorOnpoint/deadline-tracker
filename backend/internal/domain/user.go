package domain

import "time"

type User struct {
	ID        int64     `json:"id"`
	Login     string    `json:"login"`
	Name      string    `json:"name"`
	Role      string    `json:"role"`
	Disabled  bool      `json:"disabled"`
	CreatedAt time.Time `json:"created_at"`
}
