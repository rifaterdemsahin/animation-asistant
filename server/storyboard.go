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

// storyboardReq is the optional body posted by the Storyboard page. It carries
// the 3 pedagogical inputs (question/answer/why) and, optionally, edited
// per-act image prompts. When act_prompts is empty the backend renders each
// act's image-prompt template from the editable prompts store.
type storyboardReq struct {
	ActPrompts map[string]string `json:"act_prompts"`
	Question   string            `json:"question"`
	Answer     string            `json:"answer"`
	Why        string            `json:"why"`
}

// storyboardVersion is one saved storyboard image. Generations are versioned
// (storyboard-<act>-NN.png) and never overwrite a previous image. One
// "Execute" produces 3 versions — one per act.
type storyboardVersion struct {
	ID          int    `json:"id"`
	Act         string `json:"act"` // act-1, act-2, act-3 ("" for legacy single-image generations)
	File        string `json:"file"`
	ImagePrompt string `json:"image_prompt"`
	ImageModel  string `json:"image_model"`
	CreatedAt   string `json:"created_at"`
	Archived    bool   `json:"archived"` // hidden from the gallery UI when true
}

type storyboardVersions struct {
	Versions []storyboardVersion `json:"versions"`
}

func (a *App) generateStoryboard(w http.ResponseWriter, r *http.Request) {
	p, err := a.resolveProject(r.PathValue("slug"))
	if err != nil {
		http.Error(w, "not found", http.StatusNotFound)
		return
	}
	slug := p.Slug

	// Optional body: edited per-act image prompts + Q&A overrides from the UI.
	var req storyboardReq
	if body, _ := io.ReadAll(r.Body); len(body) > 0 {
		_ = json.Unmarshal(body, &req)
	}

	// Persist the 3 inputs (question/answer/why) onto the project so the
	// generated storyboard matches the project record.
	changed := false
	if v := strings.TrimSpace(req.Question); v != "" && v != p.Question {
		p.Question = v
		changed = true
	}
	if v := strings.TrimSpace(req.Answer); v != "" && v != p.Answer {
		p.Answer = v
		changed = true
	}
	if v := strings.TrimSpace(req.Why); v != "" && v != p.Why {
		p.Why = v
		changed = true
	}
	if changed {
		_ = a.saveProject(p)
	}

	// Scene assembly (text model) — kept so the full 3-act storyboard is built.
	context := a.storyboardContext(slug, p)
	sys, usr, actTmpls := a.storyboardTmpl()
	msgs := []orMessage{
		{Role: "system", Content: sys},
		{Role: "user", Content: renderTmpl(usr, map[string]string{"context": context})},
	}
	a.savePromptMsg(slug, "storyboard", "storyboard", msgs)
	raw, err := a.chatText(msgs)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	obj, err := extractJSON(raw)
	if err != nil {
		http.Error(w, "storyboard model did not return JSON: "+err.Error(), http.StatusInternalServerError)
		return
	}
	buf, _ := json.MarshalIndent(obj, "", "  ")
	_ = a.store.Write(slug, "storyboard/storyboard.json", buf)

	// Per-act image generation: one image per act (3 total). Scripts are
	// pre-read once so storyboardActVars doesn't hit storage per act.
	imageModel := a.storyboardImageModel()
	versions := a.loadStoryboardVersions(slug)
	outline := a.loadOutlineMap(slug)
	scripts := a.actScriptsAll(slug)

	// Global version id (monotonic across all acts/generations) + per-act file
	// counters (so each act's files read act-1-01, act-1-02, … cleanly).
	nextID := 1
	actCount := map[string]int{}
	for _, v := range versions {
		if v.ID >= nextID {
			nextID = v.ID + 1
		}
		if v.Act != "" {
			actCount[v.Act]++
		}
	}

	// Generate 3 images in parallel (one per act). Image generation is the
	// dominant latency; parallelising cuts wall-clock time from 3× to ~1×.
	latest := map[string]storyboardVersion{} // act key -> latest version this run
	var imageErrs []string
	var mu sync.Mutex
	var wg sync.WaitGroup
	for _, act := range acts {
		wg.Add(1)
		go func(act Act) {
			defer wg.Done()
			pngPrompt := strings.TrimSpace(req.ActPrompts[act.Key])
			if pngPrompt == "" {
				pngPrompt = renderTmpl(actTmpls[act.Key], a.storyboardActVars(p, act, outline, scripts))
			} else {
				// Fill any remaining placeholders ({{act_script}}, {{act_summary}}, etc.)
				// that the client couldn't render from its local state.
				pngPrompt = renderTmpl(pngPrompt, a.storyboardActVars(p, act, outline, scripts))
			}

			mu.Lock()
			actCount[act.Key]++
			file := fmt.Sprintf("storyboard/storyboard-%s-%02d.png", act.Key, actCount[act.Key])
			id := nextID
			nextID++
			mu.Unlock()

			png, gerr := a.generateImageWith(pngPrompt, imageModel)
			if gerr != nil {
				mu.Lock()
				imageErrs = append(imageErrs, act.Key+": "+gerr.Error())
				mu.Unlock()
				return
			}
			if werr := a.store.Write(slug, file, png); werr != nil {
				mu.Lock()
				imageErrs = append(imageErrs, act.Key+": storage write failed: "+werr.Error())
				mu.Unlock()
				return
			}
			ver := storyboardVersion{
				ID:          id,
				Act:         act.Key,
				File:        file,
				ImagePrompt: pngPrompt,
				ImageModel:  imageModel,
				CreatedAt:   time.Now().UTC().Format(time.RFC3339),
			}
			mu.Lock()
			versions = append(versions, ver)
			latest[act.Key] = ver
			mu.Unlock()
		}(act)
	}
	wg.Wait()
	a.saveStoryboardVersions(slug, versions)

	// Per-act prompts to send back (latest generated, else the rendered
	// template) so the UI can prefill the editable per-act prompt boxes.
	actPromptsOut := map[string]string{}
	for _, act := range acts {
		if v, ok := latest[act.Key]; ok {
			actPromptsOut[act.Key] = v.ImagePrompt
		} else {
			actPromptsOut[act.Key] = renderTmpl(actTmpls[act.Key], a.storyboardActVars(p, act, outline, scripts))
		}
	}

	p.StoryboardPrompts = actPromptsOut
	_ = a.saveProject(p)
	writeJSON(w, http.StatusOK, map[string]any{
		"ok":           true,
		"storyboard":   obj,
		"versions":     versions,
		"act_prompts":  actPromptsOut,
		"image_model":  imageModel,
		"image_errors": imageErrs,
		"image_error":  strings.Join(imageErrs, "; "),
	})
}

func (a *App) getStoryboard(w http.ResponseWriter, r *http.Request) {
	slug := r.PathValue("slug")
	if s, err := a.resolveSlug(slug); err == nil {
		slug = s
	}
	versions := a.loadStoryboardVersions(slug)
	// Legacy fallback: projects generated before per-act versioning had a
	// single storyboard.png (and optionally image_prompt.txt).
	if len(versions) == 0 {
		if files, err := a.store.List(slug, "storyboard/"); err == nil {
			for _, f := range files {
				if f == "storyboard/storyboard.png" {
					prompt := ""
					if pb, err := a.store.Read(slug, "storyboard/image_prompt.txt"); err == nil {
						prompt = string(pb)
					}
					versions = append(versions, storyboardVersion{
						ID:          0,
						Act:         "",
						File:        "storyboard/storyboard.png",
						ImagePrompt: prompt,
						ImageModel:  a.storyboardImageModel(),
					})
					break
				}
			}
		}
	}

	var scenes any
	if b, err := a.store.Read(slug, "storyboard/storyboard.json"); err == nil {
		_ = json.Unmarshal(b, &scenes)
	}

	// Latest prompt per act (for prefilling the UI), falling back to the
	// rendered template when an act has no version yet.
	_, _, actTmpls := a.storyboardTmpl()
	actPromptsOut := map[string]string{}
	latestByAct := map[string]storyboardVersion{}
	for _, v := range versions {
		if v.Act == "" {
			continue
		}
		if cur, ok := latestByAct[v.Act]; !ok || v.ID >= cur.ID {
			latestByAct[v.Act] = v
		}
	}
	var p *Project
	if proj, err := a.loadProject(slug); err == nil {
		p = proj
	}
	outline := a.loadOutlineMap(slug)
	var scripts map[string]string
	if p != nil {
		scripts = a.actScriptsAll(slug)
	}
	for _, act := range acts {
		if v, ok := latestByAct[act.Key]; ok && v.ImagePrompt != "" {
			actPromptsOut[act.Key] = v.ImagePrompt
			continue
		}
		if p != nil {
			actPromptsOut[act.Key] = renderTmpl(actTmpls[act.Key], a.storyboardActVars(p, act, outline, scripts))
		}
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"storyboard":  scenes,
		"versions":    versions,
		"act_prompts": actPromptsOut,
		"image_model": a.storyboardImageModel(),
	})
}

// loadStoryboardVersions reads the version manifest (nil if absent).
func (a *App) loadStoryboardVersions(slug string) []storyboardVersion {
	b, err := a.store.Read(slug, "storyboard/versions.json")
	if err != nil {
		return nil
	}
	var v storyboardVersions
	if json.Unmarshal(b, &v) != nil {
		return nil
	}
	return v.Versions
}

func (a *App) saveStoryboardVersions(slug string, versions []storyboardVersion) {
	buf, _ := json.MarshalIndent(storyboardVersions{Versions: versions}, "", "  ")
	_ = a.store.Write(slug, "storyboard/versions.json", buf)
}

// archiveStoryboardReq toggles the archived flag on one storyboard version.
type archiveStoryboardReq struct {
	ID       int  `json:"id"`
	Archived bool `json:"archived"`
}

// archiveStoryboardVersion sets the archived flag on a storyboard image version
// (by id). Archived versions are hidden from the gallery UI by default but are
// never deleted — they can be restored via the same endpoint.
func (a *App) archiveStoryboardVersion(w http.ResponseWriter, r *http.Request) {
	slug, err := a.resolveSlug(r.PathValue("slug"))
	if err != nil {
		writeError(w, r, http.StatusNotFound, "not_found", "project not found")
		return
	}
	var req archiveStoryboardReq
	body, _ := io.ReadAll(r.Body)
	if err := json.Unmarshal(body, &req); err != nil {
		writeError(w, r, http.StatusBadRequest, "bad_request", "invalid JSON: "+err.Error())
		return
	}
	versions := a.loadStoryboardVersions(slug)
	found := false
	for i := range versions {
		if versions[i].ID == req.ID {
			versions[i].Archived = req.Archived
			found = true
			break
		}
	}
	if !found {
		writeError(w, r, http.StatusNotFound, "not_found", "storyboard version not found")
		return
	}
	a.saveStoryboardVersions(slug, versions)
	writeJSON(w, http.StatusOK, map[string]any{"ok": true, "id": req.ID, "archived": req.Archived, "versions": versions})
}

// storyboardActVars builds the template variables for one act's image prompt.
// scripts is a pre-read map from act key to script text (from actScriptsAll).
func (a *App) storyboardActVars(p *Project, act Act, outline, scripts map[string]string) map[string]string {
	summary := outline[act.Key]
	if summary == "" {
		summary = act.Purpose
	}
	script := scripts[act.Key]
	if script == "" {
		script = "(no script yet)"
	}
	return map[string]string{
		"topic":       p.Topic,
		"question":    p.Question,
		"answer":      p.Answer,
		"why":         p.Why,
		"act_key":     act.Key,
		"act_title":   act.Title,
		"act_role":    act.Role,
		"act_summary": summary,
		"act_script":  script,
	}
}

// actScriptsAll reads all act scripts in one pass so callers can pass a
// pre-resolved map to storyboardActVars without redundant storage reads.
func (a *App) actScriptsAll(slug string) map[string]string {
	m := map[string]string{}
	for _, act := range acts {
		m[act.Key] = a.actScriptText(slug, act)
	}
	return m
}

// actScriptText returns the act's script (markdown preferred, else raw beats).
func (a *App) actScriptText(slug string, act Act) string {
	if b, err := a.store.Read(slug, act.Slug+"/script/act.md"); err == nil {
		if s := strings.TrimSpace(string(b)); s != "" {
			return s
		}
	}
	if b, err := a.store.Read(slug, act.Slug+"/script/beats.json"); err == nil {
		if s := strings.TrimSpace(string(b)); s != "" {
			return s
		}
	}
	return "(no script yet)"
}

func (a *App) storyboardContext(slug string, p *Project) string {
	var b strings.Builder
	fmt.Fprintf(&b, "Title: %s\nTopic: %s\n", p.Title, p.Topic)
	if p.Question != "" {
		fmt.Fprintf(&b, "Problem: %s\n", p.Question)
	}
	if p.Answer != "" {
		fmt.Fprintf(&b, "Solution: %s\n", p.Answer)
	}
	if p.Why != "" {
		fmt.Fprintf(&b, "Why (pedagogical rationale): %s\n", p.Why)
	}
	b.WriteString("\n")
	if ob, err := a.store.Read(slug, "outline.json"); err == nil {
		fmt.Fprintf(&b, "OUTLINE:\n%s\n\n", string(ob))
	}
	for _, act := range acts {
		fmt.Fprintf(&b, "== %s (%s) ==\n", act.Title, act.Role)
		if bb, err := a.store.Read(slug, act.Slug+"/script/beats.json"); err == nil {
			fmt.Fprintf(&b, "SCRIPT: %s\n", string(bb))
		}
		if cb, err := a.store.Read(slug, act.Slug+"/components/components.json"); err == nil {
			var comps []map[string]any
			if json.Unmarshal(cb, &comps) == nil {
				ids := []string{}
				for _, c := range comps {
					if id, ok := c["id"].(string); ok {
						ids = append(ids, id)
					}
				}
				fmt.Fprintf(&b, "COMPONENTS: %s\n", strings.Join(ids, ", "))
			}
		}
		b.WriteString("\n")
	}
	return b.String()
}
