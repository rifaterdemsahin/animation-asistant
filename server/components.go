package main

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
)

type compReq struct {
	Acts  []string `json:"acts"`
	Types []string `json:"types"`
}

var defaultCompTypes = []string{"background", "lower-third", "speech-bubble", "infographic"}

var compStyle = map[string]string{
	"background":    "wide 16:9 background scene illustration, clean flat vector style, no text",
	"lower-third":   "lower-third banner overlay graphic with space for a short caption, flat vector, minimal",
	"speech-bubble": "speech bubble graphic with space for a short quote, flat vector, clean",
	"infographic":   "clean infographic with simple data visualization using icons and numbers, flat vector",
	"character":     "single character or mascot illustration, flat vector, centered, plain background",
	"icon":          "simple minimal flat icon on a plain background",
	"title-card":    "full-screen title card graphic with space for a heading, bold flat vector",
	"transition":    "abstract motion-transition graphic, flat vector",
}

func (a *App) generateComponents(w http.ResponseWriter, r *http.Request) {
	slug := r.PathValue("slug")
	p, err := a.loadProject(slug)
	if err != nil {
		http.Error(w, "not found", http.StatusNotFound)
		return
	}
	var req compReq
	body, _ := io.ReadAll(r.Body)
	_ = json.Unmarshal(body, &req)
	keys := req.Acts
	if len(keys) == 0 {
		keys = allActKeys()
	}
	types := req.Types
	if len(types) == 0 {
		types = defaultCompTypes
	}

	manifest := map[string][]map[string]any{}
	for _, key := range keys {
		act, ok := actByKey(key)
		if !ok {
			continue
		}
		beats := a.loadBeats(slug, act)
		var list []map[string]any
		for i, t := range types {
			style := compStyle[t]
			if style == "" {
				style = t
			}
			beatText := beatAt(beats, i)
			if beatText == "" {
				beatText = p.Topic
			}
			prompt := fmt.Sprintf("%s. Illustrate this idea: %s. Topic: %s. Flat vector, clean, consistent style.",
				style, beatText, p.Topic)
			img, err := a.generateImage(prompt)
			if err != nil {
				http.Error(w, fmt.Sprintf("component %s/%s: %v", act.Key, t, err), http.StatusInternalServerError)
				return
			}
			fname := fmt.Sprintf("%s-%s-%02d.png", slug, t, i+1)
			rel := act.Slug + "/components/" + fname
			if err := a.store.Write(slug, rel, img); err != nil {
				http.Error(w, err.Error(), http.StatusInternalServerError)
				return
			}
			list = append(list, map[string]any{
				"id":         fmt.Sprintf("%s-%s-%02d", slug, t, i+1),
				"type":       t,
				"prompt":     prompt,
				"file":       rel,
				"script_ref": beatID(beats, i),
			})
		}
		buf, _ := json.MarshalIndent(list, "", "  ")
		_ = a.store.Write(slug, act.Slug+"/components/components.json", buf)
		manifest[key] = list
		s := p.Acts[key]
		s.Components = "done"
		p.Acts[key] = s
	}
	p.Status = "components"
	_ = a.saveProject(p)
	writeJSON(w, http.StatusOK, map[string]any{"ok": true, "manifest": manifest})
}

func (a *App) getComponents(w http.ResponseWriter, r *http.Request) {
	slug := r.PathValue("slug")
	out := map[string][]map[string]any{}
	for _, act := range acts {
		b, err := a.store.Read(slug, act.Slug+"/components/components.json")
		if err != nil {
			continue
		}
		var list []map[string]any
		if json.Unmarshal(b, &list) == nil {
			out[act.Key] = list
		}
	}
	writeJSON(w, http.StatusOK, map[string]any{"acts": out})
}

// loadBeats reads an act's beats.json into a slice of beat objects.
func (a *App) loadBeats(slug string, act Act) []map[string]any {
	b, err := a.store.Read(slug, act.Slug+"/script/beats.json")
	if err != nil {
		return nil
	}
	var obj struct {
		Narration string           `json:"narration"`
		Beats     []map[string]any `json:"beats"`
	}
	if json.Unmarshal(b, &obj) != nil {
		return nil
	}
	return obj.Beats
}

func beatAt(beats []map[string]any, i int) string {
	if i < len(beats) {
		if t, ok := beats[i]["text"].(string); ok {
			return t
		}
	}
	if len(beats) > 0 {
		if t, ok := beats[0]["text"].(string); ok {
			return t
		}
	}
	return ""
}

func beatID(beats []map[string]any, i int) string {
	if i < len(beats) {
		if id, ok := beats[i]["id"].(string); ok {
			return id
		}
	}
	if len(beats) > 0 {
		if id, ok := beats[0]["id"].(string); ok {
			return id
		}
	}
	return ""
}
