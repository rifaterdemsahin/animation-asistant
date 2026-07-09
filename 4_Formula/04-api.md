# 04 — API Reference

Base URL: `http://localhost:8080` (local) or `https://animation-assistant.fly.dev` (production).

All error responses follow the format:
```json
{"error": true, "code": "error_code", "message": "human-readable", "timestamp": "2026-07-09T10:20:27Z"}
```

## Authentication

### POST /api/login
```json
// Request
{"password": "admin-password"}

// Response 200
{"ok": true}
// Sets cookie: auth=<HMAC-token>; HttpOnly; SameSite=Lax; Max-Age=604800

// Response 401
{"error": true, "code": "auth", "message": "invalid password"}
```

### POST /api/logout
```json
// Response 200
{"ok": true}
// Clears auth cookie
```

### GET /api/me
```json
// Response 200 (authenticated)
{"ok": true}

// Response 401 (not authenticated — no body, HTTP status)
```

---

## Projects

### GET /api/projects
List all projects with their metadata.
```json
// Response 200
{
  "projects": [
    {
      "slug": "my-animation",
      "title": "My Animation",
      "topic": "...",
      "component_type": "explainer",
      "status": "storyboard",
      "created_at": "...",
      "updated_at": "...",
      "acts": {
        "act-1": {"role": "problem", "outline": "done", "script": "done", "components": "done", "audio": "done"},
        "act-2": {"role": "solution", "outline": "done", "script": "done", "components": "done", "audio": "done"},
        "act-3": {"role": "lesson", "outline": "done", "script": "done", "components": "done", "audio": "done"}
      }
    }
  ]
}
```

### POST /api/projects
Create a new project.
```json
// Request
{
  "title": "My Animation",
  "topic": "How does machine learning work?",
  "component_type": "explainer",
  "question": "The problem...",
  "answer": "The solution...",
  "why": "This matters because..."
}

// Response 200
{"ok": true, "slug": "my-animation"}
```

### GET /api/projects/{slug}
Get single project metadata. Same shape as list item.

### PUT /api/projects/{slug}
Update project fields (title, topic, component_type, question, answer, why, canva_url).

### DELETE /api/projects/{slug}
Delete project and all its files.
```json
// Response 200
{"ok": true}
```

---

## Pipeline Generation

### POST /api/projects/{slug}/outline
Generate project-level 3-act outline via OpenRouter.
```json
// Request (optional)
{"force": true}

// Response 200
{
  "ok": true,
  "outline": {
    "acts": {
      "act-1": {"summary": "Sets up the world and problem...", "title": "..."},
      "act-2": {"summary": "Introduces the solution...", "title": "..."},
      "act-3": {"summary": "The key takeaway is...", "title": "..."}
    }
  }
}
```

### GET /api/projects/{slug}/outline
Get the saved outline.
```json
// Response 200
{"outline": {"acts": {...}}}  // null if not yet generated
```

### POST /api/projects/{slug}/script
Generate per-act scripts via OpenRouter.
```json
// Request
{
  "acts": ["act-1", "act-2", "act-3"],  // optional, defaults to all 3
  "question": "optional override",
  "answer": "optional override",
  "why": "optional override"
}

// Response 200
{"ok": true, "acts": ["act-1", "act-2", "act-3"]}

// Per-act output stored at:
//   <act-slug>/script/act.md      (markdown)
//   <act-slug>/script/beats.json  (structured: {narration, beats[{id, text}]})
```

### GET /api/projects/{slug}/script
Get all generated act scripts.
```json
// Response 200
{
  "acts": {
    "act-1": "# Act 1 — Problem\n\n**Role:** problem\n\n## Narration\n\n...",
    "act-2": "...",
    "act-3": "..."
  }
}
```

### POST /api/projects/{slug}/components
Generate typed component images per act via OpenRouter image model.
```json
// Request
{
  "acts": ["act-1"],                           // optional, defaults to all 3
  "types": ["background", "lower-third", "infographic"]  // optional, defaults from template
}

// Response 200
{
  "ok": true,
  "manifest": {
    "act-1": [
      {"id": "my-animation-background-01", "type": "background", "prompt": "...", "file": "act-1-problem/components/my-animation-background-01.png", "script_ref": "beat-1"},
      {"id": "my-animation-lower-third-01", "type": "lower-third", "prompt": "...", "file": "act-1-problem/components/my-animation-lower-third-01.png", "script_ref": "beat-2"},
      ...
    ]
  }
}
```

### GET /api/projects/{slug}/components
Get all component manifests.
```json
// Response 200
{
  "acts": {
    "act-1": [{"id": "...", "type": "background", "prompt": "...", "file": "...", "script_ref": "..."}],
    "act-2": [...],
    "act-3": [...]
  }
}
```

### POST /api/projects/{slug}/audio
Generate TTS voiceover per act via ElevenLabs.
```json
// Request
{"acts": ["act-1", "act-2"]}  // optional, defaults to all 3

// Response 200
{"ok": true, "audio": {"act-1": "act-1-problem/audio/narration.mp3", "act-2": "..."}}
```

### GET /api/projects/{slug}/audio
Get generated audio status.
```json
// Response 200
{"audio": {"act-1": "act-1-problem/audio/narration.mp3", ...}}
```

### POST /api/projects/{slug}/audio/music
Generate background music per act via fal.ai.
```json
// Request
{
  "acts": ["act-1"],
  "genre": "cinematic",     // optional, defaults from template
  "mood": "suspenseful"     // optional, defaults from template
}

// Response 200
{"ok": true, "music": {"act-1": "act-1-problem/audio/music.mp3"}}
```

### GET /api/projects/{slug}/audio/music
Get music status.
```json
// Response 200
{"music": {"act-1": "act-1-problem/audio/music.mp3", ...}}
```

### POST /api/projects/{slug}/audio/sfx
Generate sound effects per act via fal.ai (3 preset SFX types per act).
```json
// Request
{"acts": ["act-1"]}  // optional, defaults to all 3

// Response 200
{
  "ok": true,
  "sfx": {
    "act-1": [
      {"name": "whoosh", "file": "act-1-problem/audio/sfx-whoosh-01.mp3", "type": "sound_effect"},
      {"name": "ding", "file": "act-1-problem/audio/sfx-ding-02.mp3", "type": "sound_effect"},
      {"name": "reveal", "file": "act-1-problem/audio/sfx-reveal-03.mp3", "type": "sound_effect"}
    ]
  }
}
```

### GET /api/projects/{slug}/audio/sfx
Get SFX status.
```json
// Response 200
{"sfx": {"act-1": ["act-1-problem/audio/sfx-whoosh-01.mp3", ...], ...}}
```

### POST /api/projects/{slug}/storyboard
Generate storyboard: JSON scene plan + per-act images (3 in parallel).
```json
// Request
{
  "act_prompts": {           // optional overrides for per-act image prompts
    "act-1": "Custom image prompt for act 1...",
    "act-2": "...",
    "act-3": "..."
  },
  "question": "optional Q&A override",
  "answer": "optional Q&A override",
  "why": "optional Q&A override"
}

// Response 200
{
  "ok": true,
  "storyboard": {"scenes": [...]},       // JSON scene plan
  "versions": [                           // Per-act generated images
    {"id": 1, "act": "act-1", "file": "storyboard/storyboard-act-1-01.png", "image_prompt": "...", "image_model": "...", "created_at": "..."},
    {"id": 2, "act": "act-2", "file": "storyboard/storyboard-act-2-01.png", "image_prompt": "...", "image_model": "...", "created_at": "..."},
    {"id": 3, "act": "act-3", "file": "storyboard/storyboard-act-3-01.png", "image_prompt": "...", "image_model": "...", "created_at": "..."}
  ],
  "act_prompts": {                        // Latest prompts per act (for UI prefill)
    "act-1": "The rendered prompt...",
    "act-2": "...",
    "act-3": "..."
  },
  "image_model": "google/gemini-3-pro-image",
  "image_errors": [],
  "image_error": ""
}
```

### GET /api/projects/{slug}/storyboard
Get storyboard state including version history.
```json
// Response 200
{
  "storyboard": {scene data},           // null if not generated
  "versions": [version history],
  "act_prompts": {"act-1": "...", ...}, // Latest prompt per act
  "image_model": "google/gemini-3-pro-image"
}
```

---

## Asset Serving

### GET /api/projects/{slug}/browse
List all files in the project.
```json
// Response 200
{"files": ["project.json", "outline.json", "act-1-problem/script/act.md", ...]}
```

### GET /api/projects/{slug}/raw/{path...}
Stream a raw asset (image or audio) from storage.
```
GET /api/projects/my-animation/raw/act-1-problem/components/my-animation-background-01.png
→ Response: image/png binary

GET /api/projects/my-animation/raw/act-1-problem/audio/narration.mp3
→ Response: audio/mpeg binary
```

Content-Type detection: `.png` → `image/png`, `.jpg/.jpeg` → `image/jpeg`, `.mp3` → `audio/mpeg`, `.json` → `application/json`.

---

## Prompt Templates

### GET /api/prompts
List all prompt templates.
```json
// Response 200
[
  {"id": "outline_system", "content": "You are a script writer...", "category": "outline"},
  {"id": "outline_user", "content": "Generate a 3-act outline for {{topic}}...", "category": "outline"},
  {"id": "script_system", "content": "...", "category": "script"},
  ...
]
```

### GET /api/prompts/{id}
Get single prompt template.

### PUT /api/prompts/{id}
Update prompt template content.
```json
// Request
{"content": "New template content with {{variables}}"}

// Response 200
{"ok": true}
```

### POST /api/prompts/{id}/reset
Reset prompt template to compiled default.

---

## Diagnostics

### GET /healthz
Service health and configuration summary.
```json
// Response 200
{
  "status": "ok",
  "started_at": "2026-07-09T10:00:00Z",
  "commit": "abc1234",
  "storage": "azure:projects",
  "prompts_store": "azure:prompts"
}
```

### GET /api/errors
Recent server-side errors (ring buffer, last N entries).
```json
// Response 200
[
  {"timestamp": "...", "code": "...", "message": "...", "path": "/api/...", "method": "POST"},
  ...
]
```
