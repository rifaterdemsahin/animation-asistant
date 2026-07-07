package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"
)

// tts calls ElevenLabs text-to-speech and returns MP3 bytes.
func (a *App) tts(text string) ([]byte, error) {
	if a.cfg.ElevenLabsKey == "" {
		return nil, fmt.Errorf("TTS_API_KEY (ElevenLabs) not set")
	}
	voice := a.cfg.ElevenLabsVoice
	if voice == "" {
		voice = "JBFqnCBsd6RMkjVDRZzb"
	}
	body, _ := json.Marshal(map[string]any{
		"text":     text,
		"model_id": a.cfg.ElevenLabsModel,
		"voice_settings": map[string]any{
			"stability":        0.5,
			"similarity_boost": 0.75,
		},
	})
	url := "https://api.elevenlabs.io/v1/text-to-speech/" + voice
	req, _ := http.NewRequest("POST", url, bytes.NewReader(body))
	req.Header.Set("xi-api-key", a.cfg.ElevenLabsKey)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "audio/mpeg")
	resp, err := (&http.Client{Timeout: 120 * time.Second}).Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	data, _ := io.ReadAll(resp.Body)
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("elevenlabs %d: %s", resp.StatusCode, truncate(string(data), 300))
	}
	return data, nil
}
