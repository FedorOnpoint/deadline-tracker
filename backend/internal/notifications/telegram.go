package notifications

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"
)

type Telegram struct {
	Token   string
	Client  *http.Client
	baseURL string
}

func NewTelegram(token string) *Telegram {
	if token == "" {
		return nil
	}
	return &Telegram{Token: token, Client: &http.Client{Timeout: 15 * time.Second}, baseURL: "https://api.telegram.org"}
}

func (bot *Telegram) call(ctx context.Context, method string, input, output any) error {
	body, err := json.Marshal(input)
	if err != nil {
		return err
	}
	request, err := http.NewRequestWithContext(ctx, http.MethodPost, bot.baseURL+"/bot"+bot.Token+"/"+method, bytes.NewReader(body))
	if err != nil {
		return fmt.Errorf("telegram: invalid request")
	}
	request.Header.Set("Content-Type", "application/json")
	response, err := bot.Client.Do(request)
	// Transport errors contain the URL, including the bot token. Never propagate it to logs.
	if err != nil {
		return fmt.Errorf("telegram %s: transport failed", method)
	}
	defer response.Body.Close()
	var envelope struct {
		OK        bool            `json:"ok"`
		Result    json.RawMessage `json:"result"`
		ErrorCode int             `json:"error_code"`
	}
	if err := json.NewDecoder(io.LimitReader(response.Body, 2<<20)).Decode(&envelope); err != nil {
		return fmt.Errorf("telegram %s: invalid response", method)
	}
	if response.StatusCode != 200 || !envelope.OK {
		return fmt.Errorf("telegram %s: API error %d (HTTP %d)", method, envelope.ErrorCode, response.StatusCode)
	}
	if output != nil {
		return json.Unmarshal(envelope.Result, output)
	}
	return nil
}

func (bot *Telegram) Send(ctx context.Context, chatID int64, text string) error {
	runes := []rune(text)
	for len(runes) > 0 {
		length := min(len(runes), 3500)
		if err := bot.call(ctx, "sendMessage", map[string]any{"chat_id": chatID, "text": string(runes[:length]), "link_preview_options": map[string]bool{"is_disabled": true}}, nil); err != nil {
			return err
		}
		runes = runes[length:]
	}
	return nil
}

func (bot *Telegram) Username(ctx context.Context) (string, error) {
	var profile struct {
		Username string `json:"username"`
	}
	err := bot.call(ctx, "getMe", map[string]any{}, &profile)
	return profile.Username, err
}
