package main

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
)

// --- Outline (project-level) ---

type outlineReq struct {
	Force bool `json:"force"`
}

func (a *App) generateOutline(w http.ResponseWriter, r *http.Request) {
	slug := r.PathValue("slug")
	p, err := a.loadProject(slug)
	if err != nil {
		writeError(w, r, http.StatusNotFound, "not_found", "project not found")
		return
	}
	var req outlineReq
	body, _ := io.ReadAll(r.Body)
	_ = json.Unmarshal(body, &req)

	sys, usr := a.outlineTmpl()
	msgs := []orMessage{
		{Role: "system", Content: sys},
		{Role: "user", Content: renderTmpl(usr, map[string]string{
			"topic":          p.Topic,
			"component_type": p.ComponentType,
		})},
	}
	a.savePromptMsg(slug, "outline", "outline", msgs)
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
	buf, _ := json.MarshalIndent(obj, "", "  ")
	if err := a.store.Write(slug, "outline.json", buf); err != nil {
		writeError(w, r, http.StatusInternalServerError, "storage_error", "failed to store outline: "+err.Error())
		return
	}
	for k := range p.Acts {
		s := p.Acts[k]
		s.Outline = "done"
		p.Acts[k] = s
	}
	p.Status = "outline"
	_ = a.saveProject(p)
	writeJSON(w, http.StatusOK, map[string]any{"ok": true, "outline": obj})
}

func (a *App) getOutline(w http.ResponseWriter, r *http.Request) {
	slug := r.PathValue("slug")
	b, err := a.store.Read(slug, "outline.json")
	if err != nil {
		writeJSON(w, http.StatusOK, map[string]any{"outline": nil})
		return
	}
	var obj any
	_ = json.Unmarshal(b, &obj)
	writeJSON(w, http.StatusOK, map[string]any{"outline": obj})
}

// --- Script (per act) ---

type scriptReq struct {
	Acts     []string `json:"acts"`
	Question string   `json:"question"`
	Answer   string   `json:"answer"`
	Why      string   `json:"why"`
}

// scriptVersion is one saved script generation. Versions are never overwritten.
type scriptVersion struct {
	ID         int    `json:"id"`
	Act        string `json:"act"`
	Markdown   string `json:"markdown_file"`
	Beats      string `json:"beats_file"`
	Voiceover  string `json:"voiceover_file"`
	Model      string `json:"model"`
	CreatedAt  string `json:"created_at"`
}

type scriptVersions struct {
	Versions []scriptVersion `json:"versions"`
}

func (a *App) loadScriptVersions(slug string, actSlug string) []scriptVersion {
	b, err := a.store.Read(slug, actSlug+"/script/versions.json")
	if err != nil {
		return nil
	}
	var v scriptVersions
	if json.Unmarshal(b, &v) != nil {
		return nil
	}
	return v.Versions
}

func (a *App) saveScriptVersions(slug string, actSlug string, versions []scriptVersion) {
	buf, _ := json.MarshalIndent(scriptVersions{Versions: versions}, "", "  ")
	_ = a.store.Write(slug, actSlug+"/script/versions.json", buf)
}

func scriptModelName(a *App) string {
	if a.cfg.OpenRouterTextModel != "" {
		return a.cfg.OpenRouterTextModel
	}
	return "google/gemini-3.5-flash"
}

func (a *App) generateScript(w http.ResponseWriter, r *http.Request) {
	slug := r.PathValue("slug")
	p, err := a.loadProject(slug)
	if err != nil {
		writeError(w, r, http.StatusNotFound, "not_found", "project not found")
		return
	}
	var req scriptReq
	body, _ := io.ReadAll(r.Body)
	_ = json.Unmarshal(body, &req)
	keys := req.Acts
	if len(keys) == 0 {
		keys = allActKeys()
	}

	if req.Question != "" || req.Answer != "" || req.Why != "" {
		p.Question = strings.TrimSpace(req.Question)
		p.Answer = strings.TrimSpace(req.Answer)
		p.Why = strings.TrimSpace(req.Why)
		_ = a.saveProject(p)
	}

	outline := a.loadOutlineMap(slug)
	model := scriptModelName(a)
	ts := time.Now().UTC().Format(time.RFC3339)

	done := []string{}
	for _, k := range keys {
		act, ok := actByKey(k)
		if !ok {
			continue
		}
		obj, err := a.generateAct(p, act, outline[act.Key])
		if err != nil {
			writeError(w, r, http.StatusInternalServerError, "openrouter_error", fmt.Sprintf("act %s: %v", act.Key, err))
			return
		}
		md := actToMarkdown(act, obj)
		mdBytes := []byte(md)
		beatBytes, _ := json.MarshalIndent(obj, "", "  ")
		narration, _ := obj["narration"].(string)

		// Latest (always overwritten, backward-compatible).
		if err := a.store.Write(slug, act.Slug+"/script/act.md", mdBytes); err != nil {
			writeError(w, r, http.StatusInternalServerError, "storage_error", "failed to store act script: "+err.Error())
			return
		}
		_ = a.store.Write(slug, act.Slug+"/script/beats.json", beatBytes)
		if narration != "" {
			_ = a.store.Write(slug, act.Slug+"/script/voiceover.txt", []byte(strings.TrimSpace(narration)))
		}

		// Versioned: compute next ID and save versioned copies + update manifest.
		versions := a.loadScriptVersions(slug, act.Slug)
		nextID := 1
		for _, v := range versions {
			if v.ID >= nextID {
				nextID = v.ID + 1
			}
		}
		vSuffix := fmt.Sprintf("v%02d", nextID)
		mdFile := vSuffix + "-act.md"
		beatsFile := vSuffix + "-beats.json"
		voFile := vSuffix + "-voiceover.txt"
		_ = a.store.Write(slug, act.Slug+"/script/"+mdFile, mdBytes)
		_ = a.store.Write(slug, act.Slug+"/script/"+beatsFile, beatBytes)
		if narration != "" {
			_ = a.store.Write(slug, act.Slug+"/script/"+voFile, []byte(strings.TrimSpace(narration)))
		}

		versions = append(versions, scriptVersion{
			ID:        nextID,
			Act:       act.Key,
			Markdown:  mdFile,
			Beats:     beatsFile,
			Voiceover: voFile,
			Model:     model,
			CreatedAt: ts,
		})
		a.saveScriptVersions(slug, act.Slug, versions)

		s := p.Acts[act.Key]
		s.Script = "done"
		p.Acts[act.Key] = s
		done = append(done, act.Key)
	}
	p.Status = "script"
	_ = a.saveProject(p)
	writeJSON(w, http.StatusOK, map[string]any{"ok": true, "acts": done})
}

func (a *App) generateAct(p *Project, act Act, summary string) (map[string]any, error) {
	if summary == "" {
		summary = act.Purpose
	}
	sbCtx := ""
	if len(p.StoryboardPrompts) > 0 {
		var b strings.Builder
		b.WriteString("STORYBOARD CONSISTENCY: The narration must describe what the audience sees in the storyboard images below. Match visual elements, composition, and style precisely.\n\n")
		b.WriteString("Storyboard image prompts:\n")
		for _, a := range acts {
			if prompt, ok := p.StoryboardPrompts[a.Key]; ok && prompt != "" {
				fmt.Fprintf(&b, "=== %s (%s) ===\n%s\n\n", a.Key, a.Role, prompt)
			}
		}
		sbCtx = b.String()
	}
	sys, usr := a.scriptTmpl()
	userContent := renderTmpl(usr, map[string]string{
		"topic":              p.Topic,
		"act_key":            act.Key,
		"act_role":           act.Role,
		"summary":            summary,
		"purpose":            act.Purpose,
		"storyboard_prompts": "", // Always stripped — hard-prepended below.
	})
	// Always prepend storyboard context so it reaches the LLM regardless
	// of whether the editable template includes {{storyboard_prompts}}.
	if sbCtx != "" {
		userContent = sbCtx + userContent
	}
	msgs := []orMessage{
		{Role: "system", Content: sys},
		{Role: "user", Content: userContent},
	}
	a.savePromptMsg(p.Slug, act.Key, "script", msgs)
	raw, err := a.chatText(msgs)
	if err != nil {
		return nil, err
	}
	return extractJSON(raw)
}

func (a *App) loadOutlineMap(slug string) map[string]string {
	out := map[string]string{}
	b, err := a.store.Read(slug, "outline.json")
	if err != nil {
		return out
	}
	var obj map[string]any
	if json.Unmarshal(b, &obj) != nil {
		return out
	}
	if amap, ok := obj["acts"].(map[string]any); ok {
		for k, v := range amap {
			if m, ok := v.(map[string]any); ok {
				if s, ok := m["summary"].(string); ok {
					out[k] = s
				}
			}
		}
	}
	return out
}

func (a *App) getScript(w http.ResponseWriter, r *http.Request) {
	slug := r.PathValue("slug")
	if _, err := a.loadProject(slug); err != nil {
		writeError(w, r, http.StatusNotFound, "not_found", "project not found")
		return
	}
	result := map[string]string{}
	voiceover := map[string]string{}
	allVersions := map[string][]map[string]any{}
	for _, act := range acts {
		b, err := a.store.Read(slug, act.Slug+"/script/act.md")
		if err == nil {
			result[act.Key] = string(b)
		}
		b, err = a.store.Read(slug, act.Slug+"/script/voiceover.txt")
		if err == nil {
			voiceover[act.Key] = string(b)
		}
		versions := a.loadScriptVersions(slug, act.Slug)
		if len(versions) > 0 {
			enriched := make([]map[string]any, 0, len(versions))
			for _, v := range versions {
				item := map[string]any{
					"id":          v.ID,
					"act":         v.Act,
					"model":       v.Model,
					"created_at":  v.CreatedAt,
				}
				if b, err := a.store.Read(slug, act.Slug+"/script/"+v.Markdown); err == nil {
					item["markdown"] = string(b)
				}
				if b, err := a.store.Read(slug, act.Slug+"/script/"+v.Beats); err == nil {
					item["beats"] = string(b)
				}
				if b, err := a.store.Read(slug, act.Slug+"/script/"+v.Voiceover); err == nil {
					item["voiceover"] = string(b)
				}
				enriched = append(enriched, item)
			}
			allVersions[act.Key] = enriched
		}
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"acts":      result,
		"voiceover": voiceover,
		"versions":  allVersions,
	})
}

func actToMarkdown(act Act, obj map[string]any) string {
	narration, _ := obj["narration"].(string)
	beats, _ := obj["beats"].([]any)
	var b strings.Builder
	fmt.Fprintf(&b, "# %s\n\n**Role:** %s\n\n", act.Title, act.Role)
	b.WriteString("## Narration\n\n")
	b.WriteString(strings.TrimSpace(narration))
	b.WriteString("\n\n## Beats\n\n")
	for _, item := range beats {
		m, ok := item.(map[string]any)
		if !ok {
			continue
		}
		id, _ := m["id"].(string)
		text, _ := m["text"].(string)
		fmt.Fprintf(&b, "- **%s**: %s\n", id, strings.TrimSpace(text))
	}
	return b.String()
}
