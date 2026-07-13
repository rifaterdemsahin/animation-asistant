package main

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"
)

// --- Sprite Generator: extract 14 icon concepts from the script (text call),
// then render them into a single 14-icon technical sprite sheet (image call). ---

type spriteVersion struct {
	ID        int      `json:"id"`
	File      string   `json:"file"`
	Prompt    string   `json:"prompt"`
	Concepts  []string `json:"concepts"`
	CreatedAt string   `json:"created_at"`
}

type spriteManifest struct {
	Concepts []string        `json:"concepts"`
	Versions []spriteVersion `json:"versions"`
}

func (a *App) loadSpriteManifest(slug string) spriteManifest {
	b, err := a.store.Read(slug, "sprite/sprite.json")
	if err != nil {
		return spriteManifest{}
	}
	var m spriteManifest
	_ = json.Unmarshal(b, &m)
	return m
}

func (a *App) saveSpriteManifest(slug string, m spriteManifest) {
	buf, _ := json.MarshalIndent(m, "", "  ")
	_ = a.store.Write(slug, "sprite/sprite.json", buf)
}

// gatherScriptText concatenates each act's narration + beats markdown into one
// block used as context for concept extraction.
func (a *App) gatherScriptText(slug string) string {
	var b strings.Builder
	for _, act := range acts {
		md, err := a.store.Read(slug, act.Slug+"/script/act.md")
		if err != nil || len(md) == 0 {
			continue
		}
		fmt.Fprintf(&b, "=== %s ===\n%s\n\n", act.Title, string(md))
	}
	return strings.TrimSpace(b.String())
}

func formatConceptList(concepts []string) string {
	var b strings.Builder
	for i, c := range concepts {
		fmt.Fprintf(&b, "%d. %s\n", i+1, c)
	}
	return strings.TrimSpace(b.String())
}

// generateSpriteConcepts calls the text model to extract 14 icon concepts
// from the project's already-generated script.
func (a *App) generateSpriteConcepts(w http.ResponseWriter, r *http.Request) {
	p, err := a.resolveProject(r.PathValue("slug"))
	if err != nil {
		writeError(w, r, http.StatusNotFound, "not_found", "project not found")
		return
	}
	slug := p.Slug
	script := a.gatherScriptText(slug)
	if script == "" {
		writeError(w, r, http.StatusBadRequest, "script_required", "No script content found — generate the Script (step 2) first.")
		return
	}
	sys, usr, _ := a.spriteTmpl()
	msgs := []orMessage{
		{Role: "system", Content: sys},
		{Role: "user", Content: renderTmpl(usr, map[string]string{
			"topic":  p.Topic,
			"script": script,
		})},
	}
	a.savePromptMsg(slug, "sprite", "sprite-concepts", msgs)
	raw, err := a.chatText(msgs)
	if err != nil {
		writeError(w, r, http.StatusInternalServerError, "openrouter_error", err.Error())
		return
	}
	obj, err := extractJSON(raw)
	if err != nil {
		writeError(w, r, http.StatusInternalServerError, "json_parse_error", "model did not return valid JSON: "+err.Error())
		return
	}
	var concepts []string
	if arr, ok := obj["concepts"].([]any); ok {
		for _, c := range arr {
			if s, ok := c.(string); ok && strings.TrimSpace(s) != "" {
				concepts = append(concepts, strings.TrimSpace(s))
			}
		}
	}
	if len(concepts) == 0 {
		writeError(w, r, http.StatusInternalServerError, "no_concepts", "model did not return any concepts")
		return
	}
	m := a.loadSpriteManifest(slug)
	m.Concepts = concepts
	a.saveSpriteManifest(slug, m)
	writeJSON(w, http.StatusOK, map[string]any{"ok": true, "concepts": concepts})
}

func (a *App) getSpriteConcepts(w http.ResponseWriter, r *http.Request) {
	slug := r.PathValue("slug")
	if s, err := a.resolveSlug(slug); err == nil {
		slug = s
	}
	m := a.loadSpriteManifest(slug)
	writeJSON(w, http.StatusOK, map[string]any{"concepts": m.Concepts})
}

// generateSprite renders the 14 stored concepts into the sprite-sheet image
// prompt and generates the image.
func (a *App) generateSprite(w http.ResponseWriter, r *http.Request) {
	p, err := a.resolveProject(r.PathValue("slug"))
	if err != nil {
		writeError(w, r, http.StatusNotFound, "not_found", "project not found")
		return
	}
	slug := p.Slug
	m := a.loadSpriteManifest(slug)
	if len(m.Concepts) == 0 {
		writeError(w, r, http.StatusBadRequest, "concepts_required", "Generate the 14 concepts from the script first.")
		return
	}
	_, _, imgTmpl := a.spriteTmpl()
	prompt := renderTmpl(imgTmpl, map[string]string{
		"concepts": formatConceptList(m.Concepts),
		"topic":    p.Topic,
	})
	a.savePrompt(slug, "sprite", "sprite-sheet", prompt)
	img, err := a.generateImage(prompt)
	if err != nil {
		writeError(w, r, http.StatusInternalServerError, "openrouter_error", err.Error())
		return
	}
	nextID := 1
	for _, v := range m.Versions {
		if v.ID >= nextID {
			nextID = v.ID + 1
		}
	}
	fname := fmt.Sprintf("sprite/sprite-sheet-%02d.png", nextID)
	if err := a.store.Write(slug, fname, img); err != nil {
		writeError(w, r, http.StatusInternalServerError, "storage_error", err.Error())
		return
	}
	ver := spriteVersion{
		ID:        nextID,
		File:      fname,
		Prompt:    prompt,
		Concepts:  m.Concepts,
		CreatedAt: time.Now().UTC().Format(time.RFC3339),
	}
	m.Versions = append(m.Versions, ver)
	a.saveSpriteManifest(slug, m)
	writeJSON(w, http.StatusOK, map[string]any{"ok": true, "version": ver})
}

func (a *App) getSprite(w http.ResponseWriter, r *http.Request) {
	slug := r.PathValue("slug")
	if s, err := a.resolveSlug(slug); err == nil {
		slug = s
	}
	m := a.loadSpriteManifest(slug)
	writeJSON(w, http.StatusOK, map[string]any{"concepts": m.Concepts, "versions": m.Versions})
}
