# 02 — Backend (Go Server)

## Entry Point: `server/main.go`

```
main()
  ├── godotenv.Load()                         # .env → os.Getenv
  ├── LoadConfig()                            # Config from env vars
  ├── storage.New()                           # Azure (if AZURE_STORAGE_CONNECTION_STRING set) else Local
  ├── App{cfg, store, orClient, startedAt}    # Shared dependencies
  ├── NewPromptStore()                        # Editable prompt templates
  │     └── Azure "prompts" container or local other/_prompts/
  ├── app.routes() ↦ http.ListenAndServe
  └── Logs warnings for missing ADMIN_PASSWORD / OPENROUTER_API_KEY
```

## File Map

| File | Lines | Purpose |
|------|-------|---------|
| `main.go` | 58 | Entry point: config, storage init, HTTP serve |
| `app.go` | 114 | App struct, route table, auth middleware, static serving, content-type |
| `config.go` | 122 | Config struct, LoadConfig from env, HMAC token create/validate |
| `auth.go` | ~30 | Login/logout handlers, cookie-based auth |
| `acts.go` | 33 | 3-act structure: act-1 problem, act-2 solution, act-3 lesson |
| `script.go` | 227 | Outline + per-act script generation via OpenRouter |
| `components.go` | 147 | Typed component image generation per act |
| `audio.go` | 264 | TTS voiceover (ElevenLabs), music (fal.ai), SFX (fal.ai) |
| `elevenlabs.go` | ~60 | ElevenLabs HTTP client: text-to-speech |
| `fal.go` | ~80 | fal.ai client: music + sound effects |
| `openrouter.go` | ~150 | OpenRouter client: multi-key rotation, text + image |
| `storyboard.go` | 369 | Storyboard: JSON scene assembly + per-act image generation |
| `prompts.go` | ~120 | Prompt template store: compiled defaults + Azure/local storage |
| `prompts_api.go` | ~80 | REST API for editing prompts: list, get, update, reset |
| `errors.go` | ~70 | Error ring buffer, recover middleware, /api/errors endpoint |
| `healthz.go` | ~30 | GET /healthz — service status |
| `projects.go` | ~150 | Project CRUD: create, read, update, delete, list |
| `util.go` | ~30 | Shared helpers |
| `jsonx.go` | ~20 | JSON write helpers, content-type detection |
| `main_test.go` | ~50 | Unit tests: page reachability, API endpoints |
| `storyboard_test.go` | ~30 | Storyboard-specific tests |
| `prompts_test.go` | ~20 | Prompt tests |
| `storage/storage.go` | 231 | Backend interface + Local + Azure implementations |

## Route Table (from `app.go:routes()`)

### Public (no auth)
| Method | Path | Handler | Purpose |
|--------|------|---------|---------|
| GET | `/healthz` | `a.healthz` | Service health + storage backend name + commit SHA |
| GET | `/api/errors` | `a.listErrors` | Recent error ring buffer |
| POST | `/api/login` | `a.login` | Cookie-based admin login |
| POST | `/api/logout` | `a.logout` | Clear auth cookie |

### Authed (cookie required)
| Method | Path | Handler | Purpose |
|--------|------|---------|---------|
| GET | `/api/me` | `a.me` | Auth check (returns 200 if valid) |
| GET/POST | `/api/projects` | `listProjects`/`createProject` | List all, create new |
| GET/PUT/DELETE | `/api/projects/{slug}` | `getProject`/`updateProject`/`deleteProject` | Single project CRUD |
| POST/GET | `/api/projects/{slug}/outline` | `generateOutline`/`getOutline` | Project-level outline |
| POST/GET | `/api/projects/{slug}/script` | `generateScript`/`getScript` | Per-act script generation |
| POST/GET | `/api/projects/{slug}/components` | `generateComponents`/`getComponents` | Per-act typed component images |
| POST/GET | `/api/projects/{slug}/audio` | `generateAudio`/`getAudio` | Per-act TTS voiceover |
| POST/GET | `/api/projects/{slug}/audio/music` | `generateMusic`/`getMusicStatus` | Per-act background music |
| POST/GET | `/api/projects/{slug}/audio/sfx` | `generateSFX`/`getSFXStatus` | Per-act sound effects |
| POST/GET | `/api/projects/{slug}/storyboard` | `generateStoryboard`/`getStoryboard` | JSON + per-act images |
| GET/PUT | `/api/prompts` · `/api/prompts/{id}` | Prompt editing API | Editable prompt templates |
| POST | `/api/prompts/{id}/reset` | Prompt reset | Restore compiled default |
| GET | `/api/projects/{slug}/browse` | `browseFiles` | List project files |
| GET | `/api/projects/{slug}/raw/{path...}` | `serveRaw` | Stream asset (image/audio) |

### Static Frontend
| Method | Path | Handler | Purpose |
|--------|------|---------|---------|
| GET | `/` (catch-all) | `http.FileServer` | Static HTML/CSS/JS from `web/` |

## Auth Model

```
POST /api/login  {password: "..."}
  → validates against ADMIN_PASSWORD env var
  → sets "auth" cookie: hex(expiry_payload).HMAC_SHA256(payload, AUTH_SECRET)
  → HttpOnly, SameSite=Lax, 7-day expiry
  → Cookie NOT "Secure" (allows local http://localhost)

authed() middleware:
  → reads "auth" cookie
  → calls cfg.ValidToken(cookie) → validate HMAC + expiry
  → 401 "unauthorized" on failure
```

## Config Structure

```go
type Config struct {
    AdminPassword         string   // ADMIN_PASSWORD
    AuthSecret            string   // AUTH_SECRET (falls back to AdminPassword)
    OpenRouterKeys        []string // OPENROUTER_API_KEY, comma-separated
    OpenRouterTextModel   string   // OPENROUTER_TEXT_MODEL (default: google/gemini-2.5-flash)
    OpenRouterImageModel  string   // OPENROUTER_IMAGE_MODEL (default: google/gemini-3-pro-image)
    StoryboardImageModel  string   // STORYBOARD_IMAGE_MODEL (optional override)
    OpenRouterBase        string   // OPENROUTER_BASE (default: https://openrouter.ai/api/v1)
    ElevenLabsKey         string   // TTS_API_KEY
    ElevenLabsVoice       string   // TTS_VOICE (default: JBFqnCBsd6RMkjVDRZzb = "George")
    ElevenLabsModel       string   // TTS_MODEL (default: eleven_turbo_v2_5)
    FalKey                string   // FAL_KEY
    AzureConnString       string   // AZURE_STORAGE_CONNECTION_STRING
    AzureContainer        string   // AZURE_CONTAINER (default: "projects")
    AzurePromptsContainer string   // AZURE_PROMPTS_CONTAINER (default: "prompts")
    WebDir                string   // WEB_DIR (default: "web")
    OtherDir              string   // OTHER_DIR (default: "other")
    Port                  string   // PORT (default: "8080")
}
```

## OpenRouter Client (`openrouter.go`)

- Multi-key rotation: `OPENROUTER_API_KEY` split by `,`
- On 401/402/429 → rotates to next key, retries
- If all keys fail → descriptive error about expired/over-limit tokens
- Two methods: `chatText()` (text models), `generateImage()` (image models)
- Prompts are rendered from editable templates via the `prompts` store
- All calls log to OpenRouter dashboard (X-Title: animation-assistant-fly)

## ElevenLabs Client (`elevenlabs.go`)

- `a.tts(text string) → ([]byte, error)` — text-to-speech MP3
- Voice: "George" (warm storyteller), model: `eleven_turbo_v2_5`
- Key from `TTS_API_KEY` env var

## fal.ai Client (`fal.go`)

- `a.falMusic(prompt string) → ([]byte, error)` — background music via `fal-ai/mmaudio-v2`
- `a.falSFX(prompt string) → ([]byte, error)` — sound effects via `fal-ai/stable-audio`
- Key from `FAL_KEY` env var
- Model IDs configurable; may need updates if deprecated

## Generation Handlers

### Outline (`script.go:17-59`)
- Project-level 3-act outline
- Calls OpenRouter with outline template → extracts JSON
- Stores `outline.json` at project root
- Marks all acts: `outline: "done"`

### Script (`script.go:83-134`)
- Per-act script generation
- Accepts `acts` array (defaults to all 3)
- For each act: renders prompt with act role + summary → calls OpenRouter → extracts JSON
- Stores `act.md` (markdown) + `beats.json` (structured: {narration, beats[]})
- Supports storyboard feedback loop: reads `storyboard_prompts` from project to inject image context

### Components (`components.go:15-87`)
- Per-act typed component image generation
- Accepts `acts` array + `types` array (defaults to all 9 types if not specified)
- For each act × type: renders image prompt from template → calls `generateImage()`
- Names files: `<slug>-<type>-NN.png`
- Saves `components.json` manifest per act
- Each component has: `id`, `type`, `prompt`, `file`, `script_ref`

### Audio (`audio.go`)
- **Voiceover** (`:16-59`): reads narration from beats.json → TTS → `narration.mp3`
- **Music** (`:108-158`): renders music prompt → fal.ai → `music.mp3`
- **SFX** (`:165-212`): generates 3 preset SFX types per act → `sfx-<name>-NN.mp3`

### Storyboard (`storyboard.go`)
- **Phase 1 (text):** assembles scene JSON from all act scripts + components → stores `storyboard/storyboard.json`
- **Phase 2 (images):** generates 3 PNGs in parallel (one per act) → `storyboard/storyboard-<act>-NN.png`
- Versioned: each generation creates new files with incrementing IDs (never overwrites)
- `versions.json` tracks all generations per act
- Accepts `act_prompts` overrides from UI for per-act prompt editing
- Stores executed prompts back to `project.json` as `storyboard_prompts`

## Prompt Templates (`prompts.go`)

- Compiled Go defaults for: outline, script, components (styles + template), audio (TTS + music + SFX), storyboard (JSON + per-act image)
- Stored in Azure `prompts` container (or local `other/_prompts/`)
- Editable live at `/pages/prompts.html` via REST API
- Fallback: in-memory defaults if store init fails
- Templates use `{{variable}}` syntax, rendered with `renderTmpl()`

## Error Handling (`errors.go`)

- `recoverMiddleware`: catches panics, logs, returns 500
- `errorRing`: thread-safe ring buffer of last N errors
- `writeError()`: writes structured JSON error: `{error: true, code, message, timestamp}`
- `GET /api/errors`: returns recent errors for diagnostics
