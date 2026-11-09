package notifications

import (
	"bytes"
	"fmt"
	"image"
	"image/color"
	"image/draw"
	"image/png"
	"strings"

	"golang.org/x/image/font"
	"golang.org/x/image/font/gofont/gobold"
	"golang.org/x/image/font/gofont/goregular"
	"golang.org/x/image/math/fixed"
)

type statusChange struct {
	TaskID   int64  `json:"task_id"`
	Topic    string `json:"topic"`
	Previous string `json:"previous"`
	Current  string `json:"current"`
	Actor    string `json:"actor"`
}

func renderStatusChange(change statusChange) ([]byte, error) {
	body, err := notificationFace(goregular.TTF, 30)
	if err != nil {
		return nil, err
	}
	defer body.Close()
	title, err := notificationFace(gobold.TTF, 40)
	if err != nil {
		return nil, err
	}
	defer title.Close()
	canvas := image.NewRGBA(image.Rect(0, 0, 1000, 500))
	background := color.RGBA{21, 24, 28, 255}
	surface := color.RGBA{30, 36, 43, 255}
	text := color.RGBA{237, 240, 243, 255}
	muted := color.RGBA{177, 188, 200, 255}
	accent := color.RGBA{150, 221, 192, 255}
	draw.Draw(canvas, canvas.Bounds(), image.NewUniform(background), image.Point{}, draw.Src)
	write := func(face font.Face, x, y, width int, value string, tint color.RGBA) {
		value = strings.Join(strings.Fields(value), " ")
		drawer := font.Drawer{Dst: canvas, Src: image.NewUniform(tint), Face: face, Dot: fixed.P(x, y)}
		drawer.DrawString(fitImageText(face, value, width))
	}
	write(body, 48, 60, 900, fmt.Sprintf("Карточка #%d · Статус изменён", change.TaskID), muted)
	topic := change.Topic
	if strings.TrimSpace(topic) == "" {
		topic = "Без названия"
	}
	write(title, 48, 130, 900, topic, text)
	draw.Draw(canvas, image.Rect(48, 178, 952, 398), image.NewUniform(surface), image.Point{}, draw.Src)
	write(body, 76, 224, 840, "Было", muted)
	write(body, 76, 272, 840, change.Previous, muted)
	write(body, 76, 326, 840, "Стало", accent)
	write(title, 76, 376, 840, change.Current, text)
	write(body, 48, 458, 900, "Изменил(а): "+change.Actor, muted)
	var output bytes.Buffer
	if err := png.Encode(&output, canvas); err != nil {
		return nil, err
	}
	return output.Bytes(), nil
}
