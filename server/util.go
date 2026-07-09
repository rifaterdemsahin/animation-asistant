package main

import (
	"encoding/json"
	"net/http"
	"sort"
	"strings"
)

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}

func (a *App) browseFiles(w http.ResponseWriter, r *http.Request) {
	p, err := a.resolveProject(r.PathValue("slug"))
	if err != nil {
		writeError(w, r, http.StatusNotFound, "not_found", "project not found")
		return
	}
	slug := p.Slug
	entries, err := a.store.List(slug, "")
	if err != nil {
		writeError(w, r, http.StatusInternalServerError, "storage_error", err.Error())
		return
	}
	type fileInfo struct {
		Path string `json:"path"`
		URL  string `json:"url"`
		Type string `json:"type"`
	}
	var files []fileInfo
	for _, e := range entries {
		if strings.HasSuffix(e, "project.json") || strings.HasPrefix(e, "prompts/") {
			continue
		}
		t := fileType(e)
		files = append(files, fileInfo{
			Path: e,
			URL:  "/api/projects/" + p.ProjectID + "/raw/" + e,
			Type: t,
		})
	}
	sort.Slice(files, func(i, j int) bool { return files[i].Path < files[j].Path })
	writeJSON(w, http.StatusOK, map[string]any{"project_id": p.ProjectID, "slug": slug, "files": files})
}

func fileType(name string) string {
	switch {
	case strings.HasSuffix(name, ".png"), strings.HasSuffix(name, ".jpg"), strings.HasSuffix(name, ".jpeg"):
		return "image"
	case strings.HasSuffix(name, ".mp3"):
		return "audio"
	case strings.HasSuffix(name, ".json"):
		return "json"
	case strings.HasSuffix(name, ".md"):
		return "markdown"
	default:
		return "file"
	}
}
