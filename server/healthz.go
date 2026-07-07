package main

import "net/http"

func (a *App) healthz(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, map[string]any{
		"ok": true,
		"keys": map[string]bool{
			"openrouter": a.cfg.OpenRouterKey != "",
			"azure":      a.cfg.AzureConnString != "",
		},
		"storage": a.store.Name(),
	})
}
