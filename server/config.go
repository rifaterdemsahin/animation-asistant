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
	AdminPassword   string
	AuthSecret      string
	OpenRouterKey   string
	OpenRouterModel string
	OpenRouterBase  string
	AzureConnString string
	AzureContainer  string
	WebDir          string
	OtherDir        string
	Port            string
}

func LoadConfig() *Config {
	c := &Config{
		AdminPassword:   os.Getenv("ADMIN_PASSWORD"),
		AuthSecret:      os.Getenv("AUTH_SECRET"),
		OpenRouterKey:   os.Getenv("OPENROUTER_API_KEY"),
		OpenRouterModel: getenvDefault("OPENROUTER_MODEL", "google/gemini-2.5-flash"),
		OpenRouterBase:  getenvDefault("OPENROUTER_BASE", "https://openrouter.ai/api/v1"),
		AzureConnString: os.Getenv("AZURE_STORAGE_CONNECTION_STRING"),
		AzureContainer:  getenvDefault("AZURE_CONTAINER", "projects"),
		WebDir:          getenvDefault("WEB_DIR", "web"),
		OtherDir:        getenvDefault("OTHER_DIR", "other"),
		Port:            getenvDefault("PORT", "8080"),
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

// --- HMAC-signed auth cookie token ---

// MakeToken returns "<payloadHex>.<sig>" valid for 7 days.
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
