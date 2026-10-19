package server

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"deadline-tracker/internal/database"
	"deadline-tracker/internal/notifications"

	"github.com/jackc/pgx/v5/pgxpool"
)

func Run() {
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
	notifier := &notifications.Service{DB: db, Notifier: notifications.ConsoleNotifier{}}
	if err = database.Initialize(ctx, db); err != nil {
		slog.Error("migration_error", "error", err)
		os.Exit(1)
	}
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}
	server := &http.Server{Addr: ":" + port, Handler: NewHandler(db, notifier), ReadHeaderTimeout: 5 * time.Second, ReadTimeout: 15 * time.Second, WriteTimeout: 20 * time.Second, IdleTimeout: 60 * time.Second}
	if os.Getenv("VERCEL") != "1" {
		go notifier.Run(ctx)
	}
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
