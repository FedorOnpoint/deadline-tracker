package admin

import (
	"net/http"

	"deadline-tracker/internal/auth"
	"deadline-tracker/internal/httpx"
)

type Handler struct{ Service *Service }

func (handler *Handler) CreateInvitation(w http.ResponseWriter, r *http.Request) error {
	invitation, err := handler.Service.CreateInvitation(r.Context(), auth.UserID(r.Context()))
	if err != nil {
		return err
	}
	return httpx.Respond(w, http.StatusCreated, invitation)
}

func (handler *Handler) ListInvitations(w http.ResponseWriter, r *http.Request) error {
	invitations, err := handler.Service.ListInvitations(r.Context())
	if err != nil {
		return err
	}
	return httpx.Respond(w, http.StatusOK, invitations)
}

func (handler *Handler) RevokeInvitation(w http.ResponseWriter, r *http.Request) error {
	id, err := httpx.PathID(r)
	if err != nil {
		return err
	}
	if err := handler.Service.RevokeInvitation(r.Context(), id); err != nil {
		return err
	}
	return httpx.Respond(w, http.StatusOK, map[string]bool{"ok": true})
}

func (handler *Handler) ListUsers(w http.ResponseWriter, r *http.Request) error {
	users, err := handler.Service.ListUsers(r.Context())
	if err != nil {
		return err
	}
	return httpx.Respond(w, http.StatusOK, users)
}
