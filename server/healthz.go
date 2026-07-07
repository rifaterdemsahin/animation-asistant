package main

import "net/http"

func (a *App) healthz(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, map[string]any{
		"ok": true,
		"keys": map[string]int{
			"openrouter_keys": len(a.cfg.OpenRouterKeys),
			"elevenlabs":      boolToInt(a.cfg.ElevenLabsKey != ""),
			"azure":           boolToInt(a.cfg.AzureConnString != ""),
		},
		"storage":     a.store.Name(),
		"text_model":  a.cfg.OpenRouterTextModel,
		"image_model": a.cfg.OpenRouterImageModel,
		"started_at":  a.startedAt,
	})
}

func boolToInt(b bool) int {
	if b {
		return 1
	}
	return 0
}
