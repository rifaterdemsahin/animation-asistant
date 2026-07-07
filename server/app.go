package main

import (
	"net/http"

	"animation-assistant/server/storage"
)

// App holds shared dependencies for all HTTP handlers.
type App struct {
	cfg   *Config
	store storage.Backend
}

func (a *App) routes() http.Handler {
	mux := http.NewServeMux()

	// public
	mux.HandleFunc("GET /healthz", a.healthz)
	mux.HandleFunc("POST /api/login", a.login)
	mux.HandleFunc("POST /api/logout", a.logout)

	// authed
	mux.HandleFunc("GET /api/me", a.authed(a.me))
	mux.HandleFunc("GET /api/projects", a.authed(a.listProjects))
	mux.HandleFunc("POST /api/projects", a.authed(a.createProject))
	mux.HandleFunc("GET /api/projects/{slug}", a.authed(a.getProject))
	mux.HandleFunc("DELETE /api/projects/{slug}", a.authed(a.deleteProject))
	mux.HandleFunc("POST /api/projects/{slug}/outline", a.authed(a.generateOutline))
	mux.HandleFunc("GET /api/projects/{slug}/outline", a.authed(a.getOutline))
	mux.HandleFunc("POST /api/projects/{slug}/script", a.authed(a.generateScript))
	mux.HandleFunc("GET /api/projects/{slug}/script", a.authed(a.getScript))

	// static frontend (subtree catch-all; registered after API routes)
	fs := http.FileServer(http.Dir(a.cfg.WebDir))
	mux.Handle("GET /", fs)
	return mux
}

// authed wraps a handler with cookie auth.
func (a *App) authed(h http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		cookie, err := r.Cookie("auth")
		if err != nil || !a.cfg.ValidToken(cookie.Value) {
			http.Error(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		h(w, r)
	}
}
