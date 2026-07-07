package main

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
)

func (a *App) generateStoryboard(w http.ResponseWriter, r *http.Request) {
	slug := r.PathValue("slug")
	p, err := a.loadProject(slug)
	if err != nil {
		http.Error(w, "not found", http.StatusNotFound)
		return
	}
	context := a.storyboardContext(slug, p)
	msgs := []orMessage{
		{Role: "system", Content: "You assemble a 3-act storyboard for an explainer video. Return STRICT JSON only, no markdown."},
		{Role: "user", Content: fmt.Sprintf(
			"Build a scene-by-scene storyboard from this project material:\n\n%s\n\n"+
				`Return JSON: {"acts":{"act-1":{"scenes":[{"scene_id":"s1","beat_ref":"beat-1","component_ids":[],"duration":4,"description":"..."}]},"act-2":{"scenes":[]},"act-3":{"scenes":[]}}}`+"\n"+
				"Each scene may reference an existing component_id. Durations are seconds (2-8). JSON only.",
			context)},
	}
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

	// infographic overview image
	pngPrompt := fmt.Sprintf("an infographic storyboard overview for a 3-act explainer video about: %s. "+
		"Three labeled sections: Problem, Solution, Lesson. Clean flat vector, modern.", p.Topic)
	if png, err := a.generateImage(pngPrompt); err == nil {
		_ = a.store.Write(slug, "storyboard/storyboard.png", png)
	}

	p.Status = "storyboard"
	_ = a.saveProject(p)
	writeJSON(w, http.StatusOK, map[string]any{"ok": true, "storyboard": obj})
}

func (a *App) getStoryboard(w http.ResponseWriter, r *http.Request) {
	slug := r.PathValue("slug")
	b, err := a.store.Read(slug, "storyboard/storyboard.json")
	if err != nil {
		writeJSON(w, http.StatusOK, map[string]any{"storyboard": nil})
		return
	}
	var obj any
	_ = json.Unmarshal(b, &obj)
	writeJSON(w, http.StatusOK, map[string]any{"storyboard": obj})
}

func (a *App) storyboardContext(slug string, p *Project) string {
	var b strings.Builder
	fmt.Fprintf(&b, "Title: %s\nTopic: %s\n\n", p.Title, p.Topic)
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
