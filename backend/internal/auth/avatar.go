package auth

import (
	"bytes"
	"context"
	"encoding/base64"
	"image"
	"image/jpeg"
	_ "image/png"
	"net/http"
	"strings"

	"deadline-tracker/internal/domain"
	"deadline-tracker/internal/httpx"
)

func (service *Service) SaveAvatar(ctx context.Context, userID int64, data string) error {
	if data == "" {
		return service.Repository.SaveAvatar(ctx, userID, nil)
	}
	_, encoded, ok := strings.Cut(data, ",")
	if !ok || len(encoded) > 400000 {
		return domain.Invalid("Выберите небольшое изображение PNG или JPEG")
	}
	raw, err := base64.StdEncoding.DecodeString(encoded)
	if err != nil {
		return domain.Invalid("Не удалось прочитать изображение")
	}
	config, _, err := image.DecodeConfig(bytes.NewReader(raw))
	if err != nil || config.Width < 1 || config.Height < 1 || config.Width > 512 || config.Height > 512 {
		return domain.Invalid("Изображение должно быть не больше 512 × 512 пикселей")
	}
	decoded, _, err := image.Decode(bytes.NewReader(raw))
	if err != nil {
		return domain.Invalid("Не удалось прочитать изображение")
	}
	var output bytes.Buffer
	if err := jpeg.Encode(&output, decoded, &jpeg.Options{Quality: 85}); err != nil {
		return err
	}
	return service.Repository.SaveAvatar(ctx, userID, output.Bytes())
}

func (handler *Handler) SaveAvatar(w http.ResponseWriter, r *http.Request) error {
	var input struct {
		Image string `json:"image"`
	}
	if err := httpx.Decode(w, r, &input); err != nil {
		return err
	}
	if err := handler.Service.SaveAvatar(r.Context(), UserID(r.Context()), input.Image); err != nil {
		return err
	}
	return httpx.Respond(w, http.StatusOK, map[string]bool{"ok": true})
}

func (handler *Handler) Avatar(w http.ResponseWriter, r *http.Request) error {
	id, err := httpx.PathID(r)
	if err != nil {
		return err
	}
	data, err := handler.Service.Repository.Avatar(r.Context(), id)
	if err != nil {
		return err
	}
	if len(data) == 0 {
		return domain.ErrNotFound
	}
	w.Header().Set("Content-Type", "image/jpeg")
	w.Header().Set("Cache-Control", "private, no-store")
	_, err = w.Write(data)
	return err
}
