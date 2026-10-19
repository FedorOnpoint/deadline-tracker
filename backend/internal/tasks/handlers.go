package tasks

import (
	"encoding/json"
	"net/http"

	"deadline-tracker/internal/auth"
	"deadline-tracker/internal/domain"
	"deadline-tracker/internal/httpx"
)

type Handler struct{ Service *Service }

func (handler *Handler) List(w http.ResponseWriter, r *http.Request) error {
	tasks, err := handler.Service.List(r.Context(), auth.UserID(r.Context()))
	if err != nil {
		return err
	}
	return httpx.Respond(w, http.StatusOK, tasks)
}

func (handler *Handler) Save(w http.ResponseWriter, r *http.Request) error {
	ctx := r.Context()
	userID := auth.UserID(ctx)
	var id int64
	if r.Method != http.MethodPost {
		var err error
		id, err = httpx.PathID(r)
		if err != nil {
			return err
		}
	}
	var task domain.Task
	var err error
	if r.Method == http.MethodPatch {
		var patch TaskPatch
		patch, err = decodePatch(w, r)
		if err == nil {
			task, err = handler.Service.Patch(ctx, userID, id, patch)
		}
	} else {
		if err := httpx.Decode(w, r, &task); err != nil {
			return err
		}
		if r.Method == http.MethodPost {
			task, err = handler.Service.Create(ctx, userID, task)
		} else {
			task, err = handler.Service.Update(ctx, userID, id, task)
		}
	}
	if err != nil {
		return err
	}
	code := http.StatusOK
	if r.Method == http.MethodPost {
		code = http.StatusCreated
	}
	return httpx.Respond(w, code, task)
}

func decodePatch(w http.ResponseWriter, r *http.Request) (TaskPatch, error) {
	var fields map[string]json.RawMessage
	var patch TaskPatch
	if err := httpx.Decode(w, r, &fields); err != nil {
		return patch, err
	}
	if len(fields) == 0 {
		return patch, httpx.Invalid("Нет изменений")
	}
	for key, value := range fields {
		var err error
		switch key {
		case "status_id":
			patch.HasStatus = true
			err = json.Unmarshal(value, &patch.StatusID)
		case "completed":
			if string(value) == "null" {
				return patch, httpx.Invalid("Выполнение должно быть true или false")
			}
			patch.HasCompleted = true
			err = json.Unmarshal(value, &patch.Completed)
		default:
			return patch, httpx.Invalid("В списке можно менять только статус и выполнение")
		}
		if err != nil {
			return patch, httpx.Invalid("Некорректное значение поля")
		}
	}
	return patch, nil
}

func (handler *Handler) Delete(w http.ResponseWriter, r *http.Request) error {
	id, err := httpx.PathID(r)
	if err != nil {
		return err
	}
	if err := handler.Service.Delete(r.Context(), auth.UserID(r.Context()), id); err != nil {
		return err
	}
	return httpx.Respond(w, http.StatusOK, map[string]bool{"deleted": true})
}

func (handler *Handler) Demo(w http.ResponseWriter, r *http.Request) error {
	created, err := handler.Service.CreateExamples(r.Context(), auth.UserID(r.Context()))
	if err != nil {
		return err
	}
	if !created {
		return httpx.Respond(w, http.StatusOK, map[string]string{"message": "Демонстрационные записи уже создавались. Удалённые записи не восстановлены."})
	}
	return httpx.Respond(w, http.StatusCreated, map[string]string{"message": "Создано 10 демонстрационных записей"})
}
