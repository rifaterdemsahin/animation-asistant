package main

import (
	"strings"
	"testing"
)

// TestStoryboardVersionsRoundTrip verifies the version manifest is persisted
// and re-read correctly (each generation appends a version; none are lost).
func TestStoryboardVersionsRoundTrip(t *testing.T) {
	app := newTestApp(t)
	p := app.newProject(projectIn{Title: "versioning test"})
	if err := app.saveProject(p); err != nil {
		t.Fatalf("saveProject: %v", err)
	}
	slug := p.Slug

	if v := app.loadStoryboardVersions(slug); len(v) != 0 {
		t.Fatalf("expected empty versions initially, got %d", len(v))
	}

	versions := []storyboardVersion{
		{ID: 1, Act: "act-1", File: "storyboard/storyboard-act-1-01.png", ImagePrompt: "p1", ImageModel: "m", CreatedAt: "2026-07-08T00:00:00Z"},
		{ID: 2, Act: "act-2", File: "storyboard/storyboard-act-2-01.png", ImagePrompt: "p2", ImageModel: "m", CreatedAt: "2026-07-08T00:00:01Z"},
		{ID: 3, Act: "act-3", File: "storyboard/storyboard-act-3-01.png", ImagePrompt: "p3", ImageModel: "m", CreatedAt: "2026-07-08T00:00:02Z"},
	}
	app.saveStoryboardVersions(slug, versions)

	got := app.loadStoryboardVersions(slug)
	if len(got) != 3 {
		t.Fatalf("expected 3 versions, got %d", len(got))
	}
	if got[0].ID != 1 || got[1].Act != "act-2" || got[2].File != "storyboard/storyboard-act-3-01.png" || got[0].ImagePrompt != "p1" {
		t.Fatalf("round-trip mismatch: %+v", got)
	}
}

// TestStoryboardActPromptsDefaults verifies the compiled default storyboard
// prompt has one image prompt per act, each carrying the Q/A/Why + act_script
// placeholders the renderer relies on.
func TestStoryboardActPromptsDefaults(t *testing.T) {
	app := newTestApp(t)
	_, _, actPrompts := app.storyboardTmpl()
	if len(actPrompts) != 3 {
		t.Fatalf("expected 3 act prompts, got %d", len(actPrompts))
	}
	for _, act := range acts {
		p, ok := actPrompts[act.Key]
		if !ok || p == "" {
			t.Fatalf("missing prompt for %s", act.Key)
		}
		for _, ph := range []string{"{{question}}", "{{answer}}", "{{why}}", "{{act_title}}", "{{act_script}}"} {
			if !strings.Contains(p, ph) {
				t.Errorf("%s prompt missing placeholder %s", act.Key, ph)
			}
		}
	}
}
