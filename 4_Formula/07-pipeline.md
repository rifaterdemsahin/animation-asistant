# 07 — Pipeline (Generation Flow)

## End-to-End Flow

```
Project Creation
    │
    │  POST /api/projects  {title, topic, component_type, question, answer, why}
    │  → Creates project.json with 3 act status slots
    │
    ▼
Phase 1: Outline (project-level)
    │
    │  POST /api/projects/{slug}/outline
    │  → Loads editable template from prompts store
    │  → Renders: {{topic}}, {{component_type}}
    │  → Chat: OpenRouter → google/gemini-2.5-flash
    │  → Extracts JSON: {acts: {act-1: {summary, title}, act-2: ..., act-3: ...}}
    │  → Stores: outline.json
    │  → Marks all acts: outline = "done"
    │  → Saves prompt audit: prompts/<ts>-outline-outline.json
    │
    ▼
Phase 2: Script (per act)
    │
    │  POST /api/projects/{slug}/script  {acts: ["act-1","act-2","act-3"]}
    │
    │  For each act:
    │    → Loads editable template from prompts store
    │    → Reads outline summary for this act
    │    → Reads storyboard_prompts if available (feedback loop)
    │    → Renders: {{topic}}, {{act_key}}, {{act_role}}, {{summary}}, {{purpose}},
    │               {{storyboard_prompts}}
    │    → Chat: OpenRouter → google/gemini-2.5-flash
    │    → Extracts JSON: {narration: "...", beats: [{id, text}]}
    │    → Stores: <act-slug>/script/act.md (markdown)
    │    → Stores: <act-slug>/script/beats.json (structured)
    │    → Marks act: script = "done"
    │    → Saves prompt audit: prompts/<ts>-<act>-script.json
    │
    ▼
Phase 3: Components (per act × type)
    │
    │  POST /api/projects/{slug}/components  {acts: [...], types: [...]}
    │
    │  For each act:
    │    For each type (default: all 9):
    │      → Loads beats from <act-slug>/script/beats.json
    │      → Renders image prompt: {{style}}, {{beat}}, {{topic}}
    │      → Generate image: OpenRouter → google/gemini-3-pro-image
    │      → Stores: <act-slug>/components/<slug>-<type>-NN.png
    │      → Builds component entry: {id, type, prompt, file, script_ref}
    │    → Stores: <act-slug>/components/components.json (manifest array)
    │    → Marks act: components = "done"
    │    → Saves prompt audit per component
    │
    ▼
Phase 4: Audio (per act)
    │
    │  ┌─ Voiceover ──────────────────────────────────┐
    │  │  POST /api/projects/{slug}/audio              │
    │  │  For each act:                                │
    │  │    → Reads narration from beats.json          │
    │  │    → TTS: ElevenLabs (eleven_turbo_v2_5,      │
    │  │      voice "George")                          │
    │  │    → Stores: <act-slug>/audio/narration.mp3   │
    │  │    → Marks act: audio = "done"                │
    │  └──────────────────────────────────────────────┘
    │
    │  ┌─ Music ──────────────────────────────────────┐
    │  │  POST /api/projects/{slug}/audio/music         │
    │  │  For each act:                                │
    │  │    → Renders: {{genre}}, {{mood}},            │
    │  │      {{act_role}}, {{topic}}                  │
    │  │    → fal.ai: fal-ai/mmaudio-v2                │
    │  │    → Stores: <act-slug>/audio/music.mp3       │
    │  └──────────────────────────────────────────────┘
    │
    │  ┌─ SFX ────────────────────────────────────────┐
    │  │  POST /api/projects/{slug}/audio/sfx           │
    │  │  For each act:                                │
    │  │    For each of 3 SFX types (whoosh/ding/      │
    │  │    reveal):                                   │
    │  │      → Renders: {{desc}}                      │
    │  │      → fal.ai: fal-ai/stable-audio            │
    │  │      → Stores: <act-slug>/audio/sfx-<n>-NN.mp3│
    │  └──────────────────────────────────────────────┘
    │
    ▼
Phase 5: Storyboard (project-level)
    │
    │  POST /api/projects/{slug}/storyboard
    │    {act_prompts: {"act-1": "override...", ...}}
    │
    │  ┌─ JSON Scene Plan ────────────────────────────┐
    │  │  → Assembles context from all act scripts +    │
    │  │    components + outline                        │
    │  │  → Chat: OpenRouter → google/gemini-2.5-flash │
    │  │  → Extracts scene-by-scene JSON               │
    │  │  → Stores: storyboard/storyboard.json          │
    │  └──────────────────────────────────────────────┘
    │
    │  ┌─ Per-Act Images (parallel) ──────────────────┐
    │  │  For each act (goroutine):                     │
    │  │    → Renders image prompt from template        │
    │  │      (or uses act_prompts override from UI)    │
    │  │    → Renders: {{topic}}, {{question}},         │
    │  │      {{answer}}, {{why}}, {{act_key}},         │
    │  │      {{act_title}}, {{act_role}},              │
    │  │      {{act_summary}}, {{act_script}}           │
    │  │    → Generate image: OpenRouter                │
    │  │    → Stores: storyboard/storyboard-<act>-NN.png│
    │  │    → Versioned: never overwrites, new ID       │
    │  │  → Waits for all goroutines                    │
    │  │  → Stores: storyboard/versions.json            │
    │  └──────────────────────────────────────────────┘
    │
    │  → Saves executed prompts back to project:
    │    project.storyboard_prompts = {act-1: "...", act-2: "...", act-3: "..."}
    │
    ▼
Storyboard → Script Feedback Loop
    │
    │  On next script generation:
    │    → Reads project.storyboard_prompts
    │    → Injects storyboard image prompts into script system prompt
    │    → Script model can reference visual context
    │    → Creates tighter script-visual alignment
    │
    ▼
Download → Canva → Self-Learning Loop
```

## Prompt Audit Trail

Every AI generation call saves the complete prompt for reproducibility:

```
savePrompt(slug, act, step, prompt string)
  → prompts/<timestamp>-<act>-<step>.json

savePromptMsg(slug, act, step, msgs []orMessage)
  → Formats system + user messages into text
  → Calls savePrompt with formatted text
```

### Audit Coverage

| Step | Handler | Saved As |
|------|---------|----------|
| Outline | `generateOutline` | `prompts/<ts>-outline-outline.json` |
| Script (per act) | `generateAct` | `prompts/<ts>-<act>-script.json` |
| Components (per type) | `generateComponents` | `prompts/<ts>-<act>-component-<type>.json` |
| Voiceover TTS | `generateAudio` | (implicit via narration text) |
| Music | `generateMusic` | `prompts/<ts>-<act>-music.json` |
| SFX (per type) | `generateSFX` | `prompts/<ts>-<act>-sfx-<name>.json` |
| Storyboard JSON | `generateStoryboard` | `prompts/<ts>-storyboard-storyboard.json` |
| Storyboard images | `generateStoryboard` | Stored in `versions.json` as `image_prompt` field |

## Editable Prompts

Prompts are not hardcoded — they can be edited live:

```
Compiled Go Defaults (server/prompts.go)
    │  (first run)
    ▼
Azure "prompts" container  (or local other/_prompts/)
    │  (editing)
    ▼
GET/PUT /api/prompts/{id}  ←  /pages/prompts.html UI
    │  (on use)
    ▼
renderTmpl(template, vars) → interpolated prompt string
```

### Prompt Template Categories

| Category | Templates | Variables |
|----------|-----------|-----------|
| `outline` | `outline_system`, `outline_user` | `{{topic}}`, `{{component_type}}` |
| `script` | `script_system`, `script_user` | `{{topic}}`, `{{act_key}}`, `{{act_role}}`, `{{summary}}`, `{{purpose}}`, `{{storyboard_prompts}}` |
| `components` | Styles map + `components_image` | `{{style}}`, `{{beat}}`, `{{topic}}` |
| `audio_music` | Template + defaults for genre/mood | `{{genre}}`, `{{mood}}`, `{{act_role}}`, `{{topic}}` |
| `audio_sfx` | Template + SFX type list | `{{desc}}` |
| `storyboard` | `storyboard_system`, `storyboard_user` + per-act templates | `{{context}}`, `{{topic}}`, `{{question}}`, `{{answer}}`, `{{why}}`, `{{act_key}}`, `{{act_title}}`, `{{act_role}}`, `{{act_summary}}`, `{{act_script}}` |

## External API Integration

### OpenRouter
- Base URL: `https://openrouter.ai/api/v1` (configurable via `OPENROUTER_BASE`)
- Chat: `POST /chat/completions` with `{"model": ..., "messages": [...]}`
- Multi-key rotation: comma-separated `OPENROUTER_API_KEY`
- Rotates on 401, 402, 429 — tries each key in order
- Error on all keys exhausted: explains token likely expired/over-limit
- Model defaults: text `google/gemini-2.5-flash`, image `google/gemini-3-pro-image`
- Storyboard image model: `STORYBOARD_IMAGE_MODEL` env override (falls back to image model)

### ElevenLabs
- TTS endpoint: `https://api.elevenlabs.io/v1/text-to-speech/{voice_id}`
- Voice ID: `JBFqnCBsd6RMkjVDRZzb` ("George" — Warm Storyteller)
- Model: `eleven_turbo_v2_5`
- Key: `TTS_API_KEY` env var
- Accepts: `audio/mpeg` output format

### fal.ai
- Music endpoint: `fal-ai/mmaudio-v2`
- SFX endpoint: `fal-ai/stable-audio`
- Key: `FAL_KEY` env var
- Models may change; configurable via code updates

## Error Resilience

- **Per-act independence:** each act generates separately; failure in one act doesn't affect others already generated
- **Partial progress:** if act-1 and act-2 generate successfully but act-3 fails, the first two acts' files are saved; handler returns 500 with error context
- **No automatic retry:** handler returns on first failure; retry must be triggered by the user
- **Idempotent writes:** re-generating the same component overwrites the file; storyboard images are versioned (never overwrite)
- **Storage errors:** carry operation + slug + path in error message for debugging
