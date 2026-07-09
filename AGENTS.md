# AGENTS.md — Guidance for AI coding agents working on this repo

Read before changes. *What* we build = **SPEC.md**; *how* = this file; status =
**risks.md**. App is live at https://animation-assistant.fly.dev/.

## 1. What this is

Animation Assistant builds animation **components** for Canva on a 3-act
structure. Two generation surfaces, by design (not duplication):
- **Go backend** (`server/`) — browser generation on fly.io, writes to **Azure
  Blob** (`projects` container); calls OpenRouter (text+images) + ElevenLabs.
- **Python scripts** (`scripts/`) — local generation triggered by the AI agent,
  writes to local `./other`.

Flow per project: **outline → script → components → audio → storyboard**.
After storyboard, the executed image prompts are saved back to the project
(`storyboard_prompts` field), which the script generator reads on subsequent
runs to produce storyboard-aware scripts. This creates an optional feedback
loop: **storyboard → script (re-generate with storyboard context)**.

## 2. Hard rules

- **Three acts:** act-1 Problem, act-2 Solution, act-3 Lesson. Outline is
  project-level; script/components/audio are per act. Never a single flat script.
- **Typed components** (background, lower-third, speech-bubble, infographic,
  …) each referencing a script beat (`script_ref`).
- **Naming prefix:** `<slug>-<type>-NN.<ext>`.
- **Shared shell on every page:** top nav (links+search+logout), current-project
  header, footer. Pages render into `#topnav`/`#app-header`/`#app-footer` and
  include `layout.js` + `auth.js`.
- **Modals reuse the shared CSS** (`.modal-overlay` / `.modal` /
  `.modal-header|body|footer` already in `styles.css`, see `projects.js`
  `buildEditModal`). Don't invent a new overlay — build a `<div class="modal-overlay">`
  and close on ✕ / backdrop / `Esc`. The Media Manager **📁 Generated Files**
  browser uses this for its asset preview modal.
- **Generated Files browser** (Media Manager `media-manager.js` `loadBrowse`):
  every asset card has **⬇️ Download** (blob → real filename), **📋 Copy**
  (context-aware: image data / text / URL, fallback URL), and **🔍 View**
  (modal popup). Keep new asset surfaces consistent with these three actions.
- **Model visibility + 3-type audio:** every Media Manager step shows the model
  it triggers via a `.model-badge` filled from `GET /api/models`. The **§4 Audio**
  section has 3 independent layers — voiceover (ElevenLabs), music (fal.ai),
  SFX (fal.ai) — each with 👁️ Show Prompt / ⚡ Generate Prompt / 🚀 Execute.
- **Secrets only via env** (`.env` local via KeyVault; `fly secrets` on fly.io).
  Never log secrets. Basic admin login (cookie auth) by design.
- **Storage via the Backend interface** — handlers use `a.store`, never raw paths.

## 3. Repo map

```
server/           Go backend (main): app, config, auth, openrouter (rotation+
                  image), elevenlabs, components, audio, storyboard, projects,
                  script, acts, healthz, util, errors, prompts (+ editable
                  store/api) (+ main_test.go)
server/storage/   Backend interface + Local + Azure (azblob SDK)
web/              static frontend; assets/js/{layout,auth,media-manager,
                  storyboard,projects,dashboard}.js ; pages/
scripts/          Python local generators (script/components/audio/storyboard)
shared/           Python helpers (config, acts, openrouter, elevenlabs,
                  components, audio, storyboard, storage)
fly.toml/Dockerfile/.dockerignore   fly.io deploy (Go+Python image)
.env.example      documented keys; .env is gitignored
```

## 4. Run / deploy

When asked to "open local" or "run locally":
```bash
go run ./server                                   # local: http://localhost:8080
open -a "Google Chrome" "http://localhost:8080"   # always open in Chrome, not default browser
```

When asked to "deploy" or "ship to fly.io":
```bash
fly deploy                                        # fly.io (secrets already set)
```

When asked to do both ("open local + deploy"), run the server in background and
deploy in parallel, then open Chrome once the server is ready.

Models (min Gemini 3 for text+image): text `google/gemini-3.5-flash`,
image `google/gemini-3-pro-image`, TTS ElevenLabs `eleven_turbo_v2_5` / voice
"George", music `fal-ai/mmaudio-v2`, SFX `fal-ai/stable-audio`. Active models
are exposed at `GET /api/models` and shown inline as `.model-badge` pills on the
Media Manager. Override via env.

## 5. Known gotchas

- Setting `AZURE_STORAGE_CONNECTION_STRING` switches to Azure (container auto-
  created). Without it, local `./other` is used (ephemeral on fly.io).
- `.env` values containing `;` (Azure conn string) must be **quoted** when
  sourcing; the committed `.env.example` and the KeyVault script quote them.
- OpenRouter 401/402/429 rotates to the next comma-separated key; if all fail,
  the error explains the token is likely expired/over-limit.
- Go + Python prompts are intentionally parallel (dual-mode); keep both in sync.
  Both now read editable templates from a `prompts` store (Azure container
  `prompts` on fly.io, local `other/_prompts` otherwise), seeded with the
  compiled defaults. Edit live at `/pages/prompts.html` (API `/api/prompts`).

## 6. When in doubt
Re-read SPEC.md + risks.md. Ask before expanding scope.
