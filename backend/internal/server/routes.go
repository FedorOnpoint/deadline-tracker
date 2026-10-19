package server

import (
	"net/http"

	"deadline-tracker/internal/admin"
	"deadline-tracker/internal/auth"
	"deadline-tracker/internal/catalog"
	"deadline-tracker/internal/httpx"
	"deadline-tracker/internal/notifications"
	"deadline-tracker/internal/tasks"

	"github.com/jackc/pgx/v5/pgxpool"
)

func NewHandler(db *pgxpool.Pool, notifier *notifications.Service) http.Handler {
	authHandler := &auth.Service{DB: db}
	catalogService := &catalog.Service{Repository: &catalog.PostgresRepository{DB: db}}
	catalogHandler := &catalog.Handler{Service: catalogService}
	taskService := &tasks.Service{Repository: &tasks.PostgresRepository{DB: db}, Deadlines: notifier}
	taskHandler := &tasks.Handler{Service: taskService}
	adminService := &admin.Service{Repository: &admin.PostgresRepository{DB: db}}
	adminHandler := &admin.Handler{Service: adminService}
	mux := http.NewServeMux()
	mux.HandleFunc("GET /api/cron/deadlines", httpx.Handle(notifier.Daily))
	mux.HandleFunc("GET /api/health", httpx.Handle(func(w http.ResponseWriter, r *http.Request) error {
		if err := db.Ping(r.Context()); err != nil {
			return err
		}
		return httpx.Respond(w, 200, map[string]string{"status": "ok"})
	}))
	mux.HandleFunc("GET /api/catalog", httpx.Handle(authHandler.Authenticated(catalogHandler.List, false)))
	mux.HandleFunc("POST /api/catalog", httpx.Handle(authHandler.Authenticated(catalogHandler.Save, false)))
	mux.HandleFunc("PUT /api/catalog/{id}", httpx.Handle(authHandler.Authenticated(catalogHandler.Save, false)))
	mux.HandleFunc("GET /api/tasks", httpx.Handle(authHandler.Authenticated(taskHandler.List, false)))
	mux.HandleFunc("POST /api/tasks", httpx.Handle(authHandler.Authenticated(taskHandler.Save, false)))
	mux.HandleFunc("PUT /api/tasks/{id}", httpx.Handle(authHandler.Authenticated(taskHandler.Save, false)))
	mux.HandleFunc("PATCH /api/tasks/{id}", httpx.Handle(authHandler.Authenticated(taskHandler.Save, false)))
	mux.HandleFunc("DELETE /api/tasks/{id}", httpx.Handle(authHandler.Authenticated(taskHandler.Delete, false)))
	mux.HandleFunc("POST /api/demo", httpx.Handle(authHandler.Authenticated(taskHandler.Demo, false)))

	mux.HandleFunc("POST /api/auth/login", httpx.Handle(authHandler.Login))
	mux.HandleFunc("POST /api/auth/register", httpx.Handle(authHandler.Register))
	mux.HandleFunc("GET /api/auth/me", httpx.Handle(authHandler.Authenticated(authHandler.Me, false)))
	mux.HandleFunc("POST /api/auth/logout", httpx.Handle(authHandler.Authenticated(authHandler.Logout, false)))
	mux.HandleFunc("POST /api/auth/password", httpx.Handle(authHandler.Authenticated(authHandler.ChangePassword, false)))
	mux.HandleFunc("GET /api/admin/users", httpx.Handle(authHandler.Authenticated(adminHandler.ListUsers, true)))
	mux.HandleFunc("GET /api/admin/invitations", httpx.Handle(authHandler.Authenticated(adminHandler.ListInvitations, true)))
	mux.HandleFunc("POST /api/admin/invitations", httpx.Handle(authHandler.Authenticated(adminHandler.CreateInvitation, true)))
	mux.HandleFunc("POST /api/admin/invitations/{id}/revoke", httpx.Handle(authHandler.Authenticated(adminHandler.RevokeInvitation, true)))
	return mux
}
