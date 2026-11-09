package auth

import (
	"context"
	"errors"
	"net"
	"net/http"
	"os"
	"strings"

	"deadline-tracker/internal/domain"
	"deadline-tracker/internal/httpx"
)

const sessionCookie = "deadline_session"

type Handler struct{ Service *Service }

func (handler *Handler) Login(w http.ResponseWriter, r *http.Request) error {
	var input LoginInput
	if err := httpx.Decode(w, r, &input); err != nil {
		return err
	}
	session, err := handler.Service.Login(r.Context(), input, clientAddress(r), currentSession(r))
	if err != nil {
		return authenticationError(err)
	}
	setSession(w, r, session.Token)
	return httpx.Respond(w, http.StatusOK, session.User)
}

func (handler *Handler) Register(w http.ResponseWriter, r *http.Request) error {
	var input RegistrationInput
	if err := httpx.Decode(w, r, &input); err != nil {
		return err
	}
	session, err := handler.Service.Register(r.Context(), input, clientAddress(r))
	if err != nil {
		return authenticationError(err)
	}
	setSession(w, r, session.Token)
	return httpx.Respond(w, http.StatusCreated, session.User)
}

func (handler *Handler) ChangePassword(w http.ResponseWriter, r *http.Request) error {
	var input PasswordInput
	if err := httpx.Decode(w, r, &input); err != nil {
		return err
	}
	token, err := handler.Service.ChangePassword(r.Context(), UserID(r.Context()), input)
	if err != nil {
		return authenticationError(err)
	}
	setSession(w, r, token)
	return httpx.Respond(w, http.StatusOK, map[string]bool{"ok": true})
}

func (handler *Handler) Me(w http.ResponseWriter, r *http.Request) error {
	return httpx.Respond(w, http.StatusOK, CurrentUser(r.Context()))
}

func (handler *Handler) Logout(w http.ResponseWriter, r *http.Request) error {
	if err := handler.Service.Logout(r.Context(), currentSession(r)); err != nil {
		return err
	}
	setSession(w, r, "")
	return httpx.Respond(w, http.StatusOK, map[string]bool{"ok": true})
}

func (handler *Handler) Authenticated(next func(http.ResponseWriter, *http.Request) error, admin bool) func(http.ResponseWriter, *http.Request) error {
	return func(w http.ResponseWriter, r *http.Request) error {
		token := currentSession(r)
		if len(token) != 64 {
			return &httpx.Error{Code: http.StatusUnauthorized, Message: "Войдите в свой аккаунт"}
		}
		user, err := handler.Service.SessionUser(r.Context(), token)
		if errors.Is(err, domain.ErrNotFound) {
			return &httpx.Error{Code: http.StatusUnauthorized, Message: "Сессия завершена. Войдите снова"}
		}
		if err != nil {
			return err
		}
		if admin && user.Role != "admin" {
			return &httpx.Error{Code: http.StatusForbidden, Message: "Доступ только для администратора"}
		}
		ctx := context.WithValue(r.Context(), userContextKey{}, user)
		return next(w, r.WithContext(ctx))
	}
}

func authenticationError(err error) error {
	if errors.Is(err, ErrInvalidCredentials) {
		return &httpx.Error{Code: http.StatusUnauthorized, Message: err.Error()}
	}
	if errors.Is(err, ErrRateLimited) {
		return &httpx.Error{Code: http.StatusTooManyRequests, Message: err.Error()}
	}
	return err
}

func currentSession(r *http.Request) string {
	cookie, err := r.Cookie(sessionCookie)
	if err != nil {
		return ""
	}
	return cookie.Value
}

func setSession(w http.ResponseWriter, r *http.Request, token string) {
	age := int(sessionLifetime.Seconds())
	if token == "" {
		age = -1
	}
	http.SetCookie(w, &http.Cookie{Name: sessionCookie, Value: token, Path: "/", HttpOnly: true, Secure: os.Getenv("VERCEL") == "1" || r.TLS != nil, SameSite: http.SameSiteStrictMode, MaxAge: age})
}

func clientAddress(r *http.Request) string {
	if os.Getenv("VERCEL") == "1" {
		ip := strings.TrimSpace(strings.Split(r.Header.Get("X-Vercel-Forwarded-For"), ",")[0])
		if net.ParseIP(ip) != nil {
			return ip
		}
	}
	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err == nil {
		return host
	}
	return r.RemoteAddr
}
