package main

import (
	"encoding/json"
	"io"
	"net/http"
	"strings"
)

type audioReq struct {
	Acts []string `json:"acts"`
}

func (a *App) generateAudio(w http.ResponseWriter, r *http.Request) {
	slug := r.PathValue("slug")
	p, err := a.loadProject(slug)
	if err != nil {
		http.Error(w, "not found", http.StatusNotFound)
		return
	}
	var req audioReq
	body, _ := io.ReadAll(r.Body)
	_ = json.Unmarshal(body, &req)
	keys := req.Acts
	if len(keys) == 0 {
		keys = allActKeys()
	}
	out := map[string]string{}
	for _, key := range keys {
		act, ok := actByKey(key)
		if !ok {
			continue
		}
		narr := a.readNarration(slug, act)
		if strings.TrimSpace(narr) == "" {
			http.Error(w, "act "+key+" has no narration (generate the script first)", http.StatusBadRequest)
			return
		}
		audio, err := a.tts(narr)
		if err != nil {
			http.Error(w, "audio "+key+": "+err.Error(), http.StatusInternalServerError)
			return
		}
		rel := act.Slug + "/audio/narration.mp3"
		if err := a.store.Write(slug, rel, audio); err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		out[key] = rel
		s := p.Acts[key]
		s.Audio = "done"
		p.Acts[key] = s
	}
	p.Status = "audio"
	_ = a.saveProject(p)
	writeJSON(w, http.StatusOK, map[string]any{"ok": true, "audio": out})
}

func (a *App) getAudio(w http.ResponseWriter, r *http.Request) {
	slug := r.PathValue("slug")
	out := map[string]string{}
	for _, act := range acts {
		rel := act.Slug + "/audio/narration.mp3"
		if _, err := a.store.Read(slug, rel); err == nil {
			out[act.Key] = rel
		}
	}
	writeJSON(w, http.StatusOK, map[string]any{"audio": out})
}

func (a *App) readNarration(slug string, act Act) string {
	if b, err := a.store.Read(slug, act.Slug+"/script/beats.json"); err == nil {
		var obj struct {
			Narration string `json:"narration"`
		}
		if json.Unmarshal(b, &obj) == nil && strings.TrimSpace(obj.Narration) != "" {
			return obj.Narration
		}
	}
	if md, err := a.store.Read(slug, act.Slug+"/script/act.md"); err == nil {
		return strings.TrimSpace(stripMarkdown(string(md)))
	}
	return ""
}

// stripMarkdown is a rough fallback when beats.json narration is unavailable.
func stripMarkdown(md string) string {
	lines := strings.Split(md, "\n")
	out := []string{}
	for _, ln := range lines {
		t := strings.TrimSpace(ln)
		if t == "" || strings.HasPrefix(t, "#") || strings.HasPrefix(t, "**Role") || strings.HasPrefix(t, "- **") {
			continue
		}
		out = append(out, t)
	}
	return strings.Join(out, " ")
}
