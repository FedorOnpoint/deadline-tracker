package notifications

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"strconv"
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
	return bot.execute(request, method, output)
}

func (bot *Telegram) execute(request *http.Request, method string, output any) error {
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

func (bot *Telegram) SendPhoto(ctx context.Context, chatID int64, photo []byte, caption, appURL string) error {
	var body bytes.Buffer
	writer := multipart.NewWriter(&body)
	fields := map[string]string{"chat_id": strconv.FormatInt(chatID, 10), "caption": caption}
	markup, err := json.Marshal(map[string]any{"inline_keyboard": [][]map[string]string{{{"text": "Открыть задачи", "url": appURL}}}})
	if err != nil {
		return err
	}
	fields["reply_markup"] = string(markup)
	for name, value := range fields {
		if err := writer.WriteField(name, value); err != nil {
			return err
		}
	}
	file, err := writer.CreateFormFile("photo", "digest.png")
	if err != nil {
		return err
	}
	if _, err := file.Write(photo); err != nil {
		return err
	}
	if err := writer.Close(); err != nil {
		return err
	}
	request, err := http.NewRequestWithContext(ctx, http.MethodPost, bot.baseURL+"/bot"+bot.Token+"/sendPhoto", &body)
	if err != nil {
		return fmt.Errorf("telegram: invalid request")
	}
	request.Header.Set("Content-Type", writer.FormDataContentType())
	return bot.execute(request, "sendPhoto", nil)
}

func (bot *Telegram) SendDigestPages(ctx context.Context, chatID int64, photos [][]byte, caption, appURL string) error {
	for i, photo := range photos {
		// Separate messages keep each page readable in the chat. Space them to avoid Telegram's per-chat limit.
		if i > 0 {
			timer := time.NewTimer(time.Second)
			select {
			case <-ctx.Done():
				timer.Stop()
				return ctx.Err()
			case <-timer.C:
			}
		}
		pageCaption := caption
		if len(photos) > 1 {
			pageCaption += fmt.Sprintf("\nСтраница %d/%d", i+1, len(photos))
		}
		if err := bot.SendPhoto(ctx, chatID, photo, pageCaption, appURL); err != nil {
			return err
		}
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
