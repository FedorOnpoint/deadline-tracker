package main

import "time"

func urgency(deadline time.Time, completed bool, now time.Time) string {
	if completed {
		return "done"
	}
	left := deadline.Sub(now)
	if left <= 0 {
		return "overdue"
	}
	if left < 7*24*time.Hour {
		return "urgent"
	}
	if left <= 14*24*time.Hour {
		return "soon"
	}
	return "neutral"
}
