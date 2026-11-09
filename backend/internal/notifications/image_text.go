package notifications

import (
	"golang.org/x/image/font"
	"golang.org/x/image/font/opentype"
)

func notificationFace(ttf []byte, size float64) (font.Face, error) {
	parsed, err := opentype.Parse(ttf)
	if err != nil {
		return nil, err
	}
	return opentype.NewFace(parsed, &opentype.FaceOptions{Size: size, DPI: 72, Hinting: font.HintingFull})
}

func fitImageText(face font.Face, text string, width int) string {
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
