package tasks

import (
	"net/http"
	"strconv"

	"deadline-tracker/internal/auth"
	"deadline-tracker/internal/httpx"
)

type SharingHandler struct{ Service *SharingService }

func (handler *SharingHandler) List(w http.ResponseWriter, r *http.Request) error {
	tasks, err := handler.Service.List(r.Context(), auth.UserID(r.Context()))
	if err != nil {
		return err
	}
	return httpx.Respond(w, http.StatusOK, tasks)
}

func (handler *SharingHandler) Members(w http.ResponseWriter, r *http.Request) error {
	id, err := httpx.PathID(r)
	if err != nil {
		return err
	}
	members, err := handler.Service.Members(r.Context(), auth.UserID(r.Context()), id)
	if err != nil {
		return err
	}
	return httpx.Respond(w, http.StatusOK, members)
}

func (handler *SharingHandler) Add(w http.ResponseWriter, r *http.Request) error {
	id, err := httpx.PathID(r)
	if err != nil {
		return err
	}
	var input struct {
		Login string `json:"login"`
	}
	if err := httpx.Decode(w, r, &input); err != nil {
		return err
	}
	if err := handler.Service.Add(r.Context(), auth.UserID(r.Context()), id, input.Login); err != nil {
		return err
	}
	return httpx.Respond(w, http.StatusOK, map[string]bool{"ok": true})
}

func (handler *SharingHandler) Remove(w http.ResponseWriter, r *http.Request) error {
	id, err := httpx.PathID(r)
	if err != nil {
		return err
	}
	memberID, err := strconv.ParseInt(r.PathValue("memberID"), 10, 64)
	if err != nil || memberID <= 0 {
		return httpx.Invalid("Некорректный участник")
	}
	if err := handler.Service.Remove(r.Context(), auth.UserID(r.Context()), id, memberID); err != nil {
		return err
	}
	return httpx.Respond(w, http.StatusOK, map[string]bool{"ok": true})
}

func (handler *SharingHandler) Candidates(w http.ResponseWriter, r *http.Request) error {
	id, err := httpx.PathID(r)
	if err != nil {
		return err
	}
	users, err := handler.Service.Candidates(r.Context(), auth.UserID(r.Context()), id)
	if err != nil {
		return err
	}
	return httpx.Respond(w, http.StatusOK, users)
}
