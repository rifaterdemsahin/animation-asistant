# Script Generation Spec — Animation Assistant

## 1. Overview

Script generation produces a **per-act voiceover script** that syncs narration
with the storyboard's speech bubbles and visual elements. Its **primary purpose**
is generating the AI voiceover — the `voiceover.txt` output feeds directly into
ElevenLabs TTS. The narration **must describe what the audience sees** in the
storyboard images: backgrounds, speech bubbles, character placements, and scene
composition. Acts must be announced at the start and at each transition.

The script is the **second phase** in the pipeline, but critically depends on
the storyboard which is a **mandatory prerequisite**:

```
Project Creation → Outline → Storyboard (mandatory) → Script → Components → Audio
```

> **Note on pipeline ordering:** Storyboard images are generated first (3 acts,
> 4-panel comics each). The script then uses these images as visual reference to
> write narration that precisely matches speech bubbles and scene composition.
> This is a deliberate **storyboard-first** flow — the visuals exist before the
> voiceover is written, ensuring tight visual-audio sync.

Two generation surfaces exist by design (not duplication):

| Surface     | Location              | Writes to        | Triggered by             |
|-------------|-----------------------|------------------|--------------------------|
| Go backend  | `server/script.go`    | Azure Blob       | `POST /api/projects/{id}/script` |
| Python CLI  | `scripts/generate_script.py` → `shared/scriptgen.py` | local `./other/` | CLI `--slug` / `--act`   |

Both surfaces use the same prompt templates and produce identical output
structures. Templates are **editable** at runtime via `GET/PUT /api/prompts/script`
and the `/pages/prompts.html` UI.

---

## 2. Three-Act Structure

Every project is built on a fixed three-act narrative. Script generation runs
**per act** — you can generate any single act independently.

| Act Key | Slug              | Role     | Title             | Purpose                                                   |
|---------|-------------------|----------|-------------------|-----------------------------------------------------------|
| `act-1` | `act-1-problem`   | problem  | Act 1 — Problem   | Set up the world and the problem/pain the audience feels. |
| `act-2` | `act-2-solution`  | solution | Act 2 — Solution  | Introduce the solution; show how the problem is resolved. |
| `act-3` | `act-3-lesson`    | lesson   | Act 3 — Lesson    | The takeaway / moral / insight the audience leaves with.  |

---

## 3. Prerequisites

### 3.1 Outline (Required)

A project-level outline must exist at `<project>/outline.json`:

```json
{
  "title": "Why Sleep Matters",
  "logline": "A short explainer on the importance of sleep for health.",
  "acts": {
    "act-1": { "summary": "Introduce the sleep deprivation crisis." },
    "act-2": { "summary": "Show how quality sleep repairs the body and mind." },
    "act-3": { "summary": "Three actionable tips for better sleep." }
  }
}
```

The per-act `summary` becomes the `{{summary}}` variable in the script prompt.
If no outline exists, the act's `purpose` is used as fallback.

### 3.2 Storyboard Images (Mandatory)

Storyboard images **must exist** before script generation. The storyboard
contains 4-panel comics per act with speech bubbles, backgrounds, and character
positions. The script's narration **must**:

- **Explain the background** — describe the scene setting, mood, and visual style
  shown in each panel
- **Sync with speech bubbles** — the voiceover text must match what characters
  are shown saying in the storyboard panels
- **Follow scene composition** — narration timing should align with panel
  progression (panel 1 → 2 → 3 → 4 per act)

The per-act image prompts are injected as mandatory context. Without storyboard
images, the script has no visual reference and **generation is blocked**. See
§8 for the mandatory context injection mechanism.

### 3.3 Project Q&A (Optional)

The project's `question`, `answer`, and `why` fields may be sent in the request
body and are persisted to `project.json`. These provide semantic context about
the exam question being explained and inform the script's educational content.

---

## 4. API Endpoints

### 4.1 Generate Script

```
POST /api/projects/{project_id}/script
Content-Type: application/json
```

**Request:**

```json
{
  "acts":     ["act-1", "act-2", "act-3"],
  "question": "Why is sleep important?",
  "answer":   "Sleep is essential for memory consolidation and cellular repair.",
  "why":      "Many people sacrifice sleep for productivity.",
  "provider": "openrouter"
}
```

| Field      | Required | Default        | Description                                   |
|------------|----------|----------------|-----------------------------------------------|
| `acts`     | no       | all three acts | Which acts to generate. `["act-1"]` for one.   |
| `question` | no       | —              | Project Q&A — persisted, not in prompt.        |
| `answer`   | no       | —              | Project Q&A — persisted, not in prompt.        |
| `why`      | no       | —              | Project Q&A — persisted, not in prompt.        |
| `provider` | no       | `"openrouter"` | Text backend: `"openrouter"` or `"deepseek"`. |

**Response (200):**

```json
{
  "ok": true,
  "acts": ["act-1", "act-2", "act-3"]
}
```

**Errors:**

| Code               | Meaning                              |
|--------------------|--------------------------------------|
| `not_found`        | Project slug/ID not found            |
| `openrouter_error` | LLM call failed (network, quota, 4xx) |
| `json_parse_error` | Model returned non-JSON / malformed   |
| `storage_error`    | Could not write to storage backend    |

### 4.2 Get Scripts

```
GET /api/projects/{project_id}/script
```

**Response (200):**

```json
{
  "acts": {
    "act-1": "# Act 1 — Problem\n\n**Role:** problem\n\n...",
    "act-2": "# Act 2 — Solution\n\n...",
    "act-3": "# Act 3 — Lesson\n\n..."
  },
  "voiceover": {
    "act-1": "1-3 paragraphs of professional voiceover narration...",
    "act-2": "...",
    "act-3": "..."
  },
  "versions": {
    "act-1": [
      {
        "id": 1,
        "act": "act-1",
        "model": "google/gemini-3.5-flash",
        "created_at": "2026-07-10T12:00:00Z",
        "markdown": "# Act 1 — Problem\n\n...",
        "beats": "{\"narration\":\"...\",\"beats\":[...]}",
        "voiceover": "1-3 paragraphs..."
      }
    ]
  }
}
```

The `versions` map contains versioned history (see §7), newest first. The
top-level `acts` and `voiceover` always return the **latest** version.

### 4.3 Compare Providers

```
POST /api/projects/{project_id}/script/compare
Content-Type: application/json
```

Runs the **same prompt** through both OpenRouter and DeepSeek **in parallel**
for A/B comparison. Nothing is persisted.

**Request:**

```json
{
  "act": "act-1",
  "question": "Why is sleep important?",
  "answer": "Sleep is essential for memory.",
  "why": "People sacrifice sleep."
}
```

**Response (200):**

```json
{
  "ok": true,
  "act": "act-1",
  "act_title": "Act 1 — Problem",
  "openrouter": {
    "provider": "openrouter",
    "model": "google/gemini-3.5-flash",
    "markdown": "# Act 1 — Problem\n\n...",
    "beats": [...],
    "narration": "...",
    "elapsed_ms": 3200,
    "chars": 840,
    "ok": true
  },
  "deepseek": {
    "provider": "deepseek",
    "model": "deepseek-chat",
    "markdown": "# Act 1 — Problem\n\n...",
    "beats": [...],
    "narration": "...",
    "elapsed_ms": 2800,
    "chars": 910,
    "ok": true
  },
  "deepseek_configured": true
}
```

---

## 5. Data Model

### 5.1 Generated JSON (per act)

The LLM returns:

```json
{
  "narration": "Act One: The Problem. [Voiceover describing the scene background — a busy control room with multiple screens...] The first speech bubble reads 'Our agents are drowning in data!' and Sarah gestures at the overflowing token pipeline... Now Act Two: The Solution. [The scene shifts to a clean, organized workspace where an Intermediate Summarization Agent compresses 85K and 70K input streams into a single 35K brief...]",
  "beats": [
    { "id": "beat-1", "text": "Wide shot of the Multi-Agent Research control room. Two massive pipes labeled '85K tokens' and '70K tokens' pour data into an overwhelmed Synthesis Unit." },
    { "id": "beat-2", "text": "Close-up on a speech bubble: 'Our synthesis agent has a 50K token ceiling!' Sarah points at the overflowing pipes." },
    { "id": "beat-3", "text": "Cut to the solution: an Intermediate Summarization Agent sits between the pipes and the Synthesis Unit, compressing data into a clean 35K stream." }
  ]
}
```

**Constraints:**
- `narration` — voiceover-ready text that:
  - **Announces the act at the start** (e.g. "Act One: The Problem.") and at
    each transition between acts ("Now Act Two: The Solution.")
  - **Describes the background** — setting, mood, colors, spatial layout shown
    in storyboard panels
  - **Syncs with speech bubbles** — all speech bubble text from the storyboard
    must be spoken verbatim or naturally woven into the narration
  - **Follows panel progression** — timing naturally walks through panels 1→4
  - Professional, engaging, TTS-ready (no markdown, no stage directions)
- `beats` — 3 to 6 beats per act
- Each `beat.id` — unique within the act (`beat-1`, `beat-2`, …)
- Each `beat.text` — references specific storyboard panels and speech bubble
  content; concrete enough for component image generation

### 5.2 Markdown Output (`act.md`)

Constructed from the JSON and stored per act:

```markdown
# Act 1 — Problem

**Role:** problem

## Narration

Act One: The Problem. We open on a busy Multi-Agent Research control room...

## Beats

- **beat-1**: Wide shot of the control room. Two massive pipes labeled...
- **beat-2**: Close-up on a speech bubble: 'Our synthesis agent has a 50K...'
- **beat-3**: Cut to the solution: an Intermediate Summarization Agent...
```

### 5.3 Voiceover File (`voiceover.txt`)

Plain text — the `narration` field only, trimmed. **This is the primary output**
of script generation. It feeds directly into ElevenLabs TTS to produce the
`narration.mp3` audio file. The voiceover is the central audio track that all
other audio (music, SFX) layers under.

### 5.4 Beats File (`beats.json`)

The full JSON object (`{narration, beats}`), pretty-printed. Used by downstream
components generation to derive typed visuals from individual beats.

### 5.5 Version Manifest (`versions.json`)

```json
{
  "versions": [
    {
      "id": 1,
      "act": "act-1",
      "markdown_file": "v01-act.md",
      "beats_file": "v01-beats.json",
      "voiceover_file": "v01-voiceover.txt",
      "model": "google/gemini-3.5-flash",
      "created_at": "2026-07-10T12:00:00Z"
    }
  ]
}
```

### 5.6 Project Status Updates

After successful script generation, the project's per-act status is updated:

```json
{
  "acts": {
    "act-1": { "script": "done", "outline": "done", ... },
    ...
  },
  "status": "script"
}
```

---

## 6. Prompt Templates

### 6.1 System Prompt

```
You are an expert voiceover scriptwriter for animated explainer videos. You
write ONE act of a voiceover script that will be fed directly into ElevenLabs
TTS to generate AI narration. Your script MUST:

1. Announce the act at the start ("Act One: The Problem.") and announce
   transitions between acts ("Now Act Two: The Solution.")
2. Describe what the audience sees — the background scene, character positions,
   colors, mood, and spatial layout shown in the storyboard images
3. Sync precisely with speech bubbles — read out every speech bubble shown in
   the storyboard panels, weaving them naturally into the narration
4. Follow panel progression — timing should walk through panels 1→2→3→4

The storyboard images are your ONLY visual reference. Every word of narration
must be grounded in what is visibly shown. Return STRICT JSON only, no
markdown. Maintain a professional, engaging, and educational tone.
```

### 6.2 User Prompt Template

```
### STORYBOARD IMAGES FOR THIS ACT
The voiceover MUST describe the background scene, read every speech bubble
verbatim, and follow the panel composition shown below. This is the ONLY
visual reference — every word must match what the audience sees.

{{storyboard_prompts}}
---
### ACT: {{act_key}} — {{act_role}}

**Purpose:** {{purpose}}

**Outline Summary:** {{summary}}

---

### TASK
Write a voiceover script for ONLY this act. The output feeds ElevenLabs TTS.
The storyboard panels above show exactly what the audience sees — speech
bubbles, backgrounds, characters, panel progression.

### VOICEOVER REQUIREMENTS
- START with the act announcement: "Act One: The Problem." (adapt role)
- DESCRIBE the background scene from the storyboard panels
- READ every speech bubble in order, naturally woven into narration
- END with a transition if another act follows, e.g. "Now Act Two..."

### OUTPUT FORMAT — JSON ONLY
Return a single JSON object with this exact shape:
{
  "narration": "voiceover script with act announcement, background description, speech bubble dialogue, and transitions",
  "beats": [
    {"id": "beat-1", "text": "one concrete, storyboard-referencing story beat"},
    {"id": "beat-2", "text": "next concrete story beat"}
  ]
}

### RULES
- 3 to 6 beats per act.
- Each beat must reference specific storyboard panels and speech bubble content.
- Stay focused on this act's role: {{purpose}}
- Narration MUST be grounded in storyboard visuals — describe what is shown.
- Do NOT write other acts.
- JSON ONLY. No markdown, no explanations outside the JSON.
```

### 6.3 Template Variables

| Variable                | Source                          | Required |
|-------------------------|---------------------------------|----------|
| `{{topic}}`             | `project.topic`                 | yes      |
| `{{act_key}}`           | `act-1` / `act-2` / `act-3`     | yes      |
| `{{act_role}}`          | `problem` / `solution` / `lesson` | yes    |
| `{{purpose}}`           | Act purpose string (from acts definition) | yes |
| `{{summary}}`           | Per-act summary from `outline.json`   | yes |
| `{{storyboard_prompts}}`| Storyboard image prompts (mandatory, hard-prepended) | yes |

### 6.4 Editable Template Store

Templates are not hardcoded:

1. Compiled defaults exist in Go (`server/prompts.go`) and Python (`shared/prompts.py`)
2. At startup, defaults are seeded to a **prompts store**:
   - Azure Blob container `prompts` (when `AZURE_STORAGE_CONNECTION_STRING` is set)
   - Local `./other/_prompts/` directory (dev fallback)
3. Templates can be edited live at:
   - `GET/PUT /api/prompts/script` — REST API
   - `/pages/prompts.html` — admin UI
4. The `{{storyboard_prompts}}` placeholder **must** be present in the edited
   template. If missing, the system falls back to the compiled default (Go) or
   renders without it (Python).

---

## 7. Versioning

Every script generation creates a new immutable version. The latest version
always overwrites the root files for backward compatibility.

### 7.1 File Layout Per Act

```
{act-slug}/script/
├── act.md              # Latest narration + beats (always overwritten)
├── beats.json          # Latest full JSON (always overwritten)
├── voiceover.txt       # Latest narration-only text (always overwritten)
├── versions.json       # Manifest — append-only, monotonically increasing IDs
├── v01-act.md          # Versioned copy (never overwritten)
├── v01-beats.json
├── v01-voiceover.txt
├── v02-act.md          # Next generation
├── v02-beats.json
└── v02-voiceover.txt
```

### 7.2 Version ID Assignment

- `versions.json` is loaded, and the next ID = `max(existing_ids) + 1`
- If no versions exist, the first is `v01`
- Filenames use zero-padded two-digit format: `v01`, `v02`, …, `v99`

### 7.3 Python CLI — No Versioning

The Python CLI (`scripts/generate_script.py` / `shared/scriptgen.py`) does
**not** produce versioned files. It overwrites the root `act.md`, `beats.json`,
and `voiceover.txt` only. Versioning is Go-backend-only (the web UI path).

---

## 8. Mandatory Storyboard Context

Storyboard images are a **mandatory prerequisite** for script generation. The
script cannot be generated without them — the voiceover must be grounded in
the visual panels, speech bubbles, and scene composition.

### 8.1 Detection

The handler checks `project.storyboard_prompts` — a map of act key to image
prompt string. If storyboard prompts are **missing**, script generation is
**blocked** with an error.

```json
{
  "act-1": "A four-panel comic. Panel 1: Two massive pipes labeled '85K' and '70K' pour raw data toward a Synthesis Unit with a '50K ceiling' sign...",
  "act-2": "A four-panel comic. Panel 1: An Intermediate Summarization Agent appears between the pipes and the Synthesis Unit...",
  "act-3": "A four-panel comic. Panel 1: The clean, organized system output flows to a satisfied coordinator..."
}
```

### 8.2 Context Injection

The storyboard prompts are **hard-prepended** to every act's user prompt:

```
### STORYBOARD IMAGES FOR THIS ACT
The voiceover MUST describe the background scene, read every speech bubble
verbatim, and follow the panel composition shown below. This is the ONLY
visual reference — every word must match what the audience sees.

**act-1 (problem):** Panel 1: Two massive pipes labeled...
**act-2 (solution):** Panel 1: An Intermediate Summarization Agent...
**act-3 (lesson):** Panel 1: The clean, organized system output...
```

This is injected **before** the rendered template content. It includes all
three acts' prompts so the LLM can see the full visual arc, even when
generating a single act.

### 8.3 Voiceover — Visual Sync Contract

The script's narration forms a binding contract with the storyboard:

| Storyboard Element    | Voiceover Requirement                                   |
|-----------------------|--------------------------------------------------------|
| Speech bubbles        | Read verbatim or naturally woven into narration         |
| Background scene      | Describe setting, mood, colors, spatial layout          |
| Character positions   | Mention who is where, what they are doing               |
| Panel progression     | Walk through panels 1→4 in order                        |
| Act transitions       | Announce "Now Act Two: The Solution." between acts      |
| UI/diagram labels     | Read out any visible labels, numbers, or text elements  |

### 8.4 UI Display

The Script page (`web/pages/script.html`) displays storyboard images above the
act selection so the user can visually verify alignment. Script generation is
**disabled** until storyboard images exist. Re-generating the script picks up
the latest storyboard images automatically.

### 8.5 Cross-Phase Feedback Chain

```
Storyboard (mandatory) ──(image prompts + speech bubbles)──→ Script
Outline ──({{summary}})──→ Script
Script ──(narration/voiceover.txt)──→ Audio (ElevenLabs TTS)
Script ──(beats)──→ Components
```

---

## 9. Implementation

### 9.1 Go Backend — Key Files

| File               | Lines | Key Functions                          |
|--------------------|-------|----------------------------------------|
| `server/acts.go`   | 33    | `actByKey()`, `allActKeys()`           |
| `server/script.go` | 458   | `generateScript()`, `generateActWith()`, `actScriptMessages()`, `loadOutlineMap()`, `getScript()`, `compareScript()`, `actToMarkdown()` |
| `server/prompts.go`| 644   | `scriptTmpl()`, `outlineTmpl()`, `renderTmpl()`, `defaultPromptValues()` |
| `server/prompts_api.go` | 138 | `listPrompts()`, `getPrompt()`, `updatePrompt()`, `resetPrompt()` |
| `server/openrouter.go` | ~150 | `chatText()`, `chatTextProvider()` |

### 9.2 Python Mirror — Key Files

| File                       | Lines | Key Functions                          |
|----------------------------|-------|----------------------------------------|
| `shared/acts.py`           | 15    | `ACTS`, `ACT_BY_KEY`                   |
| `shared/scriptgen.py`      | 94    | `generate_outline()`, `generate_script()`, `outline_map()`, `_storyboard_context()`, `to_markdown()` |
| `shared/prompts.py`        | 223   | `outline()`, `script()`, `render()`, `load()`, `seed()` |
| `scripts/generate_script.py` | 112 | `cmd_create()`, `cmd_outline()`, `cmd_script()` |

### 9.3 Model

Default text model: `google/gemini-3.5-flash` (configurable via
`OPENROUTER_TEXT_MODEL` env var). Minimum: Gemini 3 family.

### 9.4 Generation Flow (Go Backend)

```
POST /api/projects/{slug}/script
│
├─ 1. Resolve project by slug/ID
├─ 2. Parse request (acts[], question, answer, why, provider)
├─ 3. Update project Q&A if provided
├─ 4. MANDATORY CHECK: verify storyboard_prompts exist
│   └─ If missing → return 400 error "storyboard_required"
├─ 5. Load outline summaries via loadOutlineMap()
├─ 6. For each requested act:
│   ├─ a. Build messages via actScriptMessages():
│   │      ├─ Load editable script prompt (scriptTmpl)
│   │      ├─ Build storyboard context header (always — mandatory):
│   │      │   └─ "STORYBOARD IMAGES FOR THIS ACT — voiceover MUST
│   │      │      describe background, read speech bubbles, follow panels"
│   │      ├─ Include ALL three acts' storyboard prompts for full context
│   │      ├─ Render template with {{topic}}, {{act_key}}, {{act_role}},
│   │      │  {{purpose}}, {{summary}}
│   │      ├─ Strip {{storyboard_prompts}} — always empty in rendered template
│   │      └─ Prepend storyboard context header
│   ├─ b. Call generateActWith():
│   │      ├─ Save prompt to prompt audit store (openrouter only)
│   │      ├─ Call chatTextProvider() → OpenRouter or DeepSeek
│   │      └─ extractJSON() from raw response
│   ├─ c. Convert to markdown (actToMarkdown)
│   ├─ d. Write latest files (act.md, beats.json, voiceover.txt)
│   ├─ e. Write versioned files (vNN-*)
│   ├─ f. Append to versions.json
│   └─ g. Mark act script = "done"
├─ 7. Set project status = "script"
└─ 8. Save project, return {ok, acts}
```

### 9.5 Prompt Saving

Only the default `openrouter` provider logs messages to the prompt audit store
(`savePromptMsg`). The `deepseek` provider is used for comparison only and is
not logged to avoid duplicating identical messages.

---

## 10. CLI Usage (Python)

```bash
# Create a project
python scripts/generate_script.py create "Why sleep matters" \
  --topic "The science of sleep" --component-type explainer

# Generate outline
python scripts/generate_script.py outline --slug why-sleep-matters

# Generate all 3 acts
python scripts/generate_script.py script --slug why-sleep-matters

# Generate a single act
python scripts/generate_script.py script --slug why-sleep-matters --act 1
```

Output is written to local `./other/` (local storage fallback).

---

## 11. Error Handling

| Scenario                          | HTTP Code | Error Code          | Message                                                   |
|-----------------------------------|-----------|---------------------|-----------------------------------------------------------|
| Project not found                 | 404       | `not_found`         | "project not found"                                       |
| Storyboard not generated yet      | 400       | `storyboard_required`| "storyboard images must be generated before script"        |
| OpenRouter API fails (401/402/429)| 500       | `openrouter_error`  | "act act-1: OpenRouter error: ..."                        |
| OpenRouter key exhausted          | 500       | `openrouter_error`  | "all keys failed: ..."                                    |
| JSON parse failure (model output) | 500       | `json_parse_error`  | "model did not return valid JSON: ..."                    |
| Storage write failure             | 500       | `storage_error`     | "failed to store act script: ..."                         |
| Unknown act key                   | (silently skipped)  | —                   | Acts not in `acts` definition are ignored                 |

All errors are returned as structured JSON: `{"error": true, "code": "...",
"message": "...", "timestamp": "..."}`.

OpenRouter key rotation: up to 5 comma-separated keys in `OPENROUTER_API_KEY`.
On 401/402/429, the next key is tried. If all fail, a descriptive error is
returned explaining the token is likely expired or over-limit.

---

## 12. Go ↔ Python Parity

Both surfaces intentionally produce identical outputs from the same prompt
templates. Differences to be aware of:

| Feature                   | Go Backend            | Python Scripts         |
|---------------------------|-----------------------|------------------------|
| Storage backend           | Azure Blob or local   | Local `./other/` only  |
| Versioning                | Yes (v01, v02, …)     | No (overwrite only)    |
| Prompt audit store        | Yes (savePromptMsg)   | No                     |
| Editable templates        | Yes (prompts store)   | Yes (same seed/load)   |
| Storyboard context inject | Hard-prepended header | Rendered via `{{storyboard_prompts}}` |
| Multiple providers        | Yes (openrouter, deepseek) | No (openrouter only) |
| Compare mode              | Yes (parallel A/B)    | No                     |

---

## 13. Configuration

| Env Variable               | Default                     | Description                            |
|----------------------------|-----------------------------|----------------------------------------|
| `OPENROUTER_API_KEY`       | (required)                  | Comma-separated API keys for rotation  |
| `OPENROUTER_TEXT_MODEL`    | `google/gemini-3.5-flash`   | Model ID for text generation           |
| `DEEPSEEK_API_KEY`         | (optional)                  | Key for comparison/deepseek provider   |
| `AZURE_STORAGE_CONNECTION_STRING` | (optional)           | Switches storage to Azure Blob         |
