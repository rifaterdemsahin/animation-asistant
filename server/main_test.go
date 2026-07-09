package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"strings"
	"testing"

	"animation-assistant/server/storage"
)

func newTestApp(t *testing.T) *App {
	t.Helper()
	dir := t.TempDir()
	cfg := &Config{
		AdminPassword:        "testpass",
		AuthSecret:           "testpass",
		OpenRouterKeys:       []string{},
		OpenRouterTextModel:  "google/gemini-3.5-flash",
		OpenRouterImageModel: "google/gemini-3-pro-image",
		OpenRouterBase:       "https://openrouter.ai/api/v1",
		WebDir:               filepath.Join("..", "web"),
		OtherDir:             dir,
		Port:                 "0",
	}
	store, err := storage.New(dir, "", "")
	if err != nil {
		t.Fatalf("storage.New: %v", err)
	}
	return &App{cfg: cfg, store: store, or: newORClient(cfg.OpenRouterKeys, cfg.OpenRouterTextModel, cfg.OpenRouterImageModel, cfg.StoryboardImageModel, cfg.OpenRouterBase)}
}

func authCookie(cfg *Config) *http.Cookie {
	return &http.Cookie{Name: "auth", Value: cfg.MakeToken()}
}

func TestPageRoutes(t *testing.T) {
	app := newTestApp(t)
	srv := httptest.NewServer(app.routes())
	defer srv.Close()

	tests := []struct {
		path    string
		want    int
		authed  bool
		content string
	}{
		{"/", 200, false, "<!doctype html>"},
		{"/healthz", 200, false, `"ok"`},
		{"/pages/login.html", 200, false, "Admin login"},
		{"/pages/projects.html", 200, false, "Projects"},
		{"/pages/media-manager.html", 200, false, "Media Manager"},
		{"/api/me", 401, false, ""},
		{"/api/me", 200, true, `"ok"`},
		{"/api/projects", 401, false, ""},
		{"/api/projects", 200, true, `"projects"`},
		{"/api/errors", 200, false, `"errors"`},
	}

	for _, tc := range tests {
		t.Run(fmt.Sprintf("%s-auth=%v", tc.path, tc.authed), func(t *testing.T) {
			req, _ := http.NewRequest("GET", srv.URL+tc.path, nil)
			if tc.authed {
				req.AddCookie(authCookie(app.cfg))
			}
			resp, err := http.DefaultClient.Do(req)
			if err != nil {
				t.Fatalf("request failed: %v", err)
			}
			defer resp.Body.Close()
			if resp.StatusCode != tc.want {
				t.Errorf("GET %s: want %d, got %d", tc.path, tc.want, resp.StatusCode)
			}
			if tc.content != "" {
				body, _ := io.ReadAll(resp.Body)
				if !strings.Contains(string(body), tc.content) {
					t.Errorf("GET %s: body missing %q", tc.path, tc.content)
				}
			}
		})
	}
}

func TestHealthzContent(t *testing.T) {
	app := newTestApp(t)
	srv := httptest.NewServer(app.routes())
	defer srv.Close()

	resp, err := http.Get(srv.URL + "/healthz")
	if err != nil {
		t.Fatal(err)
	}
	defer resp.Body.Close()

	var v map[string]any
	if err := json.NewDecoder(resp.Body).Decode(&v); err != nil {
		t.Fatal(err)
	}
	if v["ok"] != true {
		t.Error("healthz ok != true")
	}
	st := fmt.Sprint(v["storage"])
	if !strings.HasPrefix(st, "local:") {
		t.Errorf("storage = %v, want prefix local:", v["storage"])
	}
}

func TestLoginFlow(t *testing.T) {
	app := newTestApp(t)
	srv := httptest.NewServer(app.routes())
	defer srv.Close()

	body, _ := json.Marshal(map[string]string{"password": "wrong"})
	resp, err := http.Post(srv.URL+"/api/login", "application/json", bytes.NewReader(body))
	if err != nil {
		t.Fatal(err)
	}
	if resp.StatusCode != 401 {
		t.Errorf("wrong password: want 401, got %d", resp.StatusCode)
	}
	resp.Body.Close()

	body, _ = json.Marshal(map[string]string{"password": "testpass"})
	resp, err = http.Post(srv.URL+"/api/login", "application/json", bytes.NewReader(body))
	if err != nil {
		t.Fatal(err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != 200 {
		t.Errorf("correct password: want 200, got %d", resp.StatusCode)
	}
	cookies := resp.Cookies()
	found := false
	for _, c := range cookies {
		if c.Name == "auth" && c.Value != "" {
			found = true
		}
	}
	if !found {
		t.Error("no auth cookie set on login")
	}
}

func TestProjectCRUD(t *testing.T) {
	app := newTestApp(t)
	srv := httptest.NewServer(app.routes())
	defer srv.Close()

	client := &http.Client{}
	cookie := authCookie(app.cfg)

	body, _ := json.Marshal(map[string]string{
		"title": "Test Project", "topic": "Testing", "component_type": "explainer",
	})
	req, _ := http.NewRequest("POST", srv.URL+"/api/projects", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	req.AddCookie(cookie)
	resp, err := client.Do(req)
	if err != nil {
		t.Fatal(err)
	}
	if resp.StatusCode != 201 {
		raw, _ := io.ReadAll(resp.Body)
		t.Fatalf("create: want 201, got %d: %s", resp.StatusCode, string(raw))
	}
	var p Project
	if err := json.NewDecoder(resp.Body).Decode(&p); err != nil {
		t.Fatal(err)
	}
	resp.Body.Close()
	if p.Slug != "test-project" {
		t.Errorf("slug = %q, want test-project", p.Slug)
	}
	if len(p.Acts) != 3 {
		t.Errorf("acts = %d, want 3", len(p.Acts))
	}

	req, _ = http.NewRequest("GET", srv.URL+"/api/projects/"+p.Slug, nil)
	req.AddCookie(cookie)
	resp, _ = client.Do(req)
	if resp.StatusCode != 200 {
		t.Errorf("get: want 200, got %d", resp.StatusCode)
	}
	resp.Body.Close()

	req, _ = http.NewRequest("DELETE", srv.URL+"/api/projects/"+p.Slug, nil)
	req.AddCookie(cookie)
	resp, _ = client.Do(req)
	if resp.StatusCode != 200 {
		t.Errorf("delete: want 200, got %d", resp.StatusCode)
	}
	resp.Body.Close()

	req, _ = http.NewRequest("GET", srv.URL+"/api/projects/"+p.Slug, nil)
	req.AddCookie(cookie)
	resp, _ = client.Do(req)
	if resp.StatusCode != 404 {
		t.Errorf("get after delete: want 404, got %d", resp.StatusCode)
	}
	resp.Body.Close()
}

func TestErrorsEndpoint(t *testing.T) {
	app := newTestApp(t)
	srv := httptest.NewServer(app.routes())
	defer srv.Close()

	req, _ := http.NewRequest("GET", srv.URL+"/api/projects", nil)
	req.AddCookie(authCookie(app.cfg))

	req.URL.Path = "/api/projects/nonexistent"
	resp, err := http.DefaultClient.Get(srv.URL + "/api/projects/nonexistent")
	if err == nil {
		resp.Body.Close()
	}

	resp, err = http.Get(srv.URL + "/api/errors")
	if err != nil {
		t.Fatal(err)
	}
	defer resp.Body.Close()
	var v map[string]any
	if err := json.NewDecoder(resp.Body).Decode(&v); err != nil {
		t.Fatal(err)
	}
	if errs, ok := v["errors"]; !ok || errs == nil {
		t.Error("errors key missing or nil")
	}
}

func TestSlugify(t *testing.T) {
	tests := []struct{ in, want string }{
		{"Why Sleep Matters", "why-sleep-matters"},
		{"  Hello World  ", "hello-world"},
		{"Test--Project", "test--project"},
		{"___", "project"},
		{"123abc", "123abc"},
		{"AI & ML Basics", "ai--ml-basics"},
	}
	for _, tc := range tests {
		t.Run(tc.in, func(t *testing.T) {
			got := slugify(tc.in)
			if got != tc.want {
				t.Errorf("slugify(%q) = %q, want %q", tc.in, got, tc.want)
			}
		})
	}
}
