package main

import (
	"encoding/json"
	"strings"
	"testing"
)

// TestMigrateStoryboardPrompt verifies the boot-time migration upgrades a
// legacy storyboard prompt (single image_prompt, one combined image) to the
// new per-act structure (act_prompts with 3 entries), while preserving any
// prompt the user has already edited to the new shape.
func TestMigrateStoryboardPrompt(t *testing.T) {
	dir := t.TempDir()
	s, err := NewPromptStore(dir, "", "prompts")
	if err != nil {
		t.Fatalf("NewPromptStore: %v", err)
	}

	// 1. A legacy single-image_prompt prompt must be upgraded to per-act.
	lb, _ := json.Marshal(map[string]any{
		"system":       "old system",
		"user":         "old user",
		"image_prompt": "A 4-frame storyboard infographic for a 3-act explainer video about: {{topic}}.",
	})
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
	if len(got.ActPrompts) != 3 {
		t.Fatalf("expected 3 act_prompts after migrate, got %d", len(got.ActPrompts))
	}
	for _, act := range []string{"act-1", "act-2", "act-3"} {
		p, ok := got.ActPrompts[act]
		if !ok || !strings.Contains(p, "expert AI instructional designer") {
			t.Errorf("act %s prompt not upgraded; starts: %q", act, trunc(p, 80))
		}
		if !strings.Contains(got.ActPrompts[act], "{{question}}") || !strings.Contains(got.ActPrompts[act], "{{answer}}") || !strings.Contains(got.ActPrompts[act], "{{why}}") {
			t.Errorf("act %s upgraded prompt missing Q/A/Why placeholders", act)
		}
		if !strings.Contains(got.ActPrompts[act], "{{act_script}}") {
			t.Errorf("act %s upgraded prompt missing {{act_script}} placeholder", act)
		}
	}

	// 2. A custom prompt already in the new per-act shape must be left untouched.
	custom := storyboardPrompt{
		System: "custom system",
		User:   "custom user",
		ActPrompts: map[string]string{
			"act-1": "My totally custom act-1 image prompt.",
			"act-2": "My totally custom act-2 image prompt.",
			"act-3": "My totally custom act-3 image prompt.",
		},
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
	if got2.ActPrompts["act-1"] != custom.ActPrompts["act-1"] {
		t.Errorf("custom act-1 prompt was modified by migration; got: %q", trunc(got2.ActPrompts["act-1"], 80))
	}
}

func trunc(s string, n int) string {
	if len(s) <= n {
		return s
	}
	return s[:n] + "..."
}
