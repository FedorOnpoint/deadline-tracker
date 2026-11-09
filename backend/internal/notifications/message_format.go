package notifications

import (
	"fmt"
	"html"
	"strings"
	"time"
)

type statusChange struct {
	TaskID   int64  `json:"task_id"`
	Topic    string `json:"topic"`
	Previous string `json:"previous"`
	Current  string `json:"current"`
	Actor    string `json:"actor"`
}

type digestGroup struct {
	title string
	tasks []digestTask
}

func groupDigest(tasks []digestTask, now time.Time) []digestGroup {
	start := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, now.Location())
	tomorrow := start.AddDate(0, 0, 1)
	end := tomorrow.AddDate(0, 0, 7)
	groups := []digestGroup{{title: "Просроченные"}, {title: "Сегодня"}, {title: "Ближайшие 7 дней"}}
	for _, task := range tasks {
		switch {
		case task.Deadline.Before(start):
			groups[0].tasks = append(groups[0].tasks, task)
		case task.Deadline.Before(tomorrow):
			groups[1].tasks = append(groups[1].tasks, task)
		case task.Deadline.Before(end):
			groups[2].tasks = append(groups[2].tasks, task)
		}
	}
	return groups
}

func formatDigestMessages(tasks []digestTask, now time.Time) []string {
	groups := groupDigest(tasks, now)
	header := fmt.Sprintf("<b>Сводка задач · %s</b>\nПросрочено: <b>%d</b> · Сегодня: <b>%d</b> · На 7 дней: <b>%d</b>", now.Format("02.01.2006"), len(groups[0].tasks), len(groups[1].tasks), len(groups[2].tasks))
	messages := []string{}
	current := header
	for _, group := range groups {
		section := fmt.Sprintf("\n\n<b>%s · %d</b>", group.title, len(group.tasks))
		for index, task := range group.tasks {
			topic := messageText(task.Topic, 250)
			if topic == "" {
				topic = "Без названия"
			}
			block := fmt.Sprintf("\n\n<b>%s</b> · #%d\nСрок: %s <b>%s</b>\nСтатус: %s", topic, task.ID, deadlineMarker(task.Deadline, now), task.Deadline.In(now.Location()).Format("02.01.2006, 15:04"), messageText(task.Status, 150))
			prefix := ""
			if index == 0 {
				prefix = section
			}
			// Bound complete escaped HTML blocks, leaving room for the page number.
			if len(current)+len(prefix)+len(block) > 3300 {
				messages = append(messages, current)
				current = header
				prefix = section
				if index > 0 {
					prefix += " <i>(продолжение)</i>"
				}
			}
			current += prefix + block
		}
	}
	if current == header {
		current += "\n\nНет незавершённых задач с ближайшими сроками."
	}
	messages = append(messages, current)
	if len(messages) > 1 {
		for index := range messages {
			messages[index] += fmt.Sprintf("\n\n<i>Часть %d из %d</i>", index+1, len(messages))
		}
	}
	return messages
}

func deadlineMarker(deadline, now time.Time) string {
	start := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, now.Location())
	switch {
	case deadline.Before(start):
		return "🔴"
	case deadline.Before(start.AddDate(0, 0, 1)):
		return "🟠"
	default:
		return "🟢"
	}
}

func formatStatusChange(change statusChange) string {
	topic := messageText(change.Topic, 250)
	if topic == "" {
		topic = "Без названия"
	}
	return fmt.Sprintf("<b>Статус изменён</b> · #%d\n\n<b>%s</b>\n\n%s → <b>%s</b>\n\nИзменил(а): %s", change.TaskID, topic, messageText(change.Previous, 150), messageText(change.Current, 150), messageText(change.Actor, 150))
}

func messageText(value string, limit int) string {
	runes := []rune(strings.Join(strings.Fields(value), " "))
	if len(runes) > limit {
		value = string(runes[:limit]) + "…"
	} else {
		value = string(runes)
	}
	return html.EscapeString(value)
}
