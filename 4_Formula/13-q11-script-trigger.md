# 13 — API: Script Generate & Read (q11 trigger)

> **Status:** Draft — awaiting confirmation to implement
> **References:** SPEC-SCRIPT.md §4, §8 (mandatory storyboard context)

## Motivation

The existing script flow requires multiple steps and endpoints to check state,
generate, and read results. The user wants two single-URL operations:

| Verb | What it does | Safe to bookmark |
|------|-------------|-----------------|
| **GET** | Read what's already generated — no changes, no cost | Yes |
| **POST** | Auto-generate missing phases (outline → script) | No (triggers LLM) |

Both return the **same response shape** — a unified view of project state,
outline, and per-act scripts.

---

## Route 1: Read (GET)

```
GET /api/projects/{id}/script/generate
```

**Idempotent. Zero cost.** Returns whatever is already stored. If no script
exists, `phases.script` = `"pending"` and `acts` is empty.

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
    "title": "The Multi-Agent Mind",
    "logline": "When a solo researcher drowns in a sea of endless data...",
    "acts": {
      "act-1": {"summary": "The problem setup..."},
      "act-2": {"summary": "The solution introduced..."},
      "act-3": {"summary": "The lesson learned..."}
    }
  },
  "acts": {
    "act-1": {
      "key":       "act-1",
      "role":      "problem",
      "title":     "Act 1 — Problem",
      "narration": "Full voiceover text for act 1...",
      "voiceover": "Flat narration-only text ready for TTS...",
      "markdown":  "# Act 1 — Problem\n\n**Role:** problem\n\n...",
      "beats": [
        {"id": "beat-1", "text": "Panel 1 setup..."},
        {"id": "beat-2", "text": "Panel 2 action..."}
      ]
    },
    "act-2": { "...": "..." },
    "act-3": { "...": "..." }
  },
  "versions": {
    "act-1": [{"id": 1, "model": "google/gemini-3.5-flash", "created_at": "..."}],
    "act-2": [{"id": 1, "model": "google/gemini-3.5-flash", "created_at": "..."}],
    "act-3": [{"id": 1, "model": "google/gemini-3.5-flash", "created_at": "..."}]
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

---

## Route 2: Generate (POST)

```
POST /api/projects/{id}/script/generate
```

**Mutates data. Incurs LLM cost.** Auto-runs missing phases (outline → script),
skipping what's already done unless `"force": true`.

### Request

```json
{
  "force": false
}
```

| Field   | Type    | Default | Description                                      |
|---------|---------|---------|--------------------------------------------------|
| `force` | boolean | `false` | Re-generate even if already done                  |

If the project has `question`/`answer`/`why` stored in `project.json`, those
values are used automatically — no need to resend them.

### Response (200)

Same shape as GET (above), with the freshly generated content.

---

## Field Descriptions (both endpoints)

| Field                  | Type    | Description                                           |
|------------------------|---------|-------------------------------------------------------|
| `ok`                   | bool    | `true` on success                                     |
| `project_id`           | string  | Project identifier                                    |
| `title`                | string  | Project title                                         |
| `status`               | string  | Pipeline status (`storyboard`, `outline`, `script`)   |
| `phases`               | object  | Per-phase status: `"done"`, `"pending"`, or `"error"` |
| `outline`              | object  | The outline JSON (`null` if not generated)            |
| `acts`                 | object  | Per-act script results (keyed by `act-1/2/3`)         |
| `acts.{key}.narration` | string  | Full voiceover narration with act announcements       |
| `acts.{key}.voiceover` | string  | Flat narration text, TTS-ready (voiceover.txt)        |
| `acts.{key}.beats`     | array   | 3-6 visual beats, each `{"id","text"}`                |
| `acts.{key}.markdown`  | string  | Rendered act.md content                               |
| `versions`             | object  | Version history per act (newest first)                |

---

## Generation Logic (POST only)

```
POST /api/projects/{id}/script/generate
│
├─ 1. Resolve project by slug/ID
├─ 2. MANDATORY CHECK: storyboard_prompts exist
│   └─ If missing → 400 "storyboard_required"
│
├─ 3. Check outline phase
│   ├─ If done AND force=false → skip
│   └─ If pending OR force=true → generateOutline()
│       └─ On error → 500, phases.outline = "error"
│
├─ 4. Check script phase (per act)
│   ├─ Build list of acts where script != "done" OR force=true
│   ├─ If all done → skip generation, return cached results
│   └─ If acts pending → generateScript({acts: pendingActs})
│       └─ Uses project.question/answer/why from project.json
│
├─ 5. Assemble response (same as GET)
│   ├─ Load outline.json
│   ├─ Load all act scripts (act.md, beats.json, voiceover.txt)
│   ├─ Load versions.json per act
│   └─ Return 200
```

---

## Error Responses

### Storyboard Missing (400) — POST only

```json
{
  "error": true,
  "code": "storyboard_required",
  "message": "Storyboard images must be generated before script. Run storyboard first.",
  "phases": {"storyboard": "pending", "outline": "pending", "script": "pending"}
}
```

### LLM Failure (500) — POST only

```json
{
  "error": true,
  "code": "openrouter_error",
  "message": "act act-1: OpenRouter returned 429",
  "phases": {"storyboard": "done", "outline": "done", "script": "error"}
}
```

### Project Not Found (404) — both

```json
{
  "error": true,
  "code": "not_found",
  "message": "Project q11 not found"
}
```

---

## Usage

### Read existing script (GET — safe, no cost)

```bash
# Login
curl -c /tmp/cookies.txt -X POST http://localhost:8080/api/login \
  -H "Content-Type: application/json" \
  -d '{"password":"your-password"}'

# Read what's already generated
curl -b /tmp/cookies.txt \
  http://localhost:8080/api/projects/q11/script/generate
```

### Generate script (POST — triggers LLM)

```bash
# Auto-run missing phases
curl -b /tmp/cookies.txt -X POST \
  http://localhost:8080/api/projects/q11/script/generate \
  -H "Content-Type: application/json" \
  -d '{}'

# Force full re-generation
curl -b /tmp/cookies.txt -X POST \
  http://localhost:8080/api/projects/q11/script/generate \
  -H "Content-Type: application/json" \
  -d '{"force": true}'
```

### Browser bookmark (GET only)

```
http://localhost:8080/api/projects/q11/script/generate
```

Opens in browser (with auth cookie set) as raw JSON. Use a JSON formatter
extension for readable display.

---

## Implementation Files

| File              | Change                                                       |
|-------------------|--------------------------------------------------------------|
| `server/script.go` | Handler: `scriptState()` (GET) + `generateScriptPipeline()` (POST) |
| `server/app.go`    | Routes: `GET` + `POST /api/projects/{slug}/script/generate`  |

The GET handler (`scriptState`) reuses the assembly logic from the POST handler
(`generateScriptPipeline`) — both call the same `assembleScriptResponse()`
helper for the response shape.

---

## Checklist

- [ ] Confirm spec
- [ ] Implement `scriptState()` (GET) + `generateScriptPipeline()` (POST) in `server/script.go`
- [ ] Extract shared `assembleScriptResponse()` helper
- [ ] Register both routes in `server/app.go`
- [ ] Test GET: `curl -b cookies.txt /api/projects/q11/script/generate`
- [ ] Test POST: `curl -b cookies.txt -X POST ... -d '{}'`
- [ ] Test POST with force=true
- [ ] Test error: project without storyboard (POST)
- [ ] Test error: non-existent project (both)
