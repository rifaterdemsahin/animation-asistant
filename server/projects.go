package main

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
)

// Project is the on-disk metadata for one animation project (project.json).
type Project struct {
	Slug          string               `json:"slug"`
	Title         string               `json:"title"`
	Topic         string               `json:"topic"`
	ComponentType string               `json:"component_type"`
	CanvaLink     string               `json:"canva_link"`
	Status        string               `json:"status"`
	CreatedAt     string               `json:"created_at"`
	UpdatedAt     string               `json:"updated_at"`
	Acts          map[string]ActStatus `json:"acts"`
}

// ActStatus tracks per-act generation progress.
type ActStatus struct {
	Role       string `json:"role"`
	Slug       string `json:"slug"`
	Outline    string `json:"outline"`
	Script     string `json:"script"`
	Components string `json:"components"`
	Audio      string `json:"audio"`
}

type projectIn struct {
	Title         string `json:"title"`
	Topic         string `json:"topic"`
	ComponentType string `json:"component_type"`
}

func slugify(s string) string {
	var b strings.Builder
	for _, r := range strings.ToLower(strings.TrimSpace(s)) {
		switch {
		case r >= 'a' && r <= 'z', r >= '0' && r <= '9':
			b.WriteRune(r)
		case r == ' ' || r == '-' || r == '_':
			b.WriteRune('-')
		}
	}
	out := strings.Trim(b.String(), "-")
	if out == "" {
		out = "project"
	}
	return out
}

func (a *App) uniqueSlug(base string) string {
	if !a.store.Exists(base) {
		return base
	}
	for i := 2; ; i++ {
		s := fmt.Sprintf("%s-%d", base, i)
		if !a.store.Exists(s) {
			return s
		}
	}
}

func (a *App) loadProject(slug string) (*Project, error) {
	b, err := a.store.ReadProject(slug)
	if err != nil {
		return nil, err
	}
	var p Project
	if err := json.Unmarshal(b, &p); err != nil {
		return nil, err
	}
	if p.Acts == nil {
		p.Acts = map[string]ActStatus{}
	}
	return &p, nil
}

func (a *App) saveProject(p *Project) error {
	p.UpdatedAt = time.Now().UTC().Format(time.RFC3339)
	b, err := json.MarshalIndent(p, "", "  ")
	if err != nil {
		return err
	}
	return a.store.WriteProject(p.Slug, b)
}

func (a *App) newProject(in projectIn) *Project {
	now := time.Now().UTC().Format(time.RFC3339)
	p := &Project{
		Slug:          a.uniqueSlug(slugify(in.Title)),
		Title:         strings.TrimSpace(in.Title),
		Topic:         strings.TrimSpace(in.Topic),
		ComponentType: defaultStr(in.ComponentType, "explainer"),
		Status:        "created",
		CreatedAt:     now,
		UpdatedAt:     now,
		Acts:          map[string]ActStatus{},
	}
	for _, act := range acts {
		p.Acts[act.Key] = ActStatus{
			Role: act.Role, Slug: act.Slug,
			Outline: "pending", Script: "pending", Components: "pending", Audio: "pending",
		}
	}
	return p
}

func defaultStr(v, d string) string {
	if strings.TrimSpace(v) == "" {
		return d
	}
	return v
}

// --- handlers ---

func (a *App) listProjects(w http.ResponseWriter, r *http.Request) {
	slugs, err := a.store.ListProjects()
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	out := make([]*Project, 0, len(slugs))
	for _, s := range slugs {
		if p, err := a.loadProject(s); err == nil {
			out = append(out, p)
		}
	}
	writeJSON(w, http.StatusOK, map[string]any{"projects": out})
}

func (a *App) createProject(w http.ResponseWriter, r *http.Request) {
	body, _ := io.ReadAll(r.Body)
	var in projectIn
	if err := json.Unmarshal(body, &in); err != nil || strings.TrimSpace(in.Title) == "" {
		http.Error(w, "title is required", http.StatusBadRequest)
		return
	}
	p := a.newProject(in)
	if err := a.saveProject(p); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	writeJSON(w, http.StatusCreated, p)
}

func (a *App) getProject(w http.ResponseWriter, r *http.Request) {
	p, err := a.loadProject(r.PathValue("slug"))
	if err != nil {
		http.Error(w, "not found", http.StatusNotFound)
		return
	}
	writeJSON(w, http.StatusOK, p)
}

func (a *App) deleteProject(w http.ResponseWriter, r *http.Request) {
	if err := a.store.Delete(r.PathValue("slug")); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"ok": true})
}
