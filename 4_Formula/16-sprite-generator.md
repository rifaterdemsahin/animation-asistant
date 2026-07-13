# 16 — Sprite Generator (14-icon technical sprite sheet)

> **Base:** `POST/GET /api/projects/{id}/sprite/concepts` + `POST/GET /api/projects/{id}/sprite`
> **Files:** `server/sprite.go`, `server/prompts.go`, `server/app.go`, `web/pages/media-manager.html`, `web/assets/js/media-manager.js`
> **Status:** implemented
> **UI:** Media Manager, step 3 (before Components, which shifts to step 4; Audio shifts to step 5)

Two-stage generator that turns an already-generated script into a single
branded 14-icon technical sprite sheet image: a text call extracts 14 concrete
visual concepts from the script, then an image call renders those concepts
into one grid-layout sprite sheet (blueprint background, labeled icons, cool
tech color palette).

---

## 1. POST `/api/projects/{id}/sprite/concepts` — Extract Concepts

**Mutates data. Incurs LLM (text) cost.**

Reads every act's `script/act.md`, sends it to the text model with the
editable `sprite.concepts_system` / `sprite.concepts_user` templates, and asks
for exactly 14 short (1-4 word) concept labels suitable for individual icons.
Overwrites the project's stored concept list (`sprite/sprite.json`).

### Prerequisite

At least one act's script must already be generated
(`<act-slug>/script/act.md`). If none exist:

```json
{"error": true, "code": "script_required", "message": "No script content found — generate the Script (step 2) first."}
```

### Request

No body required (`{}`).

### Response (200)

```json
{
  "ok": true,
  "concepts": [
    "Chaotic Spreadsheet", "Conflicting Data", "Disconnected Tools", "Central Hub",
    "Database Icon", "CRM Connector", "ERP Connector", "Digital Highway",
    "Data Chaos", "Data Stream", "Lightbulb Innovation", "Gear Adaptation",
    "Shield Resilience", "Bridge Of Light"
  ]
}
```

### Errors

| HTTP | Code               | When                                         |
|------|--------------------|-----------------------------------------------|
| 400  | `script_required`  | No act script content found                   |
| 404  | `not_found`        | Project doesn't exist                         |
| 500  | `openrouter_error` | LLM API failed                                |
| 500  | `json_parse_error` | Model returned non-JSON / malformed output    |
| 500  | `no_concepts`      | Model returned valid JSON but an empty list    |

---

## 2. GET `/api/projects/{id}/sprite/concepts` — Preview Concepts

**Idempotent. No generation. Zero LLM cost.**

Returns the currently stored concept list without calling the text model —
used by the UI's "Preview Concepts" button so users can inspect what's stored
without paying to regenerate.

### Response (200)

```json
{"concepts": ["Chaotic Spreadsheet", "Conflicting Data", "..."]}
```

`concepts` is `null`/absent if none have been generated yet.

---

## 3. POST `/api/projects/{id}/sprite` — Generate Sprite Sheet

**Mutates data. Incurs LLM (image) cost.**

Renders the `sprite.image_prompt` template (the fixed design brief — grid
layout, blueprint background, labeled icons) with the stored 14 concepts
substituted in as a numbered list, then generates one image via the
configured OpenRouter image model. Stores the result as a new version —
**never overwrites** a prior sprite sheet.

### Prerequisite

Concepts must already be extracted (step 1). If none:

```json
{"error": true, "code": "concepts_required", "message": "Generate the 14 concepts from the script first."}
```

### Request

No body required (`{}`).

### Response (200)

```json
{
  "ok": true,
  "version": {
    "id": 1,
    "file": "sprite/sprite-sheet-01.png",
    "prompt": "Create a clean, technical sprite sheet image containing exactly 14...",
    "concepts": ["Chaotic Spreadsheet", "..."],
    "created_at": "2026-07-13T10:40:51Z"
  }
}
```

### Errors

| HTTP | Code                | When                                   |
|------|---------------------|-----------------------------------------|
| 400  | `concepts_required` | No stored concepts (run step 1 first)   |
| 404  | `not_found`         | Project doesn't exist                   |
| 500  | `openrouter_error`  | Image model call failed                 |
| 500  | `storage_error`     | Could not write the PNG to storage      |

---

## 4. GET `/api/projects/{id}/sprite` — Read State

**Idempotent. No generation. Zero cost.**

Returns the full manifest: stored concepts + every generated version. Used on
page load to restore the panel (preview text + latest image) without any
generation call.

### Response (200)

```json
{
  "concepts": ["Chaotic Spreadsheet", "..."],
  "versions": [
    {"id": 1, "file": "sprite/sprite-sheet-01.png", "prompt": "...", "concepts": [...], "created_at": "2026-07-13T10:40:51Z"}
  ]
}
```

Both fields are empty/absent for a project that hasn't run the Sprite
Generator yet.

---

## Storage

```
<project-slug>/
└── sprite/
    ├── sprite.json           # {concepts: [...], versions: [...]}  — the manifest
    ├── sprite-sheet-01.png   # version 1
    └── sprite-sheet-02.png   # version 2 (re-generation, never overwrites)
```

Manifest shape (`sprite/sprite.json`):

```json
{
  "concepts": ["Chaotic Spreadsheet", "Conflicting Data", "..."],
  "versions": [
    {"id": 1, "file": "sprite/sprite-sheet-01.png", "prompt": "full rendered prompt...", "concepts": [...], "created_at": "2026-07-13T10:40:51Z"}
  ]
}
```

Same versioning pattern as `storyboard/versions.json` (monotonic IDs, never
overwrite). Backed by whichever storage backend is configured — Azure Blob
(`projects` container) in production, local `other/` in dev without an Azure
connection string. Verified in production: files land at
`<slug>/sprite/sprite-sheet-01.png` and `<slug>/sprite/sprite.json` inside the
`animationasistant` storage account's `projects` container, alongside the
usual prompt audit trail entries (`prompts/<ts>-sprite-sprite-concepts.json`,
`prompts/<ts>-sprite-sprite-sheet.json`).

## Prompt Template (`sprite`, editable via `/pages/prompts.html`)

```json
{
  "concepts_system": "You analyze an animated explainer video's script and extract concrete visual concepts suitable for a technical icon sprite sheet. Return JSON only, no markdown.",
  "concepts_user": "Topic: {{topic}}\n\nScript content:\n{{script}}\n\nExtract exactly 14 distinct concepts... Return JSON: {\"concepts\":[...]}",
  "image_prompt": "Create a clean, technical sprite sheet image containing exactly 14 individual vector-style graphic icons... [THE 14 GRAPHIC CONCEPTS TO INCLUDE]\n{{concepts}}"
}
```

| Variable | Used in | Source |
|----------|---------|--------|
| `{{topic}}` | both | `project.topic` (falls back to title) |
| `{{script}}` | concepts_user | Concatenation of every act's `script/act.md` |
| `{{concepts}}` | image_prompt | Stored concepts, rendered as a `1. Label` numbered list |

## Pipeline Position

```
Phase 2: Script (per act)
    ▼
Phase 2.5: Sprite Generator (project-level, optional)
    │
    │  POST /api/projects/{slug}/sprite/concepts
    │    → Reads all acts' script/act.md
    │    → Chat: OpenRouter → text model
    │    → Extracts JSON: {concepts: [14 labels]}
    │    → Stores: sprite/sprite.json (concepts)
    │
    │  POST /api/projects/{slug}/sprite
    │    → Renders image_prompt with stored concepts
    │    → Generate image: OpenRouter → image model
    │    → Stores: sprite/sprite-sheet-NN.png (versioned)
    ▼
Phase 3: Components (per act × type)
```

Independent of Components/Audio/Storyboard — nothing downstream depends on
the sprite sheet; it's a standalone branding/asset-kit output.

## UI (Media Manager, `web/pages/media-manager.html` + `media-manager.js`)

Panel "🧩 3. Sprite Generator" — four controls:

| Button | Calls | Cost |
|--------|-------|------|
| 📋 Generate concepts from script | `POST .../sprite/concepts` | LLM text call |
| 👁️ Preview Concepts | `GET .../sprite/concepts` (toggle) | free |
| 👁️ Prompt Visualiser | none — renders `image_prompt` client-side with cached/fetched concepts | free |
| ⚡ Generate Sprite Sheet | `POST .../sprite` | LLM image call |

On page load, `loadSprite()` calls `GET .../sprite` once to restore the
concepts preview and the latest generated image with no cost.

## Implementation

| File                              | Change                                                                 |
|------------------------------------|-------------------------------------------------------------------------|
| `server/sprite.go` (new)          | `generateSpriteConcepts`, `getSpriteConcepts`, `generateSprite`, `getSprite`, manifest load/save, `gatherScriptText`, `formatConceptList` |
| `server/prompts.go`               | `spritePrompt` struct, default values, `spriteTmpl()` accessor, descriptor entry |
| `server/app.go`                   | 4 new routes registered                                                |
| `web/pages/media-manager.html`    | New panel (step 3); Components/Audio renumbered to 4/5                 |
| `web/assets/js/media-manager.js`  | Concept/prompt/version rendering + 4 button handlers + `loadSprite()`  |

### Routes registered

```go
mux.HandleFunc("POST /api/projects/{slug}/sprite/concepts", a.authed(a.generateSpriteConcepts))
mux.HandleFunc("GET /api/projects/{slug}/sprite/concepts", a.authed(a.getSpriteConcepts))
mux.HandleFunc("POST /api/projects/{slug}/sprite", a.authed(a.generateSprite))
mux.HandleFunc("GET /api/projects/{slug}/sprite", a.authed(a.getSprite))
```
