package main

import (
	"context"
	_ "embed"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
)

//go:embed schema.sql
var schema string

type Catalog struct {
	ID       int64  `json:"id"`
	Kind     string `json:"kind"`
	Name     string `json:"name"`
	Color    string `json:"color"`
	Position int    `json:"position"`
	Archived bool   `json:"archived"`
	Section  string `json:"section"`
}
type Task struct {
	ID          int64      `json:"id"`
	PlatformID  int64      `json:"platform_id"`
	SpecialtyID *int64     `json:"specialty_id"`
	StatusID    *int64     `json:"status_id"`
	Deadline    time.Time  `json:"deadline"`
	EmailDate   string     `json:"email_date"`
	Topic       string     `json:"topic"`
	Project     string     `json:"project"`
	Header      string     `json:"header"`
	Preheader   string     `json:"preheader"`
	Comment     string     `json:"comment"`
	Owner       string     `json:"owner"`
	Completed   bool       `json:"completed"`
	CompletedAt *time.Time `json:"completed_at"`
	CreatedAt   time.Time  `json:"created_at"`
	UpdatedAt   time.Time  `json:"updated_at"`
}

type App struct {
	db       *pgxpool.Pool
	notifier Notifier
}
type apiError struct {
	code    int
	message string
}

func (e *apiError) Error() string  { return e.message }
func invalid(message string) error { return &apiError{400, message} }

func main() {
	slog.SetDefault(slog.New(slog.NewJSONHandler(os.Stdout, nil)))
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()
	dbURL := os.Getenv("DATABASE_URL")
	if dbURL == "" {
		slog.Error("DATABASE_URL не задан")
		os.Exit(1)
	}
	db, err := pgxpool.New(ctx, dbURL)
	if err != nil {
		slog.Error("database_config", "error", err)
		os.Exit(1)
	}
	defer db.Close()
	ready := false
	for i := 0; i < 60; i++ {
		if db.Ping(ctx) == nil {
			ready = true
			break
		}
		select {
		case <-ctx.Done():
			return
		case <-time.After(time.Second):
		}
	}
	if !ready {
		slog.Error("database_unavailable")
		os.Exit(1)
	}
	app := &App{db: db, notifier: ConsoleNotifier{}}
	if err = app.initialize(ctx); err != nil {
		slog.Error("migration_error", "error", err)
		os.Exit(1)
	}
	mux := http.NewServeMux()
	mux.HandleFunc("GET /api/health", app.handle(func(w http.ResponseWriter, r *http.Request) error {
		if err := db.Ping(r.Context()); err != nil {
			return err
		}
		return respond(w, 200, map[string]string{"status": "ok"})
	}))
	mux.HandleFunc("GET /api/catalog", app.handle(app.listCatalog))
	mux.HandleFunc("POST /api/catalog", app.handle(app.saveCatalog))
	mux.HandleFunc("PUT /api/catalog/{id}", app.handle(app.saveCatalog))
	mux.HandleFunc("GET /api/tasks", app.handle(app.listTasks))
	mux.HandleFunc("POST /api/tasks", app.handle(app.saveTask))
	mux.HandleFunc("PUT /api/tasks/{id}", app.handle(app.saveTask))
	mux.HandleFunc("PATCH /api/tasks/{id}", app.handle(app.saveTask))
	mux.HandleFunc("DELETE /api/tasks/{id}", app.handle(app.deleteTask))
	mux.HandleFunc("POST /api/demo", app.handle(app.demo))
	server := &http.Server{Addr: ":8080", Handler: mux, ReadHeaderTimeout: 5 * time.Second, ReadTimeout: 15 * time.Second, WriteTimeout: 20 * time.Second, IdleTimeout: 60 * time.Second}
	go app.runNotifications(ctx)
	go func() {
		<-ctx.Done()
		shutdown, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		_ = server.Shutdown(shutdown)
	}()
	slog.Info("server_started", "address", server.Addr)
	if err = server.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
		slog.Error("server_error", "error", err)
		os.Exit(1)
	}
}

func (a *App) handle(fn func(http.ResponseWriter, *http.Request) error) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json; charset=utf-8")
		w.Header().Set("Cache-Control", "no-store")
		w.Header().Set("X-Content-Type-Options", "nosniff")
		// Reject cross-origin mutations, including form submissions from other sites.
		if r.Method != "GET" && r.Method != "HEAD" {
			if r.Header.Get("Sec-Fetch-Site") == "cross-site" {
				_ = respond(w, 403, map[string]string{"error": "Запрос с другого сайта запрещён"})
				return
			}
			if !strings.HasPrefix(r.Header.Get("Content-Type"), "application/json") {
				_ = respond(w, 415, map[string]string{"error": "Ожидается JSON"})
				return
			}
		}
		if err := fn(w, r); err != nil {
			code, message := 500, "Не удалось выполнить запрос. Повторите попытку."
			var ae *apiError
			var pe *pgconn.PgError
			switch {
			case errors.As(err, &ae):
				code, message = ae.code, ae.message
			case errors.Is(err, pgx.ErrNoRows):
				code, message = 404, "Запись не найдена"
			case errors.As(err, &pe):
				switch pe.Code {
				case "23505":
					code, message = 409, "Такое название уже существует"
				case "23503", "23514", "22007", "22008":
					code, message = 400, "Проверьте значения полей и справочников"
				}
			}
			if code == 500 {
				slog.Error("request_error", "method", r.Method, "path", r.URL.Path, "error", err)
			}
			_ = respond(w, code, map[string]string{"error": message})
		}
	}
}
func respond(w http.ResponseWriter, code int, value any) error {
	w.WriteHeader(code)
	return json.NewEncoder(w).Encode(value)
}
func decode(w http.ResponseWriter, r *http.Request, v any) error {
	r.Body = http.MaxBytesReader(w, r.Body, 1024*1024)
	decoder := json.NewDecoder(r.Body)
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(v); err != nil {
		return invalid("Некорректные данные запроса")
	}
	if err := decoder.Decode(new(any)); err != io.EOF {
		return invalid("Ожидается один объект JSON")
	}
	return nil
}
func pathID(r *http.Request) (int64, error) {
	var id int64
	_, err := fmt.Sscan(r.PathValue("id"), &id)
	if err != nil || id <= 0 || fmt.Sprint(id) != r.PathValue("id") {
		return 0, invalid("Некорректный ID")
	}
	return id, nil
}

func (a *App) initialize(ctx context.Context) error {
	tx, err := a.db.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)
	if _, err = tx.Exec(ctx, "SELECT pg_advisory_xact_lock(71248901)"); err != nil {
		return err
	}
	if _, err = tx.Exec(ctx, schema); err != nil {
		return err
	}
	tag, err := tx.Exec(ctx, "INSERT INTO migrations(name) VALUES ('initial_catalog_v1') ON CONFLICT DO NOTHING")
	if err != nil {
		return err
	}
	if tag.RowsAffected() > 0 {
		names := map[string][]string{"platform": {"База Медзнат", "Отправки Medpoint", "Отправки Onpoint"}, "specialty": {"Gastro", "GP"}, "status": {"Пишем", "На согласовании", "Дорабатываем", "Загружено DROID", "Mhub", "Дизайн", "Согласовано БМ", "Ждем размещение МЗ", "Корректор"}}
		colors := []string{"#a9b9cf", "#e2be77", "#edaa87", "#b4a1df", "#8ebfd1", "#d39bbb", "#9fc5a3", "#b2c88e", "#c1b4a4"}
		for kind, values := range names {
			for i, name := range values {
				color := "#aac4d6"
				if kind == "status" {
					color = colors[i]
				}
				if _, err = tx.Exec(ctx, "INSERT INTO catalog(kind,name,color,position) VALUES($1,$2,$3,$4)", kind, name, color, i); err != nil {
					return err
				}
			}
		}
	}
	tag, err = tx.Exec(ctx, "INSERT INTO migrations(name) VALUES ('platform_sections_v1') ON CONFLICT DO NOTHING")
	if err != nil {
		return err
	}
	if tag.RowsAffected() > 0 {
		_, err = tx.Exec(ctx, `UPDATE catalog SET section=CASE name WHEN 'База Медзнат' THEN 'medznat' WHEN 'Отправки Onpoint' THEN 'onpoint' WHEN 'Отправки Medpoint' THEN 'medpoint' ELSE 'special' END WHERE kind='platform'`)
		if err != nil {
			return err
		}
	}
	return tx.Commit(ctx)
}
