package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"
)

type orMessage struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

// chatJSON calls OpenRouter chat completions and returns the message content.
func (a *App) chatJSON(messages []orMessage) (string, error) {
	if a.cfg.OpenRouterKey == "" {
		return "", fmt.Errorf("OPENROUTER_API_KEY not set")
	}
	body, _ := json.Marshal(map[string]any{
		"model":       a.cfg.OpenRouterModel,
		"messages":    messages,
		"temperature": 0.7,
	})
	req, err := http.NewRequest("POST", a.cfg.OpenRouterBase+"/chat/completions", bytes.NewReader(body))
	if err != nil {
		return "", err
	}
	req.Header.Set("Authorization", "Bearer "+a.cfg.OpenRouterKey)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Title", "Animation Assistant")

	client := &http.Client{Timeout: 120 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()
	raw, _ := io.ReadAll(resp.Body)
	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("openrouter %d: %s", resp.StatusCode, truncate(string(raw), 400))
	}
	var parsed struct {
		Choices []struct {
			Message struct {
				Content string `json:"content"`
			} `json:"message"`
		} `json:"choices"`
	}
	if err := json.Unmarshal(raw, &parsed); err != nil {
		return "", err
	}
	if len(parsed.Choices) == 0 {
		return "", fmt.Errorf("openrouter: no choices in response")
	}
	return parsed.Choices[0].Message.Content, nil
}

func truncate(s string, n int) string {
	if len(s) <= n {
		return s
	}
	return s[:n] + "..."
}
