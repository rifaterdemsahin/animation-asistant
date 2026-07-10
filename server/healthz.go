package main

import "net/http"

var buildCommit = "unknown"

func (a *App) healthz(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, map[string]any{
		"ok": true,
		"keys": map[string]int{
			"openrouter_keys": len(a.cfg.OpenRouterKeys),
			"deepseek_keys":   len(a.cfg.DeepSeekKeys),
			"elevenlabs":      boolToInt(a.cfg.ElevenLabsKey != ""),
			"azure":           boolToInt(a.cfg.AzureConnString != ""),
		},
		"storage":                a.store.Name(),
		"text_model":             a.cfg.OpenRouterTextModel,
		"deepseek_model":         a.cfg.DeepSeekModel,
		"deepseek_configured":    a.ds != nil && a.ds.configured(),
		"image_model":            a.cfg.OpenRouterImageModel,
		"storyboard_image_model": a.storyboardImageModel(),
		"started_at":             a.startedAt,
		"commit":                 buildCommit,
	})
}

func boolToInt(b bool) int {
	if b {
		return 1
	}
	return 0
}

// models reports which model each generation step triggers, so the UI can show
// it inline. Mirrors /healthz for the OpenRouter models and adds the audio
// layers (TTS + fal.ai music/SFX).
func (a *App) models(w http.ResponseWriter, r *http.Request) {
	voice := a.cfg.ElevenLabsVoice
	if voice == "" {
		voice = "JBFqnCBsd6RMkjVDRZzb" // George
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"text":             a.cfg.OpenRouterTextModel,
		"image":            a.cfg.OpenRouterImageModel,
		"storyboard_image": a.storyboardImageModel(),
		"deepseek": map[string]any{
			"provider":   "deepseek",
			"model":      a.cfg.DeepSeekModel,
			"configured": a.ds != nil && a.ds.configured(),
		},
		"voiceover": map[string]string{
			"provider": "elevenlabs",
			"model":    a.cfg.ElevenLabsModel,
			"voice":    voice,
		},
		"music": map[string]string{"provider": "fal.ai", "model": FalMusicModel},
		"sfx":   map[string]string{"provider": "fal.ai", "model": FalSFXModel},
	})
}
