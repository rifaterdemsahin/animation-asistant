package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"sync"
	"time"
)

// dsClient wraps the DeepSeek chat-completions API (OpenAI-compatible) with
// multi-key rotation, mirroring orClient's text path. DeepSeek is an optional
// alternative text provider used for script generation and compared against
// OpenRouter. It has no image capability.
type dsClient struct {
	keys  []string
	model string
	base  string
	mu    sync.Mutex
	idx   int
}

func newDSClient(keys []string, model, base string) *dsClient {
	return &dsClient{keys: keys, model: model, base: base}
}

func (c *dsClient) configured() bool { return len(c.keys) > 0 }

func (c *dsClient) nextKey() string {
	c.mu.Lock()
	defer c.mu.Unlock()
	if len(c.keys) == 0 {
		return ""
	}
	k := c.keys[c.idx%len(c.keys)]
	c.idx++
	return k
}

// chat posts to /v1/chat/completions, rotating keys on 401/402/429, and
// returns the assistant message content.
func (c *dsClient) chat(messages []orMessage) (string, error) {
	if !c.configured() {
		return "", fmt.Errorf("DEEPSEEK_API_KEY not set — DeepSeek script generation is disabled (keys may be missing)")
	}
	payload := map[string]any{
		"model":       c.model,
		"messages":    messages,
		"temperature": 0.7,
		// DeepSeek's "json_object" mode keeps the structured script output parseable,
		// matching the contract the rest of the pipeline expects from OpenRouter.
		"response_format": map[string]string{"type": "json_object"},
	}
	var lastErr error
	for i := 0; i < len(c.keys); i++ {
		key := c.nextKey()
		body, _ := json.Marshal(payload)
		req, _ := http.NewRequest("POST", c.base+"/v1/chat/completions", bytes.NewReader(body))
		req.Header.Set("Authorization", "Bearer "+key)
		req.Header.Set("Content-Type", "application/json")
		resp, err := (&http.Client{Timeout: 180 * time.Second}).Do(req)
		if err != nil {
			lastErr = err
			continue
		}
		raw, _ := io.ReadAll(resp.Body)
		resp.Body.Close()
		if resp.StatusCode == 401 || resp.StatusCode == 402 || resp.StatusCode == 429 {
			lastErr = fmt.Errorf("deepseek token rejected (HTTP %d) — likely invalid or over its usage limit; rotating key", resp.StatusCode)
			continue
		}
		if resp.StatusCode != http.StatusOK {
			return "", fmt.Errorf("deepseek %d: %s", resp.StatusCode, truncate(string(raw), 400))
		}
		var parsed map[string]any
		if err := json.Unmarshal(raw, &parsed); err != nil {
			return "", err
		}
		content, _ := pickContent(parsed)
		return content, nil
	}
	return "", lastErr
}

// chatTextProvider routes a text chat to the requested provider. Unknown or
// unconfigured providers fall back to OpenRouter so callers always get a result
// when at least one provider is available.
func (a *App) chatTextProvider(messages []orMessage, provider string) (string, error) {
	if provider == "deepseek" && a.ds != nil && a.ds.configured() {
		return a.ds.chat(messages)
	}
	return a.chatText(messages)
}

// scriptProviderModel returns the human-readable model id for a provider.
func (a *App) scriptProviderModel(provider string) string {
	if provider == "deepseek" && a.ds != nil {
		return a.ds.model
	}
	return scriptModelName(a)
}
