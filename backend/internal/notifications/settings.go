package notifications

import (
	"context"
	"errors"
	"net/url"
	"regexp"
	"time"

	"deadline-tracker/internal/domain"
	"deadline-tracker/internal/security"
)

var ErrTelegramUnavailable = errors.New("Telegram-бот пока не настроен на сервере")
var clockPattern = regexp.MustCompile(`^([01][0-9]|2[0-3]):[0-5][0-9]$`)

type TelegramPreferences struct {
	DigestTime    string `json:"digest_time"`
	Timezone      string `json:"timezone"`
	DigestEnabled bool   `json:"digest_enabled"`
	StatusEnabled bool   `json:"status_enabled"`
}

type TelegramSettings struct {
	Available bool `json:"available"`
	Connected bool `json:"connected"`
	TelegramPreferences
}

type SettingsRepository interface {
	Settings(ctx context.Context, userID int64) (TelegramSettings, error)
	SaveSettings(ctx context.Context, userID int64, preferences TelegramPreferences) error
	SaveLink(ctx context.Context, userID int64, tokenHash string) error
	Disconnect(ctx context.Context, userID int64) error
}

type SettingsService struct {
	Repository SettingsRepository
	Telegram   *Telegram
}

func (service *SettingsService) Settings(ctx context.Context, userID int64) (TelegramSettings, error) {
	settings, err := service.Repository.Settings(ctx, userID)
	settings.Available = service.Telegram != nil
	return settings, err
}

func (service *SettingsService) Save(ctx context.Context, userID int64, input TelegramPreferences) (TelegramSettings, error) {
	if !clockPattern.MatchString(input.DigestTime) || len(input.Timezone) > 100 {
		return TelegramSettings{}, domain.Invalid("Проверьте время сводки и часовой пояс")
	}
	if _, err := time.LoadLocation(input.Timezone); err != nil || input.Timezone == "" || input.Timezone == "Local" {
		return TelegramSettings{}, domain.Invalid("Неизвестный часовой пояс")
	}
	if err := service.Repository.SaveSettings(ctx, userID, input); err != nil {
		return TelegramSettings{}, err
	}
	return service.Settings(ctx, userID)
}

func (service *SettingsService) Connect(ctx context.Context, userID int64) (string, error) {
	if service.Telegram == nil {
		return "", ErrTelegramUnavailable
	}
	username, err := service.Telegram.Username(ctx)
	if err != nil {
		return "", err
	}
	if username == "" {
		return "", domain.Invalid("Не удалось получить имя бота")
	}
	token, err := security.RandomToken(24)
	if err != nil {
		return "", err
	}
	if err := service.Repository.SaveLink(ctx, userID, security.Digest(token)); err != nil {
		return "", err
	}
	return "https://t.me/" + url.PathEscape(username) + "?start=" + token, nil
}

func (service *SettingsService) Disconnect(ctx context.Context, userID int64) (TelegramSettings, error) {
	if err := service.Repository.Disconnect(ctx, userID); err != nil {
		return TelegramSettings{}, err
	}
	return service.Settings(ctx, userID)
}
