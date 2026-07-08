package main

import (
	"encoding/json"
	"io"
	"net/http"
	"strings"
)

// promptOut is one editable prompt as seen by the UI.
type promptOut struct {
	ID          string   `json:"id"`
	Title       string   `json:"title"`
	Description string   `json:"description"`
	Variables   []string `json:"variables"`
	Raw         string   `json:"raw"`     // current JSON text (editable)
	Default     string   `json:"default"` // compiled default JSON text
	Dirty       bool     `json:"dirty"`   // true if raw differs from default
}

// GET /api/prompts — list all editable prompts with current text.
func (a *App) listPrompts(w http.ResponseWriter, r *http.Request) {
	defaults := defaultPromptJSON()
	out := make([]promptOut, 0, len(promptDescriptors))
	for _, d := range promptDescriptors {
		raw := a.promptRaw(d.ID)
		out = append(out, promptOut{
			ID:          d.ID,
			Title:       d.Title,
			Description: d.Description,
			Variables:   d.Variables,
			Raw:         raw,
			Default:     defaults[d.ID],
			Dirty:       strings.TrimSpace(raw) != strings.TrimSpace(defaults[d.ID]),
		})
	}
	storeName := "memory"
	if a.prompts != nil {
		storeName = a.prompts.Name()
	}
	writeJSON(w, http.StatusOK, map[string]any{"prompts": out, "store": storeName})
}

// GET /api/prompts/{id} — one prompt (current + default).
func (a *App) getPrompt(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	d, ok := descriptorByID(id)
	if !ok {
		writeError(w, r, http.StatusNotFound, "not_found", "unknown prompt: "+id)
		return
	}
	raw := a.promptRaw(id)
	writeJSON(w, http.StatusOK, promptOut{
		ID:          d.ID,
		Title:       d.Title,
		Description: d.Description,
		Variables:   d.Variables,
		Raw:         raw,
		Default:     defaultPromptJSON()[id],
		Dirty:       strings.TrimSpace(raw) != strings.TrimSpace(defaultPromptJSON()[id]),
	})
}

type promptIn struct {
	Raw string `json:"raw"`
}

// PUT /api/prompts/{id} — save edited JSON text (validated before write).
func (a *App) updatePrompt(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if _, ok := descriptorByID(id); !ok {
		writeError(w, r, http.StatusNotFound, "not_found", "unknown prompt: "+id)
		return
	}
	body, _ := io.ReadAll(r.Body)
	var in promptIn
	if err := json.Unmarshal(body, &in); err != nil {
		writeError(w, r, http.StatusBadRequest, "bad_request", "invalid JSON body: "+err.Error())
		return
	}
	raw := strings.TrimSpace(in.Raw)
	if raw == "" {
		writeError(w, r, http.StatusBadRequest, "bad_request", "raw prompt is empty")
		return
	}
	// Validate it parses as JSON before persisting.
	var probe any
	if err := json.Unmarshal([]byte(raw), &probe); err != nil {
		writeError(w, r, http.StatusBadRequest, "invalid_json", "prompt is not valid JSON: "+err.Error())
		return
	}
	if a.prompts == nil {
		writeError(w, r, http.StatusServiceUnavailable, "no_store", "prompt store not initialized")
		return
	}
	if err := a.prompts.Write(id, raw); err != nil {
		writeError(w, r, http.StatusInternalServerError, "storage_error", "failed to write prompt: "+err.Error())
		return
	}
	a.invalidatePromptCache(id)
	writeJSON(w, http.StatusOK, map[string]any{"ok": true, "id": id, "dirty": raw != defaultPromptJSON()[id]})
}

// POST /api/prompts/{id}/reset — restore the compiled default.
func (a *App) resetPrompt(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if _, ok := descriptorByID(id); !ok {
		writeError(w, r, http.StatusNotFound, "not_found", "unknown prompt: "+id)
		return
	}
	if a.prompts == nil {
		writeError(w, r, http.StatusServiceUnavailable, "no_store", "prompt store not initialized")
		return
	}
	raw := defaultPromptJSON()[id]
	if err := a.prompts.Write(id, raw); err != nil {
		writeError(w, r, http.StatusInternalServerError, "storage_error", "failed to reset prompt: "+err.Error())
		return
	}
	a.invalidatePromptCache(id)
	writeJSON(w, http.StatusOK, map[string]any{"ok": true, "id": id, "raw": raw})
}
