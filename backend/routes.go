package main

import "net/http"

func (a *App) routes() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /api/cron/deadlines", a.handle(a.dailyDeadlines))
	mux.HandleFunc("GET /api/health", a.handle(func(w http.ResponseWriter, r *http.Request) error {
		if err := a.db.Ping(r.Context()); err != nil {
			return err
		}
		return respond(w, 200, map[string]string{"status": "ok"})
	}))
	mux.HandleFunc("GET /api/catalog", a.handle(a.authenticated(a.listCatalog, false)))
	mux.HandleFunc("POST /api/catalog", a.handle(a.authenticated(a.saveCatalog, false)))
	mux.HandleFunc("PUT /api/catalog/{id}", a.handle(a.authenticated(a.saveCatalog, false)))
	mux.HandleFunc("GET /api/tasks", a.handle(a.authenticated(a.listTasks, false)))
	mux.HandleFunc("POST /api/tasks", a.handle(a.authenticated(a.saveTask, false)))
	mux.HandleFunc("PUT /api/tasks/{id}", a.handle(a.authenticated(a.saveTask, false)))
	mux.HandleFunc("PATCH /api/tasks/{id}", a.handle(a.authenticated(a.saveTask, false)))
	mux.HandleFunc("DELETE /api/tasks/{id}", a.handle(a.authenticated(a.deleteTask, false)))
	mux.HandleFunc("POST /api/demo", a.handle(a.authenticated(a.demo, false)))

	mux.HandleFunc("POST /api/auth/login", a.handle(a.login))
	mux.HandleFunc("POST /api/auth/register", a.handle(a.register))
	mux.HandleFunc("GET /api/auth/me", a.handle(a.authenticated(a.me, false)))
	mux.HandleFunc("POST /api/auth/logout", a.handle(a.authenticated(a.logout, false)))
	mux.HandleFunc("POST /api/auth/password", a.handle(a.authenticated(a.changePassword, false)))
	mux.HandleFunc("GET /api/admin/users", a.handle(a.authenticated(a.listUsers, true)))
	mux.HandleFunc("GET /api/admin/invitations", a.handle(a.authenticated(a.listInvitations, true)))
	mux.HandleFunc("POST /api/admin/invitations", a.handle(a.authenticated(a.createInvitation, true)))
	mux.HandleFunc("POST /api/admin/invitations/{id}/revoke", a.handle(a.authenticated(a.revokeInvitation, true)))
	return mux
}
