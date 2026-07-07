package main

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
)

// --- Outline (project-level) ---

type outlineReq struct {
	Force bool `json:"force"`
}

func (a *App) generateOutline(w http.ResponseWriter, r *http.Request) {
	slug := r.PathValue("slug")
	p, err := a.loadProject(slug)
	if err != nil {
		http.Error(w, "not found", http.StatusNotFound)
		return
	}
	var req outlineReq
	body, _ := io.ReadAll(r.Body)
	_ = json.Unmarshal(body, &req)

	msgs := []orMessage{
		{Role: "system", Content: "You design short animated explainer video outlines using a STRICT 3-act structure: Act 1 = Problem, Act 2 = Solution, Act 3 = Lesson. You return JSON only, no markdown."},
		{Role: "user", Content: fmt.Sprintf(
			"Topic: %s\nComponent type: %s\n\nProduce a JSON object with this exact shape:\n"+
				`{"title":"short title","logline":"one sentence","acts":{"act-1":{"summary":"..."},"act-2":{"summary":"..."},"act-3":{"summary":"..."}}}`+"\n"+
				"Each act summary must be 1-2 sentences fitting the act's role. JSON only.",
			p.Topic, p.ComponentType)},
	}
	raw, err := a.chatJSON(msgs)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	obj, err := extractJSON(raw)
	if err != nil {
		http.Error(w, "model did not return JSON: "+err.Error(), http.StatusInternalServerError)
		return
	}
	buf, _ := json.MarshalIndent(obj, "", "  ")
	if err := a.store.Write(slug, "outline.json", buf); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
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
	Acts []string `json:"acts"`
}

func (a *App) generateScript(w http.ResponseWriter, r *http.Request) {
	slug := r.PathValue("slug")
	p, err := a.loadProject(slug)
	if err != nil {
		http.Error(w, "not found", http.StatusNotFound)
		return
	}
	var req scriptReq
	body, _ := io.ReadAll(r.Body)
	_ = json.Unmarshal(body, &req)
	keys := req.Acts
	if len(keys) == 0 {
		keys = allActKeys()
	}

	outline := a.loadOutlineMap(slug)

	done := []string{}
	for _, k := range keys {
		act, ok := actByKey(k)
		if !ok {
			continue
		}
		obj, err := a.generateAct(p, act, outline[act.Key])
		if err != nil {
			http.Error(w, fmt.Sprintf("act %s: %v", act.Key, err), http.StatusInternalServerError)
			return
		}
		md := actToMarkdown(act, obj)
		mdBytes := []byte(md)
		beatBytes, _ := json.MarshalIndent(obj, "", "  ")
		if err := a.store.Write(slug, act.Slug+"/script/act.md", mdBytes); err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		_ = a.store.Write(slug, act.Slug+"/script/beats.json", beatBytes)
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
	msgs := []orMessage{
		{Role: "system", Content: "You are a scriptwriter for short animated explainer videos. You write ONE act and return STRICT JSON only, no markdown."},
		{Role: "user", Content: fmt.Sprintf(
			"Topic: %s\nAct: %s (%s)\nOutline summary for this act: %s\n\n"+
				"Write only this act. Return JSON with this exact shape:\n"+
				`{"narration":"1-3 paragraphs of voiceover","beats":[{"id":"beat-1","text":"one concrete, visualizable story beat"}]}`+"\n"+
				"Rules: stay focused on the act role (%s); 3 to 6 beats; each beat must be concrete and easy to illustrate. JSON only.",
			p.Topic, act.Key, act.Role, summary, act.Purpose)},
	}
	raw, err := a.chatJSON(msgs)
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
		http.Error(w, "not found", http.StatusNotFound)
		return
	}
	result := map[string]string{}
	for _, act := range acts {
		b, err := a.store.Read(slug, act.Slug+"/script/act.md")
		if err == nil {
			result[act.Key] = string(b)
		}
	}
	writeJSON(w, http.StatusOK, map[string]any{"acts": result})
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
