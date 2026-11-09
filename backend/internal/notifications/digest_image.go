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
	"golang.org/x/image/font/opentype"
	"golang.org/x/image/math/fixed"
)

const digestPreviewLimit = 3

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

func renderDigest(tasks []digestTask, now time.Time) ([]byte, error) {
	regular, err := opentype.Parse(goregular.TTF)
	if err != nil {
		return nil, err
	}
	bold, err := opentype.Parse(gobold.TTF)
	if err != nil {
		return nil, err
	}
	body, err := opentype.NewFace(regular, &opentype.FaceOptions{Size: 28, DPI: 72, Hinting: font.HintingFull})
	if err != nil {
		return nil, err
	}
	defer body.Close()
	title, err := opentype.NewFace(bold, &opentype.FaceOptions{Size: 32, DPI: 72, Hinting: font.HintingFull})
	if err != nil {
		return nil, err
	}
	defer title.Close()
	heading, err := opentype.NewFace(bold, &opentype.FaceOptions{Size: 46, DPI: 72, Hinting: font.HintingFull})
	if err != nil {
		return nil, err
	}
	defer heading.Close()
	groups := groupDigest(tasks, now)
	height := 332
	for _, group := range groups {
		height += 88 + min(len(group.tasks), digestPreviewLimit)*152
		if len(group.tasks) == 0 || len(group.tasks) > digestPreviewLimit {
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
	write(body, 48, 64, "DEADLINE TRACKER", muted)
	write(heading, 48, 132, "Сводка задач", text)
	write(body, 48, 180, now.Format("02.01.2006")+" · "+now.Location().String(), muted)
	x := 48
	for _, group := range groups {
		write(heading, x, 252, fmt.Sprint(len(group.tasks)), group.accent)
		write(body, x, 290, group.title, muted)
		x += 300
	}
	y := 326
	for _, group := range groups {
		write(title, 48, y+44, group.title, group.accent)
		y += 72
		for _, task := range group.tasks[:min(len(group.tasks), digestPreviewLimit)] {
			draw.Draw(canvas, image.Rect(48, y, 952, y+136), image.NewUniform(surface), image.Point{}, draw.Src)
			draw.Draw(canvas, image.Rect(48, y, 52, y+136), image.NewUniform(group.accent), image.Point{}, draw.Src)
			topic := strings.Join(strings.Fields(task.Topic), " ")
			if topic == "" {
				topic = "Без названия"
			}
			write(title, 76, y+44, fitDigestText(title, topic, 848), text)
			write(body, 76, y+82, fmt.Sprintf("#%d · Срок: %s", task.ID, task.Deadline.In(now.Location()).Format("02.01 · 15:04")), muted)
			write(body, 76, y+118, fitDigestText(body, "Статус: "+strings.Join(strings.Fields(task.Status), " "), 848), muted)
			y += 152
		}
		if len(group.tasks) == 0 {
			write(body, 48, y+28, "Нет задач", muted)
			y += 44
		}
		if len(group.tasks) > digestPreviewLimit {
			write(body, 48, y+28, fmt.Sprintf("Ещё %d — в приложении", len(group.tasks)-digestPreviewLimit), muted)
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

func fitDigestText(face font.Face, text string, width int) string {
	if font.MeasureString(face, text).Ceil() <= width {
		return text
	}
	runes := []rune(text)
	low, high := 0, len(runes)
	for low < high {
		middle := (low + high + 1) / 2
		candidate := string(runes[:middle]) + "…"
		if font.MeasureString(face, candidate).Ceil() <= width {
			low = middle
		} else {
			high = middle - 1
		}
	}
	return string(runes[:low]) + "…"
}
