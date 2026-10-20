package sections

import (
	"deadline-tracker/internal/auth"
	"deadline-tracker/internal/domain"
	"deadline-tracker/internal/httpx"
	"net/http"
)

type Handler struct{ Service *Service }

func (h *Handler) List(w http.ResponseWriter, r *http.Request) error {
	sections, err := h.Service.List(r.Context(), auth.UserID(r.Context()))
	if err != nil {
		return err
	}
	return httpx.Respond(w, http.StatusOK, sections)
}

func (h *Handler) Save(w http.ResponseWriter, r *http.Request) error {
	var input domain.TaskSection
	if err := httpx.Decode(w, r, &input); err != nil {
		return err
	}
	section, err := h.Service.Save(r.Context(), auth.UserID(r.Context()), r.PathValue("key"), input)
	if err != nil {
		return err
	}
	code := http.StatusOK
	if r.Method == http.MethodPost {
		code = http.StatusCreated
	}
	return httpx.Respond(w, code, section)
}

func (h *Handler) Delete(w http.ResponseWriter, r *http.Request) error {
	if err := h.Service.Delete(r.Context(), auth.UserID(r.Context()), r.PathValue("key")); err != nil {
		return err
	}
	return httpx.Respond(w, http.StatusOK, map[string]bool{"deleted": true})
}
