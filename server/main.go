package main

import (
	"log"
	"net/http"

	"animation-assistant/server/storage"
)

func main() {
	cfg := LoadConfig()
	store, err := storage.New(cfg.OtherDir, cfg.AzureConnString, cfg.AzureContainer)
	if err != nil {
		log.Fatalf("storage init: %v", err)
	}
	app := &App{cfg: cfg, store: store}

	if cfg.AdminPassword == "" || cfg.AdminPassword == "changeme" {
		log.Printf("WARNING: ADMIN_PASSWORD is default/empty — set a real one in .env")
	}
	if cfg.AzureConnString == "" {
		log.Printf("WARNING: using local storage at %s (Azure not configured)", cfg.OtherDir)
	}

	mux := app.routes()
	log.Printf("Animation Assistant listening on :%s (web=%s other=%s)", cfg.Port, cfg.WebDir, cfg.OtherDir)
	if err := http.ListenAndServe(":"+cfg.Port, mux); err != nil {
		log.Fatal(err)
	}
}
