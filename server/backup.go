package main

import (
	"archive/zip"
	"fmt"
	"net/http"
	"time"
)

// backupAllProjects streams a zip archive containing all project data
// (JSON metadata + binary files like images and audio).
func (a *App) backupAllProjects(w http.ResponseWriter, r *http.Request) {
	slugs, err := a.store.ListProjects()
	if err != nil {
		writeError(w, r, http.StatusInternalServerError, "backup_failed", fmt.Sprintf("list projects: %v", err))
		return
	}
	if len(slugs) == 0 {
		writeJSON(w, http.StatusOK, map[string]any{"message": "no projects to back up"})
		return
	}

	ts := time.Now().UTC().Format("2006-01-02-150405")
	filename := fmt.Sprintf("animation-assistant-backup-%s.zip", ts)

	w.Header().Set("Content-Type", "application/zip")
	w.Header().Set("Content-Disposition", fmt.Sprintf(`attachment; filename="%s"`, filename))
	w.Header().Set("Cache-Control", "no-store")

	zw := zip.NewWriter(w)
	defer zw.Close()

	var totalFiles int
	for _, slug := range slugs {
		files, err := a.store.List(slug, "")
		if err != nil {
			continue
		}
		for _, relpath := range files {
			data, err := a.store.Read(slug, relpath)
			if err != nil {
				continue
			}
			// entry path: <slug>/<relpath>
			entryPath := slug + "/" + relpath
			fw, err := zw.Create(entryPath)
			if err != nil {
				continue
			}
			if _, err := fw.Write(data); err != nil {
				continue
			}
			totalFiles++
		}
	}

	if totalFiles == 0 {
		writeError(w, r, http.StatusInternalServerError, "backup_empty", "no files could be archived")
		return
	}
}
