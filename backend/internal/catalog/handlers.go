package catalog

import (
	"net/http"

	"deadline-tracker/internal/auth"
	"deadline-tracker/internal/domain"
	"deadline-tracker/internal/httpx"
)

type Handler struct{ Service *Service }

func (handler *Handler) List(w http.ResponseWriter, r *http.Request) error {
	items, err := handler.Service.List(r.Context(), auth.UserID(r.Context()))
	if err != nil {
		return err
	}
	return httpx.Respond(w, http.StatusOK, items)
}

func (handler *Handler) Save(w http.ResponseWriter, r *http.Request) error {
	var item domain.Catalog
	if err := httpx.Decode(w, r, &item); err != nil {
		return err
	}
	var id int64
	if r.Method == http.MethodPut {
		var err error
		id, err = httpx.PathID(r)
		if err != nil {
			return err
		}
	}
	item, err := handler.Service.Save(r.Context(), auth.UserID(r.Context()), id, item)
	if err != nil {
		return err
	}
	return httpx.Respond(w, http.StatusOK, item)
}
