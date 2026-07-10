package main

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"os"
	"strings"
	"time"
)

// Config holds all runtime configuration loaded from the environment.
type Config struct {
	AdminPassword string
	AuthSecret    string

	// OpenRouter (text + images). Keys may be comma-separated for rotation.
	OpenRouterKeys       []string
	OpenRouterTextModel  string
	OpenRouterImageModel string
	StoryboardImageModel string
	OpenRouterBase       string

	// DeepSeek (alternative text provider for script generation). OpenAI-
	// compatible API; keys may be comma-separated for rotation. Optional —
	// when unset, script generation falls back to OpenRouter.
	DeepSeekKeys  []string
	DeepSeekModel string
	DeepSeekBase  string

	// ElevenLabs TTS
	ElevenLabsKey   string
	ElevenLabsVoice string
	ElevenLabsModel string

	// fal.ai (music + sound effects)
	FalKey string

	AzureConnString       string
	AzureContainer        string
	AzurePromptsContainer string
	WebDir                string
	OtherDir              string
	Port                  string
}

func LoadConfig() *Config {
	c := &Config{
		AdminPassword:         os.Getenv("ADMIN_PASSWORD"),
		AuthSecret:            os.Getenv("AUTH_SECRET"),
		OpenRouterKeys:        splitCSV(os.Getenv("OPENROUTER_API_KEY")),
		OpenRouterTextModel:   getenvDefault("OPENROUTER_TEXT_MODEL", getenvDefault("OPENROUTER_MODEL", "google/gemini-3.5-flash")),
		OpenRouterImageModel:  getenvDefault("OPENROUTER_IMAGE_MODEL", "google/gemini-3-pro-image"),
		StoryboardImageModel:  getenvDefault("STORYBOARD_IMAGE_MODEL", ""),
		OpenRouterBase:        getenvDefault("OPENROUTER_BASE", "https://openrouter.ai/api/v1"),
		DeepSeekKeys:          splitCSV(os.Getenv("DEEPSEEK_API_KEY")),
		DeepSeekModel:         getenvDefault("DEEPSEEK_MODEL", "deepseek-chat"),
		DeepSeekBase:          getenvDefault("DEEPSEEK_BASE", "https://api.deepseek.com"),
		ElevenLabsKey:         os.Getenv("TTS_API_KEY"),
		ElevenLabsVoice:       getenvDefault("TTS_VOICE", "JBFqnCBsd6RMkjVDRZzb"), // George — Warm Storyteller
		ElevenLabsModel:       getenvDefault("TTS_MODEL", "eleven_turbo_v2_5"),    // good rate + quality
		FalKey:                os.Getenv("FAL_KEY"),
		AzureConnString:       os.Getenv("AZURE_STORAGE_CONNECTION_STRING"),
		AzureContainer:        getenvDefault("AZURE_CONTAINER", "projects"),
		AzurePromptsContainer: getenvDefault("AZURE_PROMPTS_CONTAINER", "prompts"),
		WebDir:                getenvDefault("WEB_DIR", "web"),
		OtherDir:              getenvDefault("OTHER_DIR", "other"),
		Port:                  getenvDefault("PORT", "8080"),
	}
	if c.AuthSecret == "" {
		c.AuthSecret = c.AdminPassword
	}
	return c
}

func getenvDefault(k, d string) string {
	if v := os.Getenv(k); v != "" {
		return v
	}
	return d
}

func splitCSV(s string) []string {
	out := []string{}
	for _, part := range strings.Split(s, ",") {
		if t := strings.TrimSpace(part); t != "" {
			out = append(out, t)
		}
	}
	return out
}

// --- HMAC-signed auth cookie token ---

func (c *Config) MakeToken() string {
	payload, _ := json.Marshal(map[string]int64{"exp": time.Now().Add(7 * 24 * time.Hour).Unix()})
	enc := hex.EncodeToString(payload)
	return enc + "." + c.sign(enc)
}

func (c *Config) sign(s string) string {
	mac := hmac.New(sha256.New, []byte(c.AuthSecret))
	mac.Write([]byte(s))
	return hex.EncodeToString(mac.Sum(nil))
}

func (c *Config) ValidToken(tok string) bool {
	if tok == "" {
		return false
	}
	i := strings.LastIndex(tok, ".")
	if i < 0 {
		return false
	}
	enc, sig := tok[:i], tok[i+1:]
	if !hmac.Equal([]byte(c.sign(enc)), []byte(sig)) {
		return false
	}
	raw, err := hex.DecodeString(enc)
	if err != nil {
		return false
	}
	var p map[string]int64
	if err := json.Unmarshal(raw, &p); err != nil {
		return false
	}
	if exp, ok := p["exp"]; ok && time.Now().Unix() > exp {
		return false
	}
	return true
}
