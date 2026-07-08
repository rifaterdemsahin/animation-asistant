package main

import (
	"encoding/json"
	"strings"
	"testing"
)

// TestMigrateStoryboardPrompt verifies the boot-time migration upgrades a
// legacy seeded storyboard prompt to the new default, while preserving any
// prompt the user has edited.
func TestMigrateStoryboardPrompt(t *testing.T) {
	dir := t.TempDir()
	s, err := NewPromptStore(dir, "", "prompts")
	if err != nil {
		t.Fatalf("NewPromptStore: %v", err)
	}

	// 1. A legacy 4-frame prompt must be upgraded to the new detailed template.
	legacy := storyboardPrompt{
		System:      "old system",
		User:        "old user",
		ImagePrompt: "A 4-frame storyboard infographic for a 3-act explainer video about: {{topic}}.",
	}
	lb, _ := json.Marshal(legacy)
	if err := s.Write("storyboard", string(lb)); err != nil {
		t.Fatalf("write legacy: %v", err)
	}
	migrateStoryboardPrompt(s)

	raw, err := s.Read("storyboard")
	if err != nil {
		t.Fatalf("read after migrate: %v", err)
	}
	var got storyboardPrompt
	if err := json.Unmarshal([]byte(raw), &got); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	if !strings.Contains(got.ImagePrompt, "expert AI instructional designer") {
		t.Errorf("legacy prompt was not upgraded; image_prompt starts: %q", trunc(got.ImagePrompt, 80))
	}
	for _, ph := range []string{"{{question}}", "{{answer}}", "{{why}}"} {
		if !strings.Contains(got.ImagePrompt, ph) {
			t.Errorf("upgraded prompt missing placeholder %s", ph)
		}
	}

	// 2. A custom/edited prompt (no legacy marker) must be left untouched.
	custom := storyboardPrompt{
		System:      "custom system",
		User:        "custom user",
		ImagePrompt: "My totally custom image prompt with no legacy marker.",
	}
	cb, _ := json.Marshal(custom)
	if err := s.Write("storyboard", string(cb)); err != nil {
		t.Fatalf("write custom: %v", err)
	}
	migrateStoryboardPrompt(s)

	raw2, _ := s.Read("storyboard")
	var got2 storyboardPrompt
	if err := json.Unmarshal([]byte(raw2), &got2); err != nil {
		t.Fatalf("unmarshal custom: %v", err)
	}
	if got2.ImagePrompt != custom.ImagePrompt {
		t.Errorf("custom prompt was modified by migration; got: %q", trunc(got2.ImagePrompt, 80))
	}
}

func trunc(s string, n int) string {
	if len(s) <= n {
		return s
	}
	return s[:n] + "..."
}
