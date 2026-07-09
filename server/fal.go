package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"
)

type falReq struct {
	Prompt string `json:"prompt"`
}

type falResponse struct {
	RequestID string `json:"request_id"`
	Status    string `json:"status"`
	ResultURL string `json:"result_url"`
	Audio     struct {
		URL string `json:"url"`
	} `json:"audio"`
}

// fal.ai model ids used for the two audio layers. Exposed via GET /api/models so
// the UI can show which model each step triggers.
const (
	FalMusicModel = "fal-ai/mmaudio-v2"
	FalSFXModel   = "fal-ai/stable-audio"
)

func (a *App) falMusic(prompt string) ([]byte, error) {
	return a.falCall(FalMusicModel, prompt)
}

func (a *App) falSFX(prompt string) ([]byte, error) {
	return a.falCall(FalSFXModel, prompt)
}

func (a *App) falCall(model, prompt string) ([]byte, error) {
	if a.cfg.FalKey == "" {
		return nil, fmt.Errorf("FAL_KEY not set")
	}
	body, _ := json.Marshal(falReq{Prompt: prompt})
	url := "https://fal.run/" + model
	req, _ := http.NewRequest("POST", url, bytes.NewReader(body))
	req.Header.Set("Authorization", "Key "+a.cfg.FalKey)
	req.Header.Set("Content-Type", "application/json")
	client := &http.Client{Timeout: 300 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("fal.ai %s: %w", model, err)
	}
	defer resp.Body.Close()
	raw, _ := io.ReadAll(resp.Body)
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("fal.ai %s %d: %s", model, resp.StatusCode, truncate(string(raw), 400))
	}
	var r falResponse
	if err := json.Unmarshal(raw, &r); err != nil {
		return nil, fmt.Errorf("fal.ai %s: parse error: %w", model, err)
	}
	if r.Audio.URL != "" {
		return httpGetBytes(r.Audio.URL)
	}
	if r.ResultURL != "" {
		return httpGetBytes(r.ResultURL)
	}
	return nil, fmt.Errorf("fal.ai %s: no audio URL in response", model)
}
