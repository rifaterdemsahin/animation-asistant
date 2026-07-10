# 15 — Script Endpoints (generate, state, voiceover)

> **Base:** `GET/POST /api/projects/{id}/script/generate` + `GET .../script/voiceover`
> **Files:** `server/script.go`, `server/app.go`
> **Status:** implemented

Three endpoints built on top of the existing outline + script pipeline. Share a
common response shape for state + script data; the voiceover endpoint returns
plain text ready for Canva TTS.

---

## 1. GET `/api/projects/{id}/script/generate` — Read State

**Idempotent. No generation. Zero LLM cost.**

Returns the current project state plus all generated script content (outline,
narration, beats, markdown, versions) in a single JSON response. Safe to
bookmark or poll repeatedly.

### Request

No body. Auth cookie required.

### Response (200)

```json
{
  "ok": true,
  "project_id": "q11",
  "title": "Intermediate Summarization for Token Budget",
  "status": "script",
  "phases": {
    "storyboard": "done",
    "outline":    "done",
    "script":     "done"
  },
  "outline": {
    "title": "...",
    "logline": "...",
    "acts": {
      "act-1": {"summary": "..."},
      "act-2": {"summary": "..."},
      "act-3": {"summary": "..."}
    }
  },
  "acts": {
    "act-1": {
      "key":       "act-1",
      "role":      "problem",
      "title":     "Act 1 — Problem",
      "narration": "...",
      "voiceover": "...",
      "markdown":  "...",
      "beats": [{"id": "beat-1", "text": "..."}]
    },
    "act-2": { "...": "..." },
    "act-3": { "...": "..." }
  },
  "versions": {
    "act-1": [{"id": 1, "act": "act-1", "model": "google/gemini-3.5-flash", "created_at": "...", "markdown": "...", "beats": "...", "voiceover": "..."}],
    "act-2": [...],
    "act-3": [...]
  }
}
```

If nothing is generated yet:

```json
{
  "ok": true,
  "project_id": "q11",
  "status": "storyboard",
  "phases": {"storyboard": "done", "outline": "pending", "script": "pending"},
  "outline": null,
  "acts": {},
  "versions": {}
}
```

### Error (404)

```json
{"error": true, "code": "not_found", "message": "Project q11 not found"}
```

---

## 2. POST `/api/projects/{id}/script/generate` — Generate

**Mutates data. Incurs LLM cost.**

Auto-runs the pipeline through **outline → script** for any missing phases.
Already-completed steps are skipped unless `"force": true`. Storyboard images
must exist (mandatory prerequisite).

### Request

```json
{
  "force": false
}
```

| Field   | Type    | Default | Description                   |
|---------|---------|---------|-------------------------------|
| `force` | boolean | `false` | Re-generate even if done      |

Uses project-stored `question`/`answer`/`why` automatically.

### Response (200)

Same shape as the GET endpoint (above), with freshly generated content.

### Generation Logic

```
POST /api/projects/{id}/script/generate
│
├─ 1. Resolve project, verify storyboard_prompts exist
│   └─ Missing → 400 "storyboard_required"
├─ 2. Phase: Outline
│   ├─ Skip if done AND force=false
│   └─ Generate → openrouter → extractJSON → save outline.json
├─ 3. Phase: Script (per act)
│   ├─ Skip acts where script=done AND force=false
│   └─ Generate → openrouter → save act.md, beats.json, voiceover.txt + versioned
├─ 4. Assemble and return (same shape as GET)
```

### Errors

| HTTP | Code                 | When                                          |
|------|----------------------|-----------------------------------------------|
| 400  | `storyboard_required`| No storyboard_prompts in project               |
| 404  | `not_found`          | Project doesn't exist                          |
| 500  | `openrouter_error`   | LLM API failed (rate limit, auth, timeout)     |
| 500  | `json_parse_error`   | Model returned non-JSON / malformed output     |
| 500  | `storage_error`      | Could not write to storage backend             |

---

## 3. GET `/api/projects/{id}/script/voiceover` — Canva TTS

**Returns:** `text/plain; charset=utf-8`

Reads all three acts' `voiceover.txt` files and returns them as clean plain
text with act headers — ready to paste into Canva's AI voiceover tool. Zero
generation, zero cost.

### Response (200)

```
Act 1 — Problem
===============
In multi-agent AI systems, scale introduces a quiet but devastating bottleneck...

Act 2 — Solution
===============
In the central operations hub, our bright orange Coordinator agent receives...

Act 3 — Lesson
=============
To solve this architectural bottleneck, we introduce a specialized intermediate...
```

### Format Rules

- Plain text only — no JSON, HTML, or markdown
- Act header: `Act N — Role` underlined with `=` (matching header length)
- Blank line between acts, trailing newline
- Missing/empty acts are silently omitted

### Error (404)

```
Content-Type: text/plain; charset=utf-8

No script found for project q11. Generate the script first.
```

---

## Response Shape Reference

### Field Descriptions

| Field                  | Type   | In           | Description                              |
|------------------------|--------|-------------|------------------------------------------|
| `ok`                   | bool   | 1+2         | `true` on success                        |
| `project_id`           | string | 1+2         | Project identifier                       |
| `title`                | string | 1+2         | Project title                            |
| `status`               | string | 1+2         | Pipeline status                          |
| `phases`               | object | 1+2         | `{storyboard, outline, script}` each `"done"`/`"pending"`/`"error"` |
| `outline`              | object | 1+2         | Full outline JSON or `null`              |
| `acts`                 | object | 1+2         | Keyed by `act-1`, `act-2`, `act-3`       |
| `acts.{k}.key`         | string | 1+2         | Act key                                  |
| `acts.{k}.role`        | string | 1+2         | `problem` / `solution` / `lesson`        |
| `acts.{k}.title`       | string | 1+2         | `Act 1 — Problem`                        |
| `acts.{k}.narration`   | string | 1+2         | Full voiceover narration                 |
| `acts.{k}.voiceover`   | string | 1+2         | TTS-ready text (voiceover.txt)           |
| `acts.{k}.beats`       | array  | 1+2         | `[{id, text}]` visual beats              |
| `acts.{k}.markdown`    | string | 1+2         | Rendered act.md                          |
| `versions`             | object | 1+2         | Per-act version history                  |

---

## Usage

### One-liners

```bash
# Login (once)
curl -c /tmp/cookies.txt -X POST http://localhost:8080/api/login \
  -H "Content-Type: application/json" \
  -d '{"password":"your-password"}'

# Read state (safe, no cost)
curl -b /tmp/cookies.txt http://localhost:8080/api/projects/q11/script/generate | python3 -m json.tool

# Generate script (auto-runs missing phases)
curl -b /tmp/cookies.txt -X POST http://localhost:8080/api/projects/q11/script/generate \
  -H "Content-Type: application/json" -d '{}'

# Get Canva TTS voiceover text
curl -b /tmp/cookies.txt http://localhost:8080/api/projects/q11/script/voiceover

# Save voiceover to file
curl -b /tmp/cookies.txt http://localhost:8080/api/projects/q11/script/voiceover -o q11-voiceover.txt
```

### Browser bookmarks

| Endpoint | URL                                            | Safe |
|----------|-------------------------------------------------|------|
| State    | `/api/projects/q11/script/generate`            | yes  |
| Voiceover| `/api/projects/q11/script/voiceover`           | yes  |

---

## Implementation

| File              | Change                                          |
|-------------------|-------------------------------------------------|
| `server/script.go` | `scriptPipelineState` (GET), `generateScriptPipeline` (POST), `assembleScriptResponse` (shared), `serveVoiceover` (GET) |
| `server/app.go`    | 3 new routes registered                         |

### Routes registered

```go
mux.HandleFunc("GET /api/projects/{slug}/script/generate", a.authed(a.scriptPipelineState))
mux.HandleFunc("POST /api/projects/{slug}/script/generate", a.authed(a.generateScriptPipeline))
mux.HandleFunc("GET /api/projects/{slug}/script/voiceover", a.authed(a.serveVoiceover))
```
