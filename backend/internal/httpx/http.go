package httpx

import (
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"net/url"
	"strings"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
)

type Error struct {
	Code    int
	Message string
}

func (e *Error) Error() string     { return e.Message }
func Invalid(message string) error { return &Error{400, message} }

func Handle(fn func(http.ResponseWriter, *http.Request) error) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json; charset=utf-8")
		w.Header().Set("Cache-Control", "no-store")
		w.Header().Set("X-Content-Type-Options", "nosniff")
		// Reject cross-origin mutations, including form submissions from other sites.
		if r.Method != "GET" && r.Method != "HEAD" {
			if origin := r.Header.Get("Origin"); origin != "" {
				parsed, err := url.Parse(origin)
				if err != nil || parsed.Host != r.Host || (parsed.Scheme != "https" && parsed.Scheme != "http") {
					_ = Respond(w, 403, map[string]string{"error": "Запрос с другого сайта запрещён"})
					return
				}
			}

			if r.Header.Get("Sec-Fetch-Site") == "cross-site" {
				_ = Respond(w, 403, map[string]string{"error": "Запрос с другого сайта запрещён"})
				return
			}
			if !strings.HasPrefix(r.Header.Get("Content-Type"), "application/json") {
				_ = Respond(w, 415, map[string]string{"error": "Ожидается JSON"})
				return
			}
		}
		if err := fn(w, r); err != nil {
			code, message := 500, "Не удалось выполнить запрос. Повторите попытку."
			var ae *Error
			var pe *pgconn.PgError
			switch {
			case errors.As(err, &ae):
				code, message = ae.Code, ae.Message
			case errors.Is(err, pgx.ErrNoRows):
				code, message = 404, "Запись не найдена"
			case errors.As(err, &pe):
				switch pe.Code {
				case "23505":
					code, message = 409, "Такое название уже существует"
					if pe.ConstraintName == "users_login" {
						message = "Этот логин уже занят"
					}
				case "23503", "23514", "22007", "22008":
					code, message = 400, "Проверьте значения полей и справочников"
				}
			}
			if code == 500 {
				slog.Error("request_error", "method", r.Method, "path", r.URL.Path, "error", err)
			}
			_ = Respond(w, code, map[string]string{"error": message})
		}
	}
}
func Respond(w http.ResponseWriter, code int, value any) error {
	w.WriteHeader(code)
	return json.NewEncoder(w).Encode(value)
}
func Decode(w http.ResponseWriter, r *http.Request, v any) error {
	r.Body = http.MaxBytesReader(w, r.Body, 1024*1024)
	decoder := json.NewDecoder(r.Body)
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(v); err != nil {
		return Invalid("Некорректные данные запроса")
	}
	if err := decoder.Decode(new(any)); err != io.EOF {
		return Invalid("Ожидается один объект JSON")
	}
	return nil
}
func PathID(r *http.Request) (int64, error) {
	var id int64
	_, err := fmt.Sscan(r.PathValue("id"), &id)
	if err != nil || id <= 0 || fmt.Sprint(id) != r.PathValue("id") {
		return 0, Invalid("Некорректный ID")
	}
	return id, nil
}
