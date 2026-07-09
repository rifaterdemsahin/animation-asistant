package main

import (
	"net/http"
	"strings"
	"sync"

	"animation-assistant/server/storage"
)

// App holds shared dependencies for all HTTP handlers.
type App struct {
	cfg       *Config
	store     storage.Backend
	or        *orClient
	prompts   PromptStore
	pcache    map[string]string
	pcacheMu  sync.Mutex
	idIndex   map[string]string // project_id (lowercase) -> storage slug
	idIndexMu sync.RWMutex
	startedAt string
}

func (a *App) routes() http.Handler {
	mux := http.NewServeMux()

	// public
	mux.HandleFunc("GET /healthz", a.healthz)
	mux.HandleFunc("GET /api/errors", a.listErrors)
	mux.HandleFunc("POST /api/login", a.login)
	mux.HandleFunc("POST /api/logout", a.logout)

	// authed
	mux.HandleFunc("GET /api/me", a.authed(a.me))
	mux.HandleFunc("GET /api/models", a.authed(a.models))
	mux.HandleFunc("GET /api/projects", a.authed(a.listProjects))
	mux.HandleFunc("POST /api/projects", a.authed(a.createProject))
	mux.HandleFunc("GET /api/projects/{slug}", a.authed(a.getProject))
	mux.HandleFunc("PUT /api/projects/{slug}", a.authed(a.updateProject))
	mux.HandleFunc("DELETE /api/projects/{slug}", a.authed(a.deleteProject))

	mux.HandleFunc("POST /api/projects/{slug}/outline", a.authed(a.generateOutline))
	mux.HandleFunc("GET /api/projects/{slug}/outline", a.authed(a.getOutline))
	mux.HandleFunc("POST /api/projects/{slug}/script", a.authed(a.generateScript))
	mux.HandleFunc("GET /api/projects/{slug}/script", a.authed(a.getScript))

	mux.HandleFunc("POST /api/projects/{slug}/components", a.authed(a.generateComponents))
	mux.HandleFunc("GET /api/projects/{slug}/components", a.authed(a.getComponents))
	mux.HandleFunc("POST /api/projects/{slug}/audio", a.authed(a.generateAudio))
	mux.HandleFunc("GET /api/projects/{slug}/audio", a.authed(a.getAudio))
	mux.HandleFunc("POST /api/projects/{slug}/audio/music", a.authed(a.generateMusic))
	mux.HandleFunc("GET /api/projects/{slug}/audio/music", a.authed(a.getMusicStatus))
	mux.HandleFunc("POST /api/projects/{slug}/audio/sfx", a.authed(a.generateSFX))
	mux.HandleFunc("GET /api/projects/{slug}/audio/sfx", a.authed(a.getSFXStatus))
	mux.HandleFunc("POST /api/projects/{slug}/storyboard", a.authed(a.generateStoryboard))
	mux.HandleFunc("GET /api/projects/{slug}/storyboard", a.authed(a.getStoryboard))

	// one-time data migration: backfill project_id into every project.json
	mux.HandleFunc("POST /api/admin/migrate-project-ids", a.authed(a.migrateProjectIDs))

	// editable prompt templates (Azure "prompts" container)
	mux.HandleFunc("GET /api/prompts", a.authed(a.listPrompts))
	mux.HandleFunc("GET /api/prompts/{id}", a.authed(a.getPrompt))
	mux.HandleFunc("PUT /api/prompts/{id}", a.authed(a.updatePrompt))
	mux.HandleFunc("POST /api/prompts/{id}/reset", a.authed(a.resetPrompt))

	// raw asset serving (images/audio) from storage
	mux.HandleFunc("GET /api/projects/{slug}/browse", a.authed(a.browseFiles))
	mux.HandleFunc("GET /api/projects/{slug}/raw/{path...}", a.authed(a.serveRaw))

	// backup: download all project data as a zip archive
	mux.HandleFunc("GET /api/backup", a.authed(a.backupAllProjects))

	// favicon (shared SVG, served for both .ico and .svg so every page gets a
	// tab icon without per-page <link> tags and without a 404 on /favicon.ico)
	mux.HandleFunc("GET /favicon.ico", a.favicon)
	mux.HandleFunc("GET /favicon.svg", a.favicon)

	// static frontend (subtree catch-all; registered after API routes)
	fs := http.FileServer(http.Dir(a.cfg.WebDir))
	mux.Handle("GET /", fs)
	return recoverMiddleware(mux)
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

// serveRaw streams a generated asset (image/audio) out of storage.
func (a *App) serveRaw(w http.ResponseWriter, r *http.Request) {
	slug, err := a.resolveSlug(r.PathValue("slug"))
	if err != nil {
		http.NotFound(w, r)
		return
	}
	p := r.PathValue("path")
	if strings.Contains(p, "..") || strings.Contains(slug, "..") {
		http.Error(w, "bad path", http.StatusBadRequest)
		return
	}
	data, err := a.store.Read(slug, p)
	if err != nil {
		http.NotFound(w, r)
		return
	}
	setContentType(w, p)
	w.Header().Set("Cache-Control", "no-store")
	_, _ = w.Write(data)
}

func setContentType(w http.ResponseWriter, name string) {
	switch {
	case strings.HasSuffix(name, ".png"):
		w.Header().Set("Content-Type", "image/png")
	case strings.HasSuffix(name, ".jpg"), strings.HasSuffix(name, ".jpeg"):
		w.Header().Set("Content-Type", "image/jpeg")
	case strings.HasSuffix(name, ".mp3"):
		w.Header().Set("Content-Type", "audio/mpeg")
	case strings.HasSuffix(name, ".json"):
		w.Header().Set("Content-Type", "application/json")
	default:
		w.Header().Set("Content-Type", "application/octet-stream")
	}
}

// faviconSVG is an on-brand play-button favicon (accent → accent-2 gradient).
const faviconSVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">` +
	`<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">` +
	`<stop offset="0" stop-color="#6c8cff"/><stop offset="1" stop-color="#4cd3a5"/>` +
	`</linearGradient></defs>` +
	`<rect width="32" height="32" rx="7" fill="url(#g)"/>` +
	`<path d="M13 10l9 6-9 6z" fill="#0f1115"/>` +
	`</svg>`

// favicon serves the shared SVG favicon for every page (no per-page <link> needed).
func (a *App) favicon(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "image/svg+xml")
	w.Header().Set("Cache-Control", "public, max-age=86400")
	_, _ = w.Write([]byte(faviconSVG))
}
