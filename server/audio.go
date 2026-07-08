package main

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
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

type musicReq struct {
	Acts  []string `json:"acts"`
	Genre string   `json:"genre"`
	Mood  string   `json:"mood"`
}

func (a *App) generateMusic(w http.ResponseWriter, r *http.Request) {
	slug := r.PathValue("slug")
	p, err := a.loadProject(slug)
	if err != nil {
		writeError(w, r, http.StatusNotFound, "not_found", "project not found")
		return
	}
	var req musicReq
	body, _ := io.ReadAll(r.Body)
	_ = json.Unmarshal(body, &req)
	keys := req.Acts
	if len(keys) == 0 {
		keys = allActKeys()
	}
	musicTmpl, defGenre, defMood := a.musicTmpl()
	genre := req.Genre
	if genre == "" {
		genre = defGenre
	}
	mood := req.Mood
	if mood == "" {
		mood = defMood
	}

	out := map[string]string{}
	for _, key := range keys {
		act, ok := actByKey(key)
		if !ok {
			continue
		}
		prompt := renderTmpl(musicTmpl, map[string]string{
			"genre":    genre,
			"mood":     mood,
			"act_role": act.Role,
			"topic":    p.Topic,
		})
		a.savePrompt(slug, act.Key, "music", prompt)
		music, err := a.falMusic(prompt)
		if err != nil {
			writeError(w, r, http.StatusInternalServerError, "fal_error", "music "+key+": "+err.Error())
			return
		}
		rel := act.Slug + "/audio/music.mp3"
		if err := a.store.Write(slug, rel, music); err != nil {
			writeError(w, r, http.StatusInternalServerError, "storage_error", err.Error())
			return
		}
		out[key] = rel
	}
	writeJSON(w, http.StatusOK, map[string]any{"ok": true, "music": out})
}

type sfxReq struct {
	Acts  []string `json:"acts"`
	Beats []string `json:"beats"`
}

func (a *App) generateSFX(w http.ResponseWriter, r *http.Request) {
	slug := r.PathValue("slug")
	_, err := a.loadProject(slug)
	if err != nil {
		writeError(w, r, http.StatusNotFound, "not_found", "project not found")
		return
	}
	var req sfxReq
	body, _ := io.ReadAll(r.Body)
	_ = json.Unmarshal(body, &req)
	keys := req.Acts
	if len(keys) == 0 {
		keys = allActKeys()
	}

	type sfxResult struct {
		Name string `json:"name"`
		File string `json:"file"`
		Type string `json:"type"`
	}
	sfxTmpl, sfxTypes := a.sfxTmpl()
	out := map[string][]sfxResult{}
	for _, key := range keys {
		act, ok := actByKey(key)
		if !ok {
			continue
		}
		var results []sfxResult
		for i, st := range sfxTypes {
			prompt := renderTmpl(sfxTmpl, map[string]string{"desc": st.Desc})
			a.savePrompt(slug, act.Key, fmt.Sprintf("sfx-%s", st.Name), prompt)
			audio, err := a.falSFX(prompt)
			if err != nil {
				writeError(w, r, http.StatusInternalServerError, "fal_error", fmt.Sprintf("sfx %s/%s: %v", act.Key, st.Name, err))
				return
			}
			fname := fmt.Sprintf("sfx-%s-%02d.mp3", st.Name, i+1)
			rel := act.Slug + "/audio/" + fname
			if err := a.store.Write(slug, rel, audio); err != nil {
				writeError(w, r, http.StatusInternalServerError, "storage_error", err.Error())
				return
			}
			results = append(results, sfxResult{Name: st.Name, File: rel, Type: "sound_effect"})
		}
		out[key] = results
	}
	writeJSON(w, http.StatusOK, map[string]any{"ok": true, "sfx": out})
}

func (a *App) getMusicStatus(w http.ResponseWriter, r *http.Request) {
	slug := r.PathValue("slug")
	out := map[string]string{}
	for _, act := range acts {
		rel := act.Slug + "/audio/music.mp3"
		if _, err := a.store.Read(slug, rel); err == nil {
			out[act.Key] = rel
		}
	}
	writeJSON(w, http.StatusOK, map[string]any{"music": out})
}

func (a *App) getSFXStatus(w http.ResponseWriter, r *http.Request) {
	slug := r.PathValue("slug")
	out := map[string][]string{}
	for _, act := range acts {
		glob := act.Slug + "/audio/"
		entries, _ := a.store.List(slug, glob)
		var sfx []string
		for _, e := range entries {
			if strings.Contains(e, "sfx-") {
				sfx = append(sfx, e)
			}
		}
		if len(sfx) > 0 {
			out[act.Key] = sfx
		}
	}
	writeJSON(w, http.StatusOK, map[string]any{"sfx": out})
}

func (a *App) savePrompt(slug, act, step, prompt string) {
	ts := time.Now().UTC().Format("20060102-150405")
	name := fmt.Sprintf("prompts/%s-%s-%s.json", ts, act, step)
	entry := map[string]any{
		"timestamp": time.Now().UTC().Format(time.RFC3339),
		"act":       act,
		"step":      step,
		"prompt":    prompt,
	}
	b, _ := json.MarshalIndent(entry, "", "  ")
	_ = a.store.Write(slug, name, b)
}

func (a *App) savePromptMsg(slug, act, step string, msgs []orMessage) {
	var b strings.Builder
	for _, m := range msgs {
		fmt.Fprintf(&b, "[%s]\n%s\n\n", m.Role, m.Content)
	}
	a.savePrompt(slug, act, step, b.String())
}
