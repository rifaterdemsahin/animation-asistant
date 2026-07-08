package main

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
)

// storyboardReq is the optional body posted by the Storyboard page. It carries
// the 3 pedagogical inputs (question/answer/why) and an edited image prompt.
type storyboardReq struct {
	ImagePrompt string `json:"image_prompt"`
	Question    string `json:"question"`
	Answer      string `json:"answer"`
	Why         string `json:"why"`
}

// storyboardVersion is one saved storyboard image. Generations are versioned
// (storyboard-NNN.png) and never overwrite a previous image.
type storyboardVersion struct {
	ID          int    `json:"id"`
	File        string `json:"file"`
	ImagePrompt string `json:"image_prompt"`
	ImageModel  string `json:"image_model"`
	CreatedAt   string `json:"created_at"`
}

type storyboardVersions struct {
	Versions []storyboardVersion `json:"versions"`
}

func (a *App) generateStoryboard(w http.ResponseWriter, r *http.Request) {
	slug := r.PathValue("slug")
	p, err := a.loadProject(slug)
	if err != nil {
		http.Error(w, "not found", http.StatusNotFound)
		return
	}

	// Optional body: edited image prompt + Q&A overrides from the Storyboard UI.
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

	// Image prompt: use the edited one from the UI if provided, else render the
	// storyboard image_prompt template (from the Azure prompts store) with the
	// project's question/answer/why.
	pngPrompt := strings.TrimSpace(req.ImagePrompt)
	if pngPrompt == "" {
		pngPrompt = renderTmpl(imgTmpl, map[string]string{
			"topic":    p.Topic,
			"question": p.Question,
			"answer":   p.Answer,
			"why":      p.Why,
		})
	}

	// Generate the image and save it as a NEW versioned file (never overwrite).
	imageModel := a.storyboardImageModel()
	versions := a.loadStoryboardVersions(slug)
	var latest storyboardVersion
	var imageErr string
	if png, gerr := a.generateImageWith(pngPrompt, imageModel); gerr == nil {
		nextID := 1
		for _, v := range versions {
			if v.ID >= nextID {
				nextID = v.ID + 1
			}
		}
		file := fmt.Sprintf("storyboard/storyboard-%03d.png", nextID)
		if werr := a.store.Write(slug, file, png); werr == nil {
			latest = storyboardVersion{
				ID:          nextID,
				File:        file,
				ImagePrompt: pngPrompt,
				ImageModel:  imageModel,
				CreatedAt:   time.Now().UTC().Format(time.RFC3339),
			}
			versions = append(versions, latest)
			a.saveStoryboardVersions(slug, versions)
		} else {
			imageErr = "storage write failed: " + werr.Error()
		}
	} else {
		imageErr = gerr.Error()
	}
	if latest.File == "" && len(versions) > 0 {
		latest = versions[len(versions)-1]
	}

	p.Status = "storyboard"
	_ = a.saveProject(p)
	writeJSON(w, http.StatusOK, map[string]any{
		"ok":           true,
		"storyboard":   obj,
		"versions":     versions,
		"image_prompt": latest.ImagePrompt,
		"image_model":  latest.ImageModel,
		"image_error":  imageErr,
	})
}

func (a *App) getStoryboard(w http.ResponseWriter, r *http.Request) {
	slug := r.PathValue("slug")
	versions := a.loadStoryboardVersions(slug)
	// Legacy fallback: projects generated before versioning had a single
	// storyboard.png (and optionally image_prompt.txt).
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

	var latest storyboardVersion
	if len(versions) > 0 {
		latest = versions[len(versions)-1]
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"storyboard":   scenes,
		"versions":     versions,
		"image_prompt": latest.ImagePrompt,
		"image_model":  latest.ImageModel,
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
