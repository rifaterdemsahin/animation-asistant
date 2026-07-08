package main

import "testing"

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
		{ID: 1, File: "storyboard/storyboard-001.png", ImagePrompt: "p1", ImageModel: "m", CreatedAt: "2026-07-08T00:00:00Z"},
		{ID: 2, File: "storyboard/storyboard-002.png", ImagePrompt: "p2", ImageModel: "m", CreatedAt: "2026-07-08T00:00:01Z"},
	}
	app.saveStoryboardVersions(slug, versions)

	got := app.loadStoryboardVersions(slug)
	if len(got) != 2 {
		t.Fatalf("expected 2 versions, got %d", len(got))
	}
	if got[0].ID != 1 || got[1].ID != 2 || got[1].File != "storyboard/storyboard-002.png" || got[0].ImagePrompt != "p1" {
		t.Fatalf("round-trip mismatch: %+v", got)
	}
}
