package auth

import (
	"net"
	"net/http"
	"os"
	"strings"

	"deadline-tracker/internal/httpx"
	"deadline-tracker/internal/security"
)

func (handler *Service) limitAuth(r *http.Request, scope string, max int) error {
	ctx := r.Context()
	var attempts int
	err := handler.DB.QueryRow(ctx, `
 INSERT INTO auth_limits(scope, attempts, resets_at)
 VALUES($1, 1, now() + interval '15 minutes')
 ON CONFLICT(scope) DO UPDATE SET
   attempts = CASE
     WHEN auth_limits.resets_at <= now() THEN 1
     ELSE auth_limits.attempts + 1
   END,
   resets_at = CASE
     WHEN auth_limits.resets_at <= now() THEN now() + interval '15 minutes'
     ELSE auth_limits.resets_at
   END
 RETURNING attempts`, security.Digest(scope)).Scan(&attempts)
	if err != nil {
		return err
	}
	if attempts > max {
		return &httpx.Error{Code: 429, Message: "Слишком много попыток. Попробуйте через 15 минут"}
	}
	return nil
}

func clientAddress(r *http.Request) string {
	if os.Getenv("VERCEL") == "1" {
		if ip := strings.TrimSpace(strings.Split(r.Header.Get("X-Vercel-Forwarded-For"), ",")[0]); net.ParseIP(ip) != nil {
			return ip
		}
	}
	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err == nil {
		return host
	}
	return r.RemoteAddr
}
