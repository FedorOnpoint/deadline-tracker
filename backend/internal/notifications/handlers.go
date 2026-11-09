package notifications

import (
	"crypto/subtle"
	"errors"
	"net/http"

	"deadline-tracker/internal/auth"
	"deadline-tracker/internal/httpx"
)

type CronHandler struct {
	Service *Service
	Secret  string
}

func (handler *CronHandler) Daily(w http.ResponseWriter, r *http.Request) error {
	if handler.Secret == "" || subtle.ConstantTimeCompare([]byte(r.Header.Get("Authorization")), []byte("Bearer "+handler.Secret)) != 1 {
		return &httpx.Error{Code: http.StatusUnauthorized, Message: "Unauthorized"}
	}
	if err := handler.Service.CheckAll(r.Context()); err != nil {
		return err
	}
	if handler.Service.Telegram != nil {
		if err := handler.Service.TickTelegram(r.Context()); err != nil {
			return err
		}
	}
	return httpx.Respond(w, http.StatusOK, map[string]string{"status": "ok"})
}

type SettingsHandler struct{ Service *SettingsService }

func (handler *SettingsHandler) Settings(w http.ResponseWriter, r *http.Request) error {
	settings, err := handler.Service.Settings(r.Context(), auth.UserID(r.Context()))
	if err != nil {
		return err
	}
	return httpx.Respond(w, http.StatusOK, settings)
}

func (handler *SettingsHandler) SaveSettings(w http.ResponseWriter, r *http.Request) error {
	var input TelegramPreferences
	if err := httpx.Decode(w, r, &input); err != nil {
		return err
	}
	settings, err := handler.Service.Save(r.Context(), auth.UserID(r.Context()), input)
	if err != nil {
		return err
	}
	return httpx.Respond(w, http.StatusOK, settings)
}

func (handler *SettingsHandler) Connect(w http.ResponseWriter, r *http.Request) error {
	link, err := handler.Service.Connect(r.Context(), auth.UserID(r.Context()))
	if errors.Is(err, ErrTelegramUnavailable) {
		return &httpx.Error{Code: http.StatusServiceUnavailable, Message: err.Error()}
	}
	if err != nil {
		return err
	}
	return httpx.Respond(w, http.StatusOK, map[string]string{"url": link})
}

func (handler *SettingsHandler) Disconnect(w http.ResponseWriter, r *http.Request) error {
	settings, err := handler.Service.Disconnect(r.Context(), auth.UserID(r.Context()))
	if err != nil {
		return err
	}
	return httpx.Respond(w, http.StatusOK, settings)
}
