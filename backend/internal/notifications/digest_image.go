package notifications

import (
	"bytes"
	"fmt"
	"image"
	"image/color"
	"image/draw"
	"image/png"
	"strings"
	"time"

	"golang.org/x/image/font"
	"golang.org/x/image/font/gofont/gobold"
	"golang.org/x/image/font/gofont/goregular"
	"golang.org/x/image/math/fixed"
)

const digestTasksPerPage = 3

type digestGroup struct {
	title  string
	tasks  []digestTask
	accent color.RGBA
}

func groupDigest(tasks []digestTask, now time.Time) []digestGroup {
	start := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, now.Location())
	tomorrow := start.AddDate(0, 0, 1)
	end := tomorrow.AddDate(0, 0, 7)
	groups := []digestGroup{
		{title: "Просроченные", accent: color.RGBA{255, 160, 158, 255}},
		{title: "Сегодня", accent: color.RGBA{234, 208, 149, 255}},
		{title: "Ближайшие 7 дней", accent: color.RGBA{150, 221, 192, 255}},
	}
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

func paginateDigest(groups []digestGroup) [][]digestGroup {
	pages := [][]digestGroup{}
	var page []digestGroup
	remaining := digestTasksPerPage
	for _, group := range groups {
		for start := 0; start < len(group.tasks); {
			count := min(remaining, len(group.tasks)-start)
			part := group
			part.tasks = group.tasks[start : start+count]
			page = append(page, part)
			start += count
			remaining -= count
			if remaining == 0 {
				pages = append(pages, page)
				page = nil
				remaining = digestTasksPerPage
			}
		}
	}
	if len(page) > 0 {
		pages = append(pages, page)
	}
	if len(pages) == 0 {
		pages = append(pages, groups)
	}
	return pages
}

func renderDigestPages(tasks []digestTask, now time.Time) ([][]byte, error) {
	groups := groupDigest(tasks, now)
	pages := paginateDigest(groups)
	images := make([][]byte, 0, len(pages))
	for i, page := range pages {
		photo, err := renderDigestPage(page, groups, now, i+1, len(pages))
		if err != nil {
			return nil, err
		}
		images = append(images, photo)
	}
	return images, nil
}

func renderDigestPage(groups, totals []digestGroup, now time.Time, page, pageCount int) ([]byte, error) {
	body, err := notificationFace(goregular.TTF, 28)
	if err != nil {
		return nil, err
	}
	defer body.Close()
	title, err := notificationFace(gobold.TTF, 32)
	if err != nil {
		return nil, err
	}
	defer title.Close()
	heading, err := notificationFace(gobold.TTF, 46)
	if err != nil {
		return nil, err
	}
	defer heading.Close()
	height := 272
	for _, group := range groups {
		height += 64 + len(group.tasks)*152
		if len(group.tasks) == 0 {
			height += 44
		}
	}
	canvas := image.NewRGBA(image.Rect(0, 0, 1000, height))
	background := color.RGBA{21, 24, 28, 255}
	surface := color.RGBA{30, 36, 43, 255}
	text := color.RGBA{237, 240, 243, 255}
	muted := color.RGBA{177, 188, 200, 255}
	draw.Draw(canvas, canvas.Bounds(), image.NewUniform(background), image.Point{}, draw.Src)
	write := func(face font.Face, x, y int, value string, tint color.RGBA) {
		drawer := font.Drawer{Dst: canvas, Src: image.NewUniform(tint), Face: face, Dot: fixed.P(x, y)}
		drawer.DrawString(value)
	}
	write(body, 48, 48, fmt.Sprintf("DEADLINE TRACKER · %d/%d", page, pageCount), muted)
	write(heading, 48, 108, "Сводка задач", text)
	write(body, 48, 152, now.Format("02.01.2006")+" · "+now.Location().String(), muted)
	x := 48
	for _, group := range totals {
		write(heading, x, 216, fmt.Sprint(len(group.tasks)), group.accent)
		write(body, x, 254, group.title, muted)
		x += 300
	}
	y := 266
	for _, group := range groups {
		write(title, 48, y+36, group.title, group.accent)
		y += 48
		for _, task := range group.tasks {
			draw.Draw(canvas, image.Rect(48, y, 952, y+136), image.NewUniform(surface), image.Point{}, draw.Src)
			draw.Draw(canvas, image.Rect(48, y, 52, y+136), image.NewUniform(group.accent), image.Point{}, draw.Src)
			topic := strings.Join(strings.Fields(task.Topic), " ")
			if topic == "" {
				topic = "Без названия"
			}
			write(title, 76, y+44, fitImageText(title, topic, 848), text)
			write(body, 76, y+82, fmt.Sprintf("#%d · Срок: %s", task.ID, task.Deadline.In(now.Location()).Format("02.01 · 15:04")), muted)
			write(body, 76, y+118, fitImageText(body, "Статус: "+strings.Join(strings.Fields(task.Status), " "), 848), muted)
			y += 152
		}
		if len(group.tasks) == 0 {
			write(body, 48, y+28, "Нет задач", muted)
			y += 44
		}
		y += 16
	}
	var output bytes.Buffer
	if err := png.Encode(&output, canvas); err != nil {
		return nil, err
	}
	return output.Bytes(), nil
}
