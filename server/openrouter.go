package main

import (
	"bytes"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"sync"
	"time"
)

type orMessage struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

// orClient wraps OpenRouter with multi-key rotation so an expired/limited
// token can fall through to the next one.
type orClient struct {
	keys                 []string
	textModel            string
	imageModel           string
	storyboardImageModel string
	base                 string
	mu                   sync.Mutex
	idx                  int
}

func newORClient(keys []string, textModel, imageModel, storyboardImageModel, base string) *orClient {
	if storyboardImageModel == "" {
		storyboardImageModel = imageModel
	}
	return &orClient{keys: keys, textModel: textModel, imageModel: imageModel, storyboardImageModel: storyboardImageModel, base: base}
}

// storyboardImageModel returns the model used for the storyboard image step.
func (a *App) storyboardImageModel() string {
	if a.or != nil && a.or.storyboardImageModel != "" {
		return a.or.storyboardImageModel
	}
	if a.or != nil {
		return a.or.imageModel
	}
	return a.cfg.OpenRouterImageModel
}

func (c *orClient) nextKey() string {
	c.mu.Lock()
	defer c.mu.Unlock()
	if len(c.keys) == 0 {
		return ""
	}
	k := c.keys[c.idx%len(c.keys)]
	c.idx++
	return k
}

// call posts to chat/completions, rotating keys on 401/402/429 (token
// invalid/expired or usage limit reached) and returning the parsed JSON.
func (c *orClient) call(payload map[string]any) (map[string]any, error) {
	if len(c.keys) == 0 {
		return nil, fmt.Errorf("OPENROUTER_API_KEY not set (token may be expired or missing)")
	}
	var lastErr error
	for i := 0; i < len(c.keys); i++ {
		key := c.nextKey()
		body, _ := json.Marshal(payload)
		req, _ := http.NewRequest("POST", c.base+"/chat/completions", bytes.NewReader(body))
		req.Header.Set("Authorization", "Bearer "+key)
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("X-Title", "animation-assistant-fly")
		resp, err := (&http.Client{Timeout: 180 * time.Second}).Do(req)
		if err != nil {
			lastErr = err
			continue
		}
		raw, _ := io.ReadAll(resp.Body)
		resp.Body.Close()
		if resp.StatusCode == 401 || resp.StatusCode == 402 || resp.StatusCode == 429 {
			lastErr = fmt.Errorf("openrouter token rejected (HTTP %d) — likely expired or over its usage limit; rotating key", resp.StatusCode)
			continue
		}
		if resp.StatusCode != http.StatusOK {
			return nil, fmt.Errorf("openrouter %d: %s", resp.StatusCode, truncate(string(raw), 400))
		}
		var parsed map[string]any
		if err := json.Unmarshal(raw, &parsed); err != nil {
			return nil, err
		}
		return parsed, nil
	}
	return nil, lastErr
}

func (a *App) chatText(messages []orMessage) (string, error) {
	res, err := a.or.call(map[string]any{
		"model":       a.or.textModel,
		"messages":    messages,
		"temperature": 0.7,
	})
	if err != nil {
		return "", err
	}
	content, _ := pickContent(res)
	return content, nil
}

func pickContent(obj map[string]any) (string, map[string]any) {
	choices, _ := obj["choices"].([]any)
	if len(choices) == 0 {
		return "", nil
	}
	msg, _ := choices[0].(map[string]any)["message"].(map[string]any)
	if msg == nil {
		return "", nil
	}
	content, _ := msg["content"].(string)
	return content, msg
}

// generateImage returns image bytes (PNG) from the configured image model.
func (a *App) generateImage(prompt string) ([]byte, error) {
	return a.generateImageWith(prompt, a.or.imageModel)
}

// generateImageWith returns image bytes (PNG) from a specific model. The
// storyboard step uses this with the nanobanana image model.
func (a *App) generateImageWith(prompt, model string) ([]byte, error) {
	if model == "" {
		return nil, fmt.Errorf("no image model configured")
	}
	res, err := a.or.call(map[string]any{
		"model":    model,
		"messages": []orMessage{{Role: "user", Content: prompt}},
	})
	if err != nil {
		return nil, err
	}
	_, msg := pickContent(res)
	if msg == nil {
		return nil, fmt.Errorf("image model returned no message")
	}
	if imgs, ok := msg["images"].([]any); ok && len(imgs) > 0 {
		if first, ok := imgs[0].(map[string]any); ok {
			if iu, ok := first["image_url"].(map[string]any); ok {
				if url, ok := iu["url"].(string); ok && url != "" {
					return decodeImageData(url)
				}
			}
		}
	}
	if content, _ := msg["content"].(string); content != "" {
		if u := extractFirstURL(content); u != "" {
			return httpGetBytes(u)
		}
	}
	return nil, fmt.Errorf("image model returned no image data")
}

func decodeImageData(url string) ([]byte, error) {
	if strings.HasPrefix(url, "data:") {
		idx := strings.Index(url, ";base64,")
		if idx < 0 {
			return nil, fmt.Errorf("malformed data URL")
		}
		return base64.StdEncoding.DecodeString(url[idx+len(";base64,"):])
	}
	return httpGetBytes(url)
}

func extractFirstURL(s string) string {
	i := strings.Index(s, "http")
	if i < 0 {
		return ""
	}
	rest := s[i:]
	for k, ch := range rest {
		if ch == ' ' || ch == ')' || ch == '"' || ch == ']' {
			return rest[:k]
		}
	}
	return rest
}

func httpGetBytes(url string) ([]byte, error) {
	resp, err := http.Get(url)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("image download HTTP %d", resp.StatusCode)
	}
	return io.ReadAll(resp.Body)
}

func truncate(s string, n int) string {
	if len(s) <= n {
		return s
	}
	return s[:n] + "..."
}
