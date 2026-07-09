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

func (a *App) generateComponents(w http.ResponseWriter, r *http.Request) {
	p, err := a.resolveProject(r.PathValue("slug"))
	if err != nil {
		http.Error(w, "not found", http.StatusNotFound)
		return
	}
	slug := p.Slug
	var req compReq
	body, _ := io.ReadAll(r.Body)
	_ = json.Unmarshal(body, &req)
	keys := req.Acts
	if len(keys) == 0 {
		keys = allActKeys()
	}

	styles, defaultTypes, imgTmpl := a.componentsTmpl()

	// Canonical beat index per type (from the default type order). A single-type
	// request must still pick the beat that matches its position in the full set,
	// otherwise generating "infographic" alone would wrongly grab beat-1.
	beatIdx := map[string]int{}
	for i, t := range defaultTypes {
		beatIdx[t] = i
	}

	// Which types to (re)generate. Empty = all default types.
	typeSet := req.Types
	if len(typeSet) == 0 {
		typeSet = defaultTypes
	}

	manifest := map[string][]map[string]any{}
	for _, key := range keys {
		act, ok := actByKey(key)
		if !ok {
			continue
		}
		beats := a.loadBeats(slug, act)

		// Merge semantics: start from the existing manifest so regenerating one
		// component never wipes the other types already produced for the act.
		byType := map[string]map[string]any{}
		for _, e := range a.loadComponentManifest(slug, act) {
			if t, ok := e["type"].(string); ok {
				byType[t] = e
			}
		}

		for _, t := range typeSet {
			style := styles[t]
			if style == "" {
				style = t
			}
			i := beatIdx[t] // canonical index; custom types fall back to 0
			beatText := beatAt(beats, i)
			if beatText == "" {
				beatText = p.Topic
			}
			prompt := renderTmpl(imgTmpl, map[string]string{
				"style": style,
				"beat":  beatText,
				"topic": p.Topic,
			})
			a.savePrompt(slug, act.Key, "component-"+t, prompt)
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
			byType[t] = map[string]any{
				"id":         fmt.Sprintf("%s-%s-%02d", slug, t, i+1),
				"type":       t,
				"prompt":     prompt,
				"file":       rel,
				"script_ref": beatID(beats, i),
			}
		}

		// Rebuild the manifest in canonical (default-type) order, then any extras.
		var list []map[string]any
		for _, t := range defaultTypes {
			if e, ok := byType[t]; ok {
				list = append(list, e)
			}
		}
		for _, e := range byType {
			if t, ok := e["type"].(string); ok {
				if _, isDefault := beatIdx[t]; !isDefault {
					list = append(list, e)
				}
			}
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
	if s, err := a.resolveSlug(slug); err == nil {
		slug = s
	}
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

// loadComponentManifest reads an act's existing components.json (may be empty).
func (a *App) loadComponentManifest(slug string, act Act) []map[string]any {
	b, err := a.store.Read(slug, act.Slug+"/components/components.json")
	if err != nil {
		return nil
	}
	var list []map[string]any
	if json.Unmarshal(b, &list) != nil {
		return nil
	}
	return list
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
