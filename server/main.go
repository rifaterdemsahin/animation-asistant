package main

import (
	"log"
	"net/http"
	"time"

	"animation-assistant/server/storage"
)

func main() {
	cfg := LoadConfig()
	store, err := storage.New(cfg.OtherDir, cfg.AzureConnString, cfg.AzureContainer)
	if err != nil {
		log.Fatalf("storage init: %v", err)
	}
	app := &App{
		cfg:       cfg,
		store:     store,
		or:        newORClient(cfg.OpenRouterKeys, cfg.OpenRouterTextModel, cfg.OpenRouterImageModel, cfg.OpenRouterBase),
		startedAt: time.Now().UTC().Format(time.RFC3339),
	}

	if cfg.AdminPassword == "" {
		log.Print("WARNING: ADMIN_PASSWORD not set — login disabled effectively")
	}
	if len(cfg.OpenRouterKeys) == 0 {
		log.Print("WARNING: OPENROUTER_API_KEY not set")
	}
	if cfg.AzureConnString != "" {
		log.Printf("Azure storage enabled (container=%s)", cfg.AzureContainer)
	} else {
		log.Printf("WARNING: using local storage at %s (Azure not configured)", cfg.OtherDir)
	}
	log.Printf("listening on :%s (text=%s image=%s tts=%s)",
		cfg.Port, cfg.OpenRouterTextModel, cfg.OpenRouterImageModel, onOff(cfg.ElevenLabsKey != ""))
	if err := http.ListenAndServe(":"+cfg.Port, app.routes()); err != nil {
		log.Fatal(err)
	}
}

func onOff(b bool) string {
	if b {
		return "on"
	}
	return "off"
}
