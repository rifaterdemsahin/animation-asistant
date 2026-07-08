package main

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
)

// TaskItem is a checklist item grouped by Bloom's taxonomy level.
type TaskItem struct {
	ID    string `json:"id"`
	Label string `json:"label"`
	Group string `json:"group"`
	Done  bool   `json:"done"`
}

// Project is the on-disk metadata for one animation project (project.json).
type Project struct {
	Slug          string               `json:"slug"`
	Title         string               `json:"title"`
	Topic         string               `json:"topic"`
	ComponentType string               `json:"component_type"`
	CanvaLink     string               `json:"canva_link"`
	Question      string               `json:"question,omitempty"`
	Answer        string               `json:"answer,omitempty"`
	Why           string               `json:"why,omitempty"`
	Tasks         []TaskItem           `json:"tasks,omitempty"`
	ActNotes      map[string]string    `json:"act_notes,omitempty"`
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
	Question      string `json:"question"`
	Answer        string `json:"answer"`
	Why           string `json:"why"`
	CanvaLink     string `json:"canva_link"`
}

func defaultTasks() []TaskItem {
	return []TaskItem{
		{ID: "t1", Label: "Copy Canva template for storyboards and scripts (Act 1, Act 2, Act 3).", Group: "remember", Done: false},
		{ID: "t2", Label: "Create the infographic storyboard.", Group: "remember", Done: false},
		{ID: "t3", Label: "Write the script.", Group: "remember", Done: false},
		{ID: "t4", Label: "Generate AI voiceovers for all three acts.", Group: "remember", Done: false},
		{ID: "t5", Label: "Generate Subtitles and storyboard and background and one run listen.", Group: "remember", Done: false},
		{ID: "t6", Label: "Bulk generate with animation helper.", Group: "apply", Done: false},
		{ID: "t7", Label: "Place components in acts.", Group: "apply", Done: false},
		{ID: "t8", Label: "Time and place the components, sync subtitles, and polish the timeline.", Group: "evaluate", Done: false},
		{ID: "t9", Label: "Run a collaborative workshop to polish final details and answer outstanding questions.", Group: "evaluate", Done: false},
		{ID: "t10", Label: "Have a do apply demo with interactive application and code samples.", Group: "evaluate", Done: false},
	}
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
		Question:      strings.TrimSpace(in.Question),
		Answer:        strings.TrimSpace(in.Answer),
		Why:           strings.TrimSpace(in.Why),
		CanvaLink:     strings.TrimSpace(in.CanvaLink),
		Tasks:         defaultTasks(),
		ActNotes:      map[string]string{},
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
		writeError(w, r, http.StatusInternalServerError, "storage_error", "failed to list projects: "+err.Error())
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
		writeError(w, r, http.StatusBadRequest, "bad_request", "title is required")
		return
	}
	p := a.newProject(in)
	if err := a.saveProject(p); err != nil {
		writeError(w, r, http.StatusInternalServerError, "storage_error", "failed to save project: "+err.Error())
		return
	}
	writeJSON(w, http.StatusCreated, p)
}

func (a *App) getProject(w http.ResponseWriter, r *http.Request) {
	p, err := a.loadProject(r.PathValue("slug"))
	if err != nil {
		writeError(w, r, http.StatusNotFound, "not_found", "project not found")
		return
	}
	writeJSON(w, http.StatusOK, p)
}

func (a *App) deleteProject(w http.ResponseWriter, r *http.Request) {
	if err := a.store.Delete(r.PathValue("slug")); err != nil {
		writeError(w, r, http.StatusInternalServerError, "storage_error", "failed to delete project: "+err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"ok": true})
}

func (a *App) updateProject(w http.ResponseWriter, r *http.Request) {
	slug := r.PathValue("slug")
	existing, err := a.loadProject(slug)
	if err != nil {
		writeError(w, r, http.StatusNotFound, "not_found", "project not found")
		return
	}
	body, _ := io.ReadAll(r.Body)
	var in Project
	if err := json.Unmarshal(body, &in); err != nil {
		writeError(w, r, http.StatusBadRequest, "bad_request", "invalid JSON: "+err.Error())
		return
	}
	if strings.TrimSpace(in.Title) != "" {
		existing.Title = strings.TrimSpace(in.Title)
	}
	if strings.TrimSpace(in.Topic) != "" {
		existing.Topic = strings.TrimSpace(in.Topic)
	}
	if strings.TrimSpace(in.ComponentType) != "" {
		existing.ComponentType = strings.TrimSpace(in.ComponentType)
	}
	if strings.TrimSpace(in.CanvaLink) != "" {
		existing.CanvaLink = strings.TrimSpace(in.CanvaLink)
	}
	existing.Question = strings.TrimSpace(in.Question)
	existing.Answer = strings.TrimSpace(in.Answer)
	existing.Why = strings.TrimSpace(in.Why)
	if in.Tasks != nil {
		existing.Tasks = in.Tasks
	}
	if in.ActNotes != nil {
		if existing.ActNotes == nil {
			existing.ActNotes = map[string]string{}
		}
		for k, v := range in.ActNotes {
			existing.ActNotes[k] = v
		}
	}
	if err := a.saveProject(existing); err != nil {
		writeError(w, r, http.StatusInternalServerError, "storage_error", "failed to save project: "+err.Error())
		return
	}
	writeJSON(w, http.StatusOK, existing)
}
