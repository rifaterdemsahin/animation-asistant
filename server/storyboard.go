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
	sys, usr, imgTmpl := a.storyboardTmpl()
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

	// 4-frame storyboard infographic image
	pngPrompt := renderTmpl(imgTmpl, map[string]string{"topic": p.Topic})
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
