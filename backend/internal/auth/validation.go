package auth

import (
	"regexp"
	"strings"
	"unicode/utf8"

	"deadline-tracker/internal/httpx"
)

func normalizeCode(code string) string {
	return strings.ToUpper(strings.Join(strings.Fields(strings.ReplaceAll(code, "-", "")), ""))
}

var validLogin = regexp.MustCompile(`^[a-z0-9][a-z0-9._-]{2,63}$`)

func normalizeLogin(login string) string { return strings.ToLower(strings.TrimSpace(login)) }

func validatePassword(password string) error {
	if utf8.RuneCountInString(password) < 8 || len(password) > 72 {
		return httpx.Invalid("Пароль: от 8 символов и не более 72 байт")
	}
	return nil
}
