package main

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"sync"
	"time"
)

// --- Outline (project-level) ---

type outlineReq struct {
	Force bool `json:"force"`
}

func (a *App) generateOutline(w http.ResponseWriter, r *http.Request) {
	p, err := a.resolveProject(r.PathValue("slug"))
	if err != nil {
		writeError(w, r, http.StatusNotFound, "not_found", "project not found")
		return
	}
	slug := p.Slug
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
	if s, err := a.resolveSlug(slug); err == nil {
		slug = s
	}
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
	// Provider selects the text backend: "openrouter" (default) or "deepseek".
	Provider string `json:"provider"`
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
	p, err := a.resolveProject(r.PathValue("slug"))
	if err != nil {
		writeError(w, r, http.StatusNotFound, "not_found", "project not found")
		return
	}
	slug := p.Slug
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
	provider := strings.TrimSpace(req.Provider)
	if provider == "" {
		provider = "openrouter"
	}
	model := a.scriptProviderModel(provider)
	ts := time.Now().UTC().Format(time.RFC3339)

	done := []string{}
	for _, k := range keys {
		act, ok := actByKey(k)
		if !ok {
			continue
		}
		obj, err := a.generateActWith(p, act, outline[act.Key], provider)
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

func (a *App) actScriptMessages(p *Project, act Act, summary string) []orMessage {
	if summary == "" {
		summary = act.Purpose
	}
	sbCtx := ""
	if len(p.StoryboardPrompts) > 0 {
		var b strings.Builder
		b.WriteString("### STORYBOARD IMAGES FOR THIS ACT\n")
		b.WriteString("The narration must describe what the audience sees in these images. Match visual elements, composition, and style precisely.\n\n")
		for _, a := range acts {
			if prompt, ok := p.StoryboardPrompts[a.Key]; ok && prompt != "" {
				fmt.Fprintf(&b, "**%s (%s):** %s\n\n", a.Key, a.Role, prompt)
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
	return []orMessage{
		{Role: "system", Content: sys},
		{Role: "user", Content: userContent},
	}
}

func (a *App) generateAct(p *Project, act Act, summary string) (map[string]any, error) {
	return a.generateActWith(p, act, summary, "openrouter")
}

// generateActWith builds the prompt once and runs it against the requested
// text provider (openrouter or deepseek). Only the default provider logs to
// the prompt store, to avoid duplicating identical messages.
func (a *App) generateActWith(p *Project, act Act, summary, provider string) (map[string]any, error) {
	msgs := a.actScriptMessages(p, act, summary)
	if provider == "" || provider == "openrouter" {
		a.savePromptMsg(p.Slug, act.Key, "script", msgs)
	}
	raw, err := a.chatTextProvider(msgs, provider)
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
	p, err := a.resolveProject(r.PathValue("slug"))
	if err != nil {
		writeError(w, r, http.StatusNotFound, "not_found", "project not found")
		return
	}
	slug := p.Slug
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

// compareScriptReq selects a single act to run through both providers.
type compareScriptReq struct {
	Act      string `json:"act"`
	Question string `json:"question"`
	Answer   string `json:"answer"`
	Why      string `json:"why"`
}

type providerResult struct {
	Provider  string `json:"provider"`
	Model     string `json:"model"`
	Markdown  string `json:"markdown"`
	Beats     any    `json:"beats"`
	Narration string `json:"narration"`
	ElapsedMs int64  `json:"elapsed_ms"`
	Chars     int    `json:"chars"`
	Ok        bool   `json:"ok"`
	Error     string `json:"error,omitempty"`
}

// --- Script Pipeline (GET state + POST generate) ---

type generatePipelineReq struct {
	Force bool `json:"force"`
}

// assembleScriptResponse builds the unified script pipeline response used by
// both GET (read-only) and POST (generate) handlers.
func (a *App) assembleScriptResponse(p *Project) map[string]any {
	slug := p.Slug
	outline := a.loadOutline(slug)
	outlineObj := a.readOutlineObject(slug)

	actsResp := map[string]any{}
	versionsResp := map[string][]map[string]any{}
	for _, act := range acts {
		actInfo := map[string]any{
			"key":   act.Key,
			"role":  act.Role,
			"title": act.Title,
		}
		if b, err := a.store.Read(slug, act.Slug+"/script/act.md"); err == nil {
			actInfo["markdown"] = string(b)
		}
		if b, err := a.store.Read(slug, act.Slug+"/script/beats.json"); err == nil {
			var raw map[string]any
			if json.Unmarshal(b, &raw) == nil {
				if n, ok := raw["narration"].(string); ok {
					actInfo["narration"] = n
				}
				if beats, ok := raw["beats"]; ok {
					actInfo["beats"] = beats
				}
			}
		}
		if b, err := a.store.Read(slug, act.Slug+"/script/voiceover.txt"); err == nil {
			actInfo["voiceover"] = string(b)
		}
		actsResp[act.Key] = actInfo

		versions := a.loadScriptVersions(slug, act.Slug)
		if len(versions) > 0 {
			enriched := make([]map[string]any, 0, len(versions))
			for _, v := range versions {
				item := map[string]any{
					"id":         v.ID,
					"act":        v.Act,
					"model":      v.Model,
					"created_at": v.CreatedAt,
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
			versionsResp[act.Key] = enriched
		}
	}

	phases := map[string]string{
		"storyboard": phaseStatus(len(p.StoryboardPrompts) > 0),
		"outline":    phaseStatus(outline != nil),
		"script":     phaseStatus(allActsScriptDone(p)),
	}

	return map[string]any{
		"ok":         true,
		"project_id": p.ProjectID,
		"title":      p.Title,
		"status":     p.Status,
		"phases":     phases,
		"outline":    outlineObj,
		"acts":       actsResp,
		"versions":   versionsResp,
	}
}

func (a *App) loadOutline(slug string) map[string]string {
	return a.loadOutlineMap(slug)
}

func (a *App) readOutlineObject(slug string) any {
	b, err := a.store.Read(slug, "outline.json")
	if err != nil {
		return nil
	}
	var obj any
	_ = json.Unmarshal(b, &obj)
	return obj
}

func phaseStatus(ok bool) string {
	if ok {
		return "done"
	}
	return "pending"
}

func allActsScriptDone(p *Project) bool {
	for _, a := range acts {
		if s, ok := p.Acts[a.Key]; !ok || s.Script != "done" {
			return false
		}
	}
	return true
}

// scriptPipelineState serves the current script pipeline state (read-only, no generation).
func (a *App) scriptPipelineState(w http.ResponseWriter, r *http.Request) {
	p, err := a.resolveProject(r.PathValue("slug"))
	if err != nil {
		writeError(w, r, http.StatusNotFound, "not_found", "project not found")
		return
	}
	writeJSON(w, http.StatusOK, a.assembleScriptResponse(p))
}

// generateScriptPipeline runs the pipeline up through script phase, auto-skipping
// completed steps unless forced. Returns the same shape as the GET endpoint.
func (a *App) generateScriptPipeline(w http.ResponseWriter, r *http.Request) {
	p, err := a.resolveProject(r.PathValue("slug"))
	if err != nil {
		writeError(w, r, http.StatusNotFound, "not_found", "project not found")
		return
	}
	var req generatePipelineReq
	body, _ := io.ReadAll(r.Body)
	_ = json.Unmarshal(body, &req)

	if len(p.StoryboardPrompts) == 0 {
		writeError(w, r, http.StatusBadRequest, "storyboard_required",
			"Storyboard images must be generated before script. Run storyboard first.")
		return
	}

	// Phase 1: Outline
	if req.Force || !allActsOutlineDone(p) {
		sys, usr := a.outlineTmpl()
		msgs := []orMessage{
			{Role: "system", Content: sys},
			{Role: "user", Content: renderTmpl(usr, map[string]string{
				"topic":          p.Topic,
				"component_type": p.ComponentType,
			})},
		}
		a.savePromptMsg(p.Slug, "outline", "outline", msgs)
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
		if err := a.store.Write(p.Slug, "outline.json", buf); err != nil {
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
	}

	// Phase 2: Script
	outlineMap := a.loadOutlineMap(p.Slug)
	provider := "openrouter"
	model := a.scriptProviderModel(provider)
	ts := time.Now().UTC().Format(time.RFC3339)

	for _, act := range acts {
		if !req.Force {
			if s, ok := p.Acts[act.Key]; ok && s.Script == "done" {
				continue
			}
		}
		obj, err := a.generateActWith(p, act, outlineMap[act.Key], provider)
		if err != nil {
			writeError(w, r, http.StatusInternalServerError, "openrouter_error", fmt.Sprintf("act %s: %v", act.Key, err))
			return
		}
		md := actToMarkdown(act, obj)
		mdBytes := []byte(md)
		beatBytes, _ := json.MarshalIndent(obj, "", "  ")
		narration, _ := obj["narration"].(string)

		if err := a.store.Write(p.Slug, act.Slug+"/script/act.md", mdBytes); err != nil {
			writeError(w, r, http.StatusInternalServerError, "storage_error", "failed to store act script: "+err.Error())
			return
		}
		_ = a.store.Write(p.Slug, act.Slug+"/script/beats.json", beatBytes)
		if narration != "" {
			_ = a.store.Write(p.Slug, act.Slug+"/script/voiceover.txt", []byte(strings.TrimSpace(narration)))
		}

		versions := a.loadScriptVersions(p.Slug, act.Slug)
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
		_ = a.store.Write(p.Slug, act.Slug+"/script/"+mdFile, mdBytes)
		_ = a.store.Write(p.Slug, act.Slug+"/script/"+beatsFile, beatBytes)
		if narration != "" {
			_ = a.store.Write(p.Slug, act.Slug+"/script/"+voFile, []byte(strings.TrimSpace(narration)))
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
		a.saveScriptVersions(p.Slug, act.Slug, versions)

		s := p.Acts[act.Key]
		s.Script = "done"
		p.Acts[act.Key] = s
	}
	p.Status = "script"
	_ = a.saveProject(p)

	// Reload fresh project for state assembly.
	p2, _ := a.resolveProject(r.PathValue("slug"))
	if p2 != nil {
		p = p2
	}
	writeJSON(w, http.StatusOK, a.assembleScriptResponse(p))
}

func (a *App) serveVoiceover(w http.ResponseWriter, r *http.Request) {
	p, err := a.resolveProject(r.PathValue("slug"))
	if err != nil {
		http.Error(w, "Project not found.", http.StatusNotFound)
		return
	}
	slug := p.Slug
	var b strings.Builder
	found := false
	for _, act := range acts {
		text, err := a.store.Read(slug, act.Slug+"/script/voiceover.txt")
		if err != nil || len(text) == 0 {
			continue
		}
		if found {
			b.WriteString("\n")
		}
		fmt.Fprintf(&b, "%s\n===============\n", act.Title)
		b.WriteString(strings.TrimSpace(string(text)))
		b.WriteString("\n")
		found = true
	}
	if !found {
		w.Header().Set("Content-Type", "text/plain; charset=utf-8")
		w.WriteHeader(http.StatusNotFound)
		fmt.Fprintf(w, "No script found for project %s. Generate the script first.\n", p.ProjectID)
		return
	}
	w.Header().Set("Content-Type", "text/plain; charset=utf-8")
	_, _ = w.Write([]byte(b.String()))
}

// listScripts returns all projects that have scripts, with per-act voiceover text.
func (a *App) listScripts(w http.ResponseWriter, r *http.Request) {
	slugs, err := a.store.ListProjects()
	if err != nil {
		writeError(w, r, http.StatusInternalServerError, "list_error", err.Error())
		return
	}
	type actScript struct {
		Key       string `json:"key"`
		Role      string `json:"role"`
		Title     string `json:"title"`
		Voiceover string `json:"voiceover"`
	}
	type scriptItem struct {
		ProjectID string      `json:"project_id"`
		Title     string      `json:"title"`
		Topic     string      `json:"topic"`
		Acts      []actScript `json:"acts"`
	}
	var result []scriptItem
	for _, s := range slugs {
		p, err := a.loadProject(s)
		if err != nil {
			continue
		}
		hasAny := false
		var actsOut []actScript
		for _, act := range acts {
			text, err := a.store.Read(s, act.Slug+"/script/voiceover.txt")
			if err != nil || len(text) == 0 {
				continue
			}
			hasAny = true
			actsOut = append(actsOut, actScript{
				Key:       act.Key,
				Role:      act.Role,
				Title:     act.Title,
				Voiceover: string(text),
			})
		}
		if !hasAny {
			continue
		}
		result = append(result, scriptItem{
			ProjectID: p.ProjectID,
			Title:     p.Title,
			Topic:     p.Topic,
			Acts:      actsOut,
		})
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"scripts": result,
		"count":   len(result),
	})
}

func allActsOutlineDone(p *Project) bool {
	for _, a := range acts {
		if s, ok := p.Acts[a.Key]; !ok || s.Outline != "done" {
			return false
		}
	}
	return true
}

// compareScript runs one act's script prompt through BOTH OpenRouter and
// DeepSeek (same prompt, parallel), returning side-by-side results so the UI
// can compare quality, latency and length. Nothing is persisted.
func (a *App) compareScript(w http.ResponseWriter, r *http.Request) {
	p, err := a.resolveProject(r.PathValue("slug"))
	if err != nil {
		writeError(w, r, http.StatusNotFound, "not_found", "project not found")
		return
	}
	var req compareScriptReq
	body, _ := io.ReadAll(r.Body)
	_ = json.Unmarshal(body, &req)
	if req.Question != "" || req.Answer != "" || req.Why != "" {
		p.Question = strings.TrimSpace(req.Question)
		p.Answer = strings.TrimSpace(req.Answer)
		p.Why = strings.TrimSpace(req.Why)
	}

	actKey := strings.TrimSpace(req.Act)
	if actKey == "" {
		actKey = "act-1"
	}
	act, ok := actByKey(actKey)
	if !ok {
		writeError(w, r, http.StatusBadRequest, "bad_request", "unknown act: "+actKey)
		return
	}
	outline := a.loadOutlineMap(p.Slug)
	msgs := a.actScriptMessages(p, act, outline[act.Key])

	run := func(provider string) providerResult {
		res := providerResult{Provider: provider, Model: a.scriptProviderModel(provider)}
		start := time.Now()
		raw, err := a.chatTextProvider(msgs, provider)
		res.ElapsedMs = time.Since(start).Milliseconds()
		if err != nil {
			res.Error = err.Error()
			return res
		}
		obj, perr := extractJSON(raw)
		if perr != nil {
			res.Error = "model did not return valid JSON: " + perr.Error()
			return res
		}
		res.Markdown = actToMarkdown(act, obj)
		res.Beats = obj["beats"]
		res.Narration, _ = obj["narration"].(string)
		res.Chars = len(res.Markdown)
		res.Ok = true
		return res
	}

	var orRes, dsRes providerResult
	var wg sync.WaitGroup
	wg.Add(2)
	go func() { defer wg.Done(); orRes = run("openrouter") }()
	go func() { defer wg.Done(); dsRes = run("deepseek") }()
	wg.Wait()

	writeJSON(w, http.StatusOK, map[string]any{
		"ok":        true,
		"act":       act.Key,
		"act_title": act.Title,
		"openrouter": orRes,
		"deepseek":   dsRes,
		"deepseek_configured": a.ds != nil && a.ds.configured(),
	})
}
