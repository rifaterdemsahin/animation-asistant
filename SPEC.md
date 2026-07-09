# Animation Assistant — Project Specification

> Status: **v3 — all phases complete, live at https://animation-assistant.fly.dev/** 🚀
> This document defines what we built and what's next.

## 1. Overview 🎬

**Animation Assistant** is an HTML-based, multi-tool web app that helps build
animations. It orchestrates AI generation (script, images, audio) and assembles
them into storyboards that can be turned into animation components.

The **Go backend** holds all secrets and serves the static frontend + REST API. It is
deployed to fly.io. Locally it reads a gitignored `.env` file for secrets.
**Python scripts** under `scripts/` are triggered by the user (CLI or via LLM
tooling) to generate content; they do NOT hold secrets — they call into the Go
API or share the same OpenRouter pipeline. The Go runtime is the single source
of truth for configuration and secrets.
It gets deployed to fly.io and github pages gets redirected to fly.io.

The app is a collection of focused **tools** that all share a common UI shell
(top menu + bottom footer). It serves multiple animation projects which have
their data and metadata hosted in **Azure Blob Storage**. Credentials are pulled
from the terminal via `az secrets` and placed into `.env` (local) and
`fly secrets` (deployed). A single project can produce many different kinds of
animation components, and every animation component is kept isolated so it is
easier to use in Canva video timelines where they turn into final animations.

**This project is focused on production of assets for Canva.** It is NOT a video
editor — Canva handles final post-production. The self-learning process happens
when generated content is arranged in Canva to create an aesthetic learning
experience. See the [🔄 Production Process](/pages/process.html) page for the
full pipeline.

## 2. Goals 🎯

- Provide a unified web UI for animation production tasks for its components.
- namings for the items come with project name as prefix.
- Generate **scripts** 📝, **images** 🖼️, **music** 🎵, **sound effects** 🔊, and **voiceover audio** 🎙️ from a single Media Manager.
- Whole goal is to leverage the large language models capacaity to trigger self learning process.
- Self learning happens when generated content is placed in canva and created an aestethic learning experience.
- Generate a **storyboard** 📋 from a script + images using OpenRouter calls to Gemini or other related models.
- Keep each animation project isolated in its own folder under the azure storage ☁️.
- Have an an admin login 🔐 and keep that password in .env file so not everyone should be able to trigger have a login page in a common menu.
- Run locally 💻 and deploy to **fly.io** 🚀 with the same secrets model.
- Share a consistent layout (top menu + footer) across every page which has the links to all the tools and have search 🔍 to be able find pages.

## 3. Non-Goals (for now) 🚫

- Full timeline/keyframe video editing UI this is delegated to canva which does the final post production
- Real-time collaboration we only focus on production and self learning in the process.
- Account/auth system (single-user tool for the owner) and there is a canva video project link that gets saved. 

## 4. Architecture (high level) 🏗️

```
┌─────────────────────────────────────────────────────────────┐
│  Browser  (HTML pages, shared top menu + footer + debug bar)│
│   • Dashboard   • Media Manager   • Storyboard Creator ...  │
└───────────────────────────┬─────────────────────────────────┘
                            │ HTTP / fetch
┌───────────────────────────▼─────────────────────────────────┐
│  Backend  (Go — thin API/orchestration layer)               │
│   - Serves static frontend + REST API                       │
│   - Reads secrets from environment (.env local / fly secrets)│
│   - Calls OpenRouter (Gemini) for AI generation             │
│   - Writes/reads project data to Azure Blob Storage         │
│   - Central error handling middleware + /api/errors endpoint │
└───────────────────────────┬─────────────────────────────────┘
                            │
        ┌───────────────────┼────────────────────────┐
        ▼                   ▼                        ▼
   Python scripts       OpenRouter API         Azure Blob Storage
   (CLI generation      (Gemini models)        (project data +
    tools, callable                            generated assets)
    by LLM tooling)
```

- **Frontend**: static HTML/CSS/JS. A small shared layout helper injects the
  common top menu, footer, and **debug bar** into every page so all pages stay
  consistent. It follows the project → outline → script → assets order.
  Header displays which project is currently active.
- **Backend**: a Go server that serves static files, exposes REST API endpoints,
  orchestrates AI generation via OpenRouter, and persists data to Azure Blob
  Storage. Secrets never leave the Go runtime.
- **Storage**: all generated artifacts live in Azure Blob Storage, organized in
  a subfolder per animation project. The storage backend interface supports
  multiple implementations (local filesystem fallback for dev, Azure for prod).
- **Python workers**: standalone scripts under `scripts/` for CLI/local generation.
  They can be called directly for local testing or by LLM tooling. They do not
  hold secrets — they use the same storage interface (local or Azure) and may call
  the Go API for generation.

## 5. Tools 🛠️

### 5.1 Media Manager (the orchestrator) 🎛️
The central tool that produces the raw materials for an animation. It generates:
1. **Outline** — text/script for the storyboard via OpenRouter (Gemini models).
1. **Script** — text/script produced via OpenRouter (Gemini models). Also saves a clean
   **voiceover** version (`voiceover.txt`) per act — narration only, no markdown
   formatting — ready for TTS. A **Copy Voiceover Script** button copies all
   acts into clipboard.

   #### Storyboard-Script Consistency 🔗
   When a **storyboard** has been generated before running the script step, the
   per-act storyboard **images** are loaded and displayed on the Script page as
   a **Storyboard Context** section (above Act Selection). The AI is provided with:
   - The per-act **image prompts** (what each storyboard image depicts)
   - The per-act **image file references** (which images exist)
   - An explicit **STORYBOARD CONSISTENCY header** instructing narration to match
     the visual elements, composition, and style precisely
   This cross-phase feedback loop ensures every downstream phase receives the
   output of prior phases as input:
   - **Storyboard → Script**: storyboard images + prompts injected as context
   - **Outline → Script**: act summaries fill `{{summary}}` in the prompt
   - **Q&A → Script**: question/answer/why passed as project metadata
   The Script page displays the storyboard images so the user can visually verify
   alignment. Re-generating the script picks up the latest storyboard images
   automatically.
2. **Images** — visuals produced by the image generator (Python script).
3. **Audio** — voiceover/sound produced by the audio generator (Python script).

The Media Manager lets you pick/create a project, then run each generation step
per **act** (see §5.1.1) and see the results.

#### 5.1.1 Three-Act narrative structure 🎭
Every project is built on a fixed **three-act** story structure. Generation
(script → images → audio) runs **per act**, and each act has one defined role:

| Act  | Role      | What it must convey                                   |
|------|-----------|-------------------------------------------------------|
| Act 1| **Problem**  | Set up the world and the problem/pain the audience feels. |
| Act 2| **Solution** | Introduce the solution; show how the problem is resolved. |
| Act 3| **Lesson**   | The takeaway / moral / insight the audience leaves with.  |

- Script generation produces three act scripts (`act-1`, `act-2`, `act-3`),
  each tagged with its role.
- For each act, **components** are generated from that act's script beats (see
  §5.1.2); audio is generated from the act script.
- `project.json` stores the topic and any per-act prompts/overrides.

#### 5.1.2 Components (typed visual parts) 🧩
For each act we generate **components**, not random images. A **component** is a
visual part that relates to a specific beat/moment of the act's script and that
plays a defined **role** in the video. Each component has a `type` that tells
how it demonstrates the act:

| Type           | What it does in the video                                  |
|----------------|------------------------------------------------------------|
| `background`   | full-frame scene backdrop for a beat                       |
| `lower-third`  | text/label bar overlay (names, captions, stats)           |
| `speech-bubble`| dialogue / quote / thought callout                         |
| `infographic`  | data / numbers / diagram visualizing a point              |
| `character`    | on-screen figure / subject / mascot                        |
| `icon`         | small symbolic graphic accent                              |
| `title-card`   | full-screen heading for the act or a key line              |
| `transition`   | animated connecting element between beats                  |
| *(extensible)* | new types can be added without changing the pipeline       |

- Each component carries metadata: `id`, `type`, `prompt`, `file`, and the
  `script_ref` (which script beat it illustrates).
- **Per-component control** (Media Manager → *3. Components*): instead of one
  shared prompt for the whole step, **each component** is its own object with
  its own **👁️ Prompt** button and its own **⚡ Generate** button. The Prompt
  button reveals the exact image prompt for that component — rendered from the
  `image_prompt` template using that type's `style` and the act's beat (the
  stored prompt is shown once the component has been generated). The Generate
  button regenerates **just that one component** via
  `POST /api/projects/{slug}/components` with a single `acts:[act]` +
  `types:[type]`. A separate **⚡ Generate all components** button bulk-creates
  every type for the selected acts.
- **Merge semantics**: regenerating a single component only replaces that type's
  entry in the act's `components.json`; every other already-generated type is
  preserved (never wiped). The beat used for each type is its **canonical index**
  in the default-type order, so generating one type in isolation still picks the
  correct beat (e.g. `infographic` alone uses beat-4, not beat-1).
- One act typically contains a **mix** of types (e.g. a `background` + a
  `lower-third` + an `infographic`) that together demonstrate the act.
- The image generator (`generate_image.py`) is type-aware: it takes a `--type`
  and adapts the prompt/style for that component type.
- Components are the building blocks the Storyboard assembles into scenes.
- Use json structures in Azure to hold the metadata and the data 

### 5.1.3 Generated Files Browser 📁
The Media Manager's **📁 Generated Files** section browses every asset the
project has produced (images, audio, JSON manifests, markdown). Each file is a
**card** with three actions, plus a **modal popup** for full-visibility review:

- **⬇️ Download** — fetches the blob and saves it under its real filename
  (so `act-1-problem/components/<slug>-bg-01.png` downloads as `...bg-01.png`).
- **📋 Copy** — context-aware clipboard copy:
  - **images** → the actual image data is written to the clipboard
    (`navigator.clipboard.write` + `ClipboardItem`), ready to paste straight
    into Canva/docs;
  - **JSON / markdown** → the file's text content is copied;
  - **audio / other** → the asset's full URL is copied (audio has no clipboard
    binary format). Any failure falls back to copying the URL.
- **🔍 View** (and clicking the thumbnail) → opens a **modal popup** showing a
  large preview of the asset (full-size image, audio player, or pretty-printed
  JSON/text), its storage path, and its URL, with the same Download / Copy /
  Copy-URL actions. The modal reuses the shared `.modal-overlay` / `.modal` CSS
  and closes on ✕, backdrop click, or `Esc`.

This is the primary way to pull assets out of the app into Canva without
dropping into the Azure Portal (the **☁️ View in Azure** link is still there for
bulk/blob-level access).

### 5.2 Storyboard Creator 📋
Takes the existing **act scripts** and the generated **components** for each
act, then produces a **storyboard** organized by act — a scene-by-scene plan
that places components (by type) against script beats with timing — using
**OpenRouter with Gemini models**. Output is saved into the project's
`storyboard/` folder as `storyboard.json` with sections `act-1` / `act-2` /
`act-3`, each scene referencing component `id`s (and therefore `type` + file).

#### 5.2.1 4-Frame Infographic 🖼️
In addition to the JSON storyboard, a **4-frame infographic PNG** is generated:
- **Frame 1** (top-left): Problem setup — visualizes the pain point
- **Frame 2** (top-right): Solution approach — introduces the key idea
- **Frame 3** (bottom-left): Implementation — shows how it works
- **Frame 4** (bottom-right): Lesson/takeaway — the insight the audience leaves with
- Arranged in a 2×2 grid, clean flat vector style, labels under each frame
- Saved as `storyboard/storyboard.png`

#### 5.2.2 Prompt Visibility 👁️
Every generation step on the **Storyboard page** has a **Show Prompt** button
that reveals the full prompt being sent to the model before generation. This
applies to both the JSON text prompt and the infographic image prompt.

### 5.3 Audio Tools 🎧
Audio is handled by two complementary systems:

#### 5.3.1 Voiceover / Narration 🎙️
Full-act narration voiceover via **ElevenLabs** TTS. One MP3 per act, stored at
`<act-slug>/audio/narration.mp3`. Voice defaults to "George" (warm storyteller),
model `eleven_turbo_v2_5`.

#### 5.3.2 Music Generation 🎵
Background music tracks generated via **fal.ai** (`fal-ai/mmaudio-v2` or similar).
Supports prompt-based generation (genre, mood, tempo). Stored per act as
`<act-slug>/audio/music.mp3`.

#### 5.3.3 Sound Effects 🔉
Spot sound effects (whooshes, dings, transitions) generated via **fal.ai**
(`fal-ai/stable-audio`). Each SFX is tied to a component or scene beat and stored
as `<act-slug>/audio/sfx-<id>.mp3`.

> All fal.ai keys come from **Azure KeyVault** and are set in `.env` locally +
> `fly secrets` for deployment. The `FAL_KEY` env var is read by both the Go
> server and Python scripts.

### 5.4 Project Creation Page 🆕
Dedicated page at `/pages/create.html` where users:

1. **Enter a question + answer** — the core topic framed as Q&A (e.g. "How does
   machine learning work? → It learns patterns from data").
2. **Single creation mode** 🧪 — generate one act or one full project for testing
   and feedback before bulk production.
3. **Bulk creation mode** ⚡ — generate all 3 acts (outline → script → components
   → audio → storyboard) for the full pipeline, optimized for Canva workflows.
4. **Progress visualization** — per-act status with pass/fail indicators.
5. **Prompt audit trail** — every prompt sent to the LLM is saved to Azure under
   `<slug>/prompts/<timestamp>-<step>.json` for debugging and reproducibility.

### 5.5 Production Process 🔄
Full pipeline documented at `/pages/process.html`:

| Step | Page | What happens |
|------|------|-------------|
| 1. 📝 Q&A | `/pages/create.html` | Frame topic as question + answer. Creates project. |
| 2. 📋 Storyboard | `/pages/storyboard.html` | Generate 3 infographic images (4 frames each, 2×2 grid) per act. JSON scene plan. Image prompts saved back to project. |
| 3. 🎛️ Assets | `/pages/media-manager.html` | Outline → Script → Typed Components → Voiceover → Music → SFX. All saved to Azure. |
| 3b. 🔄 Script page | `/pages/script-page.html` | Re-generate script with **storyboard images displayed** and image prompts + file references injected as consistency context. Each phase feeds the next (see §5.1 → Storyboard-Script Consistency). |
| 4. 📥 Download | Media Manager + Azure | Browse images/audio, **download** each asset, **copy** image/text/URL to clipboard, and **view** in a modal popup. Bulk/blob access via Azure Portal link. |
| 5. 🎨 Canva | canva.com | Place components into Canva video timeline. Arranging creates the self-learning loop. |

### 5.6 Self Learning & Bloom's Taxonomy 🎓
A dedicated page at **`/pages/self_learning.html`** (linked from Tools page + nav)
maps the AI animation production pipeline to Bloom's five cognitive levels:

| Level | Bloom's Taxonomy | Pipeline Activity | AI vs. Human |
|-------|-----------------|-------------------|--------------|
| 1. 🧠 Remember | Recall facts & concepts | Review AI-generated **images + infographics** | AI generates, you encode memory visually |
| 2. 📖 Understand | Explain ideas in own words | Read **script** + listen to **voiceover** | AI narrates, you internalize the message |
| 3. 🔍 Analyze | Break into parts | Decide **component types** (background, lower-third, etc.) per script beat | You decompose the narrative structure |
| 4. ⚖️ Evaluate | Judge, justify, arrange | Place components on the **Canva timeline** | You judge order, pacing, visual impact |
| 5. 🎨 Create | Produce new, polished work | **Mix** audio, transitions, effects + **polish** timing | You synthesize everything into a final animation |

> **The self-learning loop:** AI handles lower-order thinking (remember + understand)
> while the user owns higher-order thinking (analyze → evaluate → create). The Canva
> timeline becomes a playground for mastery — each arrangement decision deepens expertise.

> This project is focused on **production of assets** for Canva. It is NOT a
> video editor — Canva handles final post-production. The self-learning process
> happens when generated content is arranged in Canva to create an aesthetic
> learning experience.

## 6. Project & Data Model 📁

An **animation project** is a folder + a metadata file, organized by the fixed
**three-act** structure (Problem → Solution → Lesson). Per act, it holds a
script, a set of typed **components**, and audio.

```
<project-slug>/                     # one folder per animation (in Azure Blob Storage)
    ├── project.json                # metadata: topic, animation_type, acts status
    ├── outline.json                # project-level 3-act outline
    ├── act-1-problem/              # Act 1 — Problem
    │   ├── script/act.md           #   latest script + beats (markdown, overwritten each run)
    │   ├── script/beats.json       #   latest structured beat data (overwritten)
    │   ├── script/voiceover.txt    #   latest clean narration, TTS-friendly (overwritten)
    │   ├── script/versions.json    #   version manifest (never overwritten, append-only)
    │   ├── script/v01-act.md       #   versioned script (v01, v02, …; never overwritten)
    │   ├── script/v01-beats.json   #   versioned beat data
    │   ├── script/v01-voiceover.txt#   versioned voiceover
    │   ├── components/
    │   │   ├── components.json     #   manifest of typed components
    │   │   ├── <slug>-bg-01.png    #   type: background
    │   │   ├── <slug>-lt-01.png    #   type: lower-third
    │   │   ├── <slug>-bubble-01.png#   type: speech-bubble
    │   │   └── <slug>-info-01.png  #   type: infographic
    │   └── audio/narration.mp3
    ├── act-2-solution/             # Act 2 — Solution (same structure)
    ├── act-3-lesson/               # Act 3 — Lesson   (same structure)
    └── storyboard/
        └── storyboard.json         # scenes grouped by act, referencing component ids
```

- `components.json` (per act) is an array of components:
  `{ id, type, prompt, file, script_ref }` where `script_ref` points at the
  script beat the component illustrates.
- `project.json` holds: `slug`, `title`, `topic`, `animation_type`,
  `created_at`, `updated_at`, `status`, and a `acts` map keyed by
  `act-1` / `act-2` / `act-3` with each act's `role` (`problem` / `solution` /
  `lesson`) and per-act status.
- Each act is independent: you can generate/regenerate any single act
  (script, components, audio) without touching the others.
- **Scripts are versioned**: each Execute Prompt creates a new version (`v01`, `v02`, …)
  with its own `act.md`, `beats.json`, and `voiceover.txt`. The latest version
  always overwrites the root `script/act.md` etc. for backward compatibility.
  Versions are tracked in `script/versions.json` and displayed on the Script page
  grouped by act (newest first), with copy buttons per version.
- Storyboard `storyboard.json` references components by act + `id`, so the
  `type` and file are resolved through the component manifest.
- Each project is fully self-contained and portable (copy the folder).

### 6.1 Component manifest example (`components.json`)
```json
[
  {"id":"c01","type":"background","prompt":"...","file":"bg-01.png","script_ref":"beat-1"},
  {"id":"c02","type":"lower-third","prompt":"...","file":"lowerthird-01.png","script_ref":"beat-1"},
  {"id":"c03","type":"speech-bubble","prompt":"...","file":"bubble-01.png","script_ref":"beat-2"},
  {"id":"c04","type":"infographic","prompt":"...","file":"infographic-01.png","script_ref":"beat-3"}
]
```

## 7. Secrets 🔑

Secrets are **never committed**. They are provided through the environment and
read by the backend only.

| Key (placeholder)        | Where local           | Where deployed       | Used by                    |
|--------------------------|-----------------------|----------------------|----------------------------|
| `OPENROUTER_API_KEY`     | `.env`                | fly.io secret        | script + storyboard (Gemini)|
| `OPENROUTER_*` (model)   | `.env`                | fly.io secret        | default Gemini model id    |
| `IMAGE_API_KEY`          | `.env`                | fly.io secret        | `generate_image.py`        |
| `TTS_API_KEY`            | `.env`                | fly.io secret        | `generate_audio.py`        |
| `FLY_API_TOKEN`          | `.env` (or keychain)  | n/a (used to deploy) | `fly deploy` from local    |

- **Local**: a `.env` file (gitignored) is loaded by the server at startup.
- **Deployed**: secrets are set with `fly secrets set KEY=value` and injected at
  runtime; no `.env` exists on fly.io.
- A `.env.example` is committed (placeholders only) so the required keys are
  documented. Passwords/tokens live only in `.env` locally and in fly.io
  secrets remotely.

## 8. Deployment (fly.io) 🚀

- Deploy from the **local machine** using the existing fly CLI token
  (`fly auth whoami` → already authenticated).
- A `fly.toml` describes the app (one Python service).
- Deploy command: `fly deploy` (uses the local `FLY_API_TOKEN`).
- Runtime secrets are set once with `fly secrets set ...` and persist across
  deploys. New deploys never contain secrets in the image.
- The app is a single service: serves the static HTML **and** exposes the API.

## 9. Shared Layout 🖼️

Every page reuses:
- **Top menu** — links to Dashboard, Media Manager, Storyboard Creator, etc.
  plus a search bar. The Login link / Logout button is **conditional**: when
  not authenticated, a "🔐 Login" link appears; when authenticated, a
  "👤 Logged in" badge + a "Log out" button are shown. Auth status is
  determined by calling `/api/me` on page load.
- **Bottom footer** — project info / links / github build link/ commits link/ fly.io link and local link. The deploy-time badge shows `🚀 <commit-sha> — <started_at>` when deployed (commit set via `-ldflags="-X main.buildCommit=..."`), or `🚀 local — <started_at>` when running locally (`buildCommit` defaults to `"unknown"` which the frontend treats as no-commit).

Implemented with a small shared component (JS layout injection + shared CSS),
so a single edit updates all pages. No page is built from scratch; each page
just renders into the shared shell.

## 10. Central Error Handling 🛡️

### 10.1 Server runtime
- All handler panics are recovered by middleware — the server never crashes from
  a single request failure.
- All errors are returned as structured JSON: `{"error": true, "code": "...",
  "message": "...", "timestamp": "..."}`.
- Recent errors are buffered in-memory (ring buffer, last N entries) and exposed
  via `GET /api/errors` for diagnostics.
- OpenRouter failures are logged with the full request context (model, prompt
  prefix, status code, response snippet) so they can be debugged.
- Storage errors (Azure connectivity, permission denied, blob not found) carry
  the operation + slug + path in the error message.
- A `GET /healthz` endpoint reports which services are reachable (OpenRouter
  key present, Azure connection string present, active storage backend name).

### 10.2 Client runtime (debug bar)
Every page includes a **debug bar** component injected by `debug.js`:

- Collapsed by default at the bottom of the viewport; toggled with a
  `[Debug]` button in the footer.
- Captures and displays:
  - **Errors** — uncaught JS errors (`window.onerror`), failed fetch requests
    (non-2xx responses), and rejected promises (`unhandledrejection`).
  - **Actions** — user-triggered API calls with their method, URL, status code,
    and duration. Successful calls show green; failed calls show red.
- Each entry has a **Copy** button that copies the error/action details as a
  formatted block (timestamp, URL, method, status, response body) suitable for
  pasting into an AI agent for manual resolution.
- Entries are capped at the most recent 100, auto-rotating.
- The debug bar also has a **Clear** button and a **Pull server errors** button
  that fetches `GET /api/errors` and appends the server-side errors to the feed.

## 11. Repository Layout (planned) 📦

```
animation-asistant/
├── README.md
├── SPEC.md                  # this file
├── AGENTS.md                # agent/coding guidance
├── risks.md                 # known risks and TODOs
├── .env.example             # documented keys (placeholders only)
├── .gitignore
├── fly.toml                 # fly.io app definition
├── Dockerfile               # Go + Python runtime for deploy
├── go.mod / go.sum          # Go module dependencies
├── requirements.txt         # Python deps (for scripts/ + shared/)
├── web/                     # static frontend
│   ├── index.html
│   ├── assets/
│   │   ├── css/styles.css
│   │   └── js/
│   │       ├── layout.js     # shared top menu + footer + debug bar
│   │       ├── auth.js       # login + requireAuth gate
│   │       ├── debug.js      # client-side debug/error bar
│   │       ├── dashboard.js
│   │       ├── projects.js
│   │       └── media-manager.js
│   └── pages/
│       ├── login.html
│       ├── projects.html
│       └── media-manager.html
├── server/                  # Go backend (API + orchestration + static serving)
│   ├── main.go
│   ├── app.go
│   ├── config.go
│   ├── auth.go
│   ├── script.go
│   ├── projects.go
│   ├── acts.go
│   ├── openrouter.go
│   ├── jsonx.go
│   ├── healthz.go
│   ├── util.go
│   ├── errors.go            # central error handling / debug endpoint
│   └── storage/
│       └── storage.go       # Backend interface + Local impl + Azure impl
├── scripts/                 # standalone Python generation workers
│   └── generate_script.py
├── shared/                  # cross-cutting Python helpers (config, acts, openrouter, storage, scriptgen)
└── other/                   # local storage fallback (gitignored, dev only)
    └── .gitkeep
```

## 12. Tech Choices ⚙️

- **Frontend**: vanilla HTML/CSS/JS (no heavy framework) — pages are simple tool
  screens. Shared layout via a JS helper + shared CSS. Debug bar included on
  every page for runtime error visibility and AI-agent feedback.
- **Backend**: Go (stdlib-only). Serves static files + JSON endpoints. Central
  error handling middleware logs structured errors and exposes a `/api/errors`
  debug endpoint so AI agents can pull error context.
- **AI text/script/storyboard**: OpenRouter API → Gemini models.
- **Images**: a Python script calling an image generation API (Phase 3).
- **Audio**: a Python script calling a TTS API; ffmpeg available for slicing
  (Phase 4).
- **Storage**: Azure Blob Storage (primary). Local filesystem (`./other`) is a
  dev-only fallback when `AZURE_STORAGE_CONNECTION_STRING` is not set.
  Credentials pulled via `az secrets` on the terminal, placed in `.env` locally
  and `fly secrets` for deployment.
- **Deploy**: fly.io single machine, secrets via `fly secrets`.
- **Error handling**: structured JSON errors from the server, client-side debug
  bar that captures and displays errors/actions with copy-to-clipboard for
  feeding into AI agents for manual resolution.

## 13. Phased Plan 📅

| # | Phase | Status |
|---|-------|--------|
| 0 | 📄 Foundations — SPEC.md + AGENTS.md | ✅ Complete |
| 1 | 🏗️ Skeleton — Go backend, shared layout, auth, CRUD, Azure + Local storage | ✅ Complete |
| 2 | 📜 Script — Outline + per-act script generation (OpenRouter/Gemini) | ✅ Complete |
| 3 | 🖼️ Components — Typed component images per act (OpenRouter image model) | ✅ Complete |
| 4 | 🎧 Audio — TTS voiceover (ElevenLabs) + Music/SFX (fal.ai) | ✅ Complete |
| 5 | 📋 Storyboard — Scene-by-scene plan from scripts + components | ✅ Complete |
| 6 | 🚀 Deploy — fly.io, fly secrets, GitHub Pages redirect | ✅ Complete |
| 7 | 🛡️ Error handling — Central middleware, debug bar, /api/errors | ✅ Complete |
| 8 | 💾 Prompt audit — All prompts saved to Azure per project | ✅ Complete |

## 15. Backlog 🗒️

Items planned but not yet implemented:

- [ ] 🔄 Per-act retry/backoff for OpenRouter calls (partial progress is kept but handler returns 500)
- [ ] 🎥 Video rendering pipeline — combine components + audio into a single MP4 per act
- [ ] 🔍 Full-text search across projects (titles, topics, scripts)
- [ ] 📊 Usage dashboard — token counts, generation stats per project
- [ ] 🎚️ Component style presets — save and reuse style configurations
- [ ] 🔗 Canva deep-link integration — push components directly to Canva via API
- [ ] 🧠 AI error fixer skill — agent that checks all pages, finds errors, opens GitHub issues, fixes and closes
- [ ] 📱 Mobile-responsive layout pass
- [ ] 🎭 Custom component types — user-defined types beyond the 9 built-in types
- [ ] 📦 Export — download entire project as ZIP from Azure
- [ ] 🔔 Webhook/email notification when bulk pipeline completes
- [ ] 🎬 Animation preview — in-browser preview of storyboard scenes with timing

## 14. Open Questions ❓

Answered during implementation:

- ✅ **Image provider**: OpenRouter → `google/gemini-3.5-flash-image` (not a separate `IMAGE_API_KEY`)
- ✅ **TTS provider**: ElevenLabs `eleven_turbo_v2_5`, voice "George" (`TTS_API_KEY`)
- ✅ **Default Gemini model**: `google/gemini-3.5-flash` for text/script/storyboard
- ✅ **Music + SFX**: fal.ai (`fal-ai/mmaudio-v2` for music, `fal-ai/stable-audio` for SFX, `FAL_KEY`)
- ✅ **Animation types**: 9 built-in types (background, lower-third, speech-bubble, infographic, character, icon, title-card, transition + extensible)

Still open:

- ❓ Best model for image generation if `gemini-3.5-flash-image` is deprecated
- ❓ Which fal.ai model for SFX when `stable-audio` is deprecated

## 15. Lessons Learned 📝

From commits `5876de2` → `053aa52`:

| Commit | What we learned |
|--------|----------------|
| `5876de2` | Emoji-heavy UX works well for dev tools — menu items, section headers, status badges all benefit from visual cues. Backlog section keeps the spec actionable. |
| `cc84c5f` | Azure portal deep-links work reliably when the full `#@tenant/resource/...` path is used. Direct container links are more useful than the generic storage overview. |
| `1d01e07` | KeyVault **version history** preserves old secrets automatically. New secret names (e.g. `AZURE-STORAGE-CONN-STR-AA`) avoid overwrites. Use `az keyvault secret list-versions` to audit. |
| `4d69499` | Storage `List()` was missing from the interface — added to browse generated files in the UI. File cards with inline image/audio previews give instant feedback. Key exposure in dev chat is an accepted risk (rotate via Azure Portal). |
| `053aa52` | `fly deploy --build-arg BUILD_COMMIT=$(git rev-parse --short HEAD)` + Go `-ldflags="-X main.buildCommit=..."` = commit-to-deploy traceability. Footer shows clickable commit SHA. |

**Critical pitfalls:**
- 🔴 `fly secrets import` treats `#` as comment delimiter → truncates values. **Always single-quote** values containing `#` in import files, or use `fly secrets set KEY='value'`.
- 🟡 Azure connection strings contain `;` and `=` — these are safe in quoted `.env` values but break unquoted shell commands. Always single-quote AZURE variables.
- 🟡 `go build ./server` fails when `./server` is a directory — use `go build ./server/...` to check compilation or `-o <path>` to output.

## 16. Mismatches with Implementation ⚠️

These parts of the spec diverge from what's actually built. See [risks.md](risks.md) for risk tracking.

| § | Spec says | Actual implementation | Severity |
|---|----------|----------------------|----------|
| §7 Secrets table | Only `OPENROUTER`, `IMAGE`, `TTS`, `FLY` | Also needs `FAL_KEY`, `ELEVEN_LABS_API_KEY`, `AZURE_STORAGE_CONNECTION_STRING` | 🟡 |
| §8 Deployment | "one Python service" in fly.toml | **Go** service (`server/main.go`), Python only for local scripts | 🟢 resolved |
| §11 Repo Layout | Old Python-only file listing (`server/app.py`, `routes/`) | Now 18 Go files: `fal.go`, `elevenlabs.go`, `components.go`, `audio.go`, `storyboard.go`, `errors.go`, `main_test.go` + `storage/` with Azure SDK | 🟡 |
| §5.3.3 SFX | "tied to a component or scene beat" | Generated per **act** (whoosh/ding/reveal), not per component | 🟢 minor |
| §5.4 Project Create | Prompt audit as sub-item | Now a full cross-cutting feature — all handlers save prompts (outline, script, components, audio, music, SFX, storyboard) | 🟢 implemented |
| §9 Shared Layout | "links to Dashboard, Media Manager, Storyboard Creator" | Full menu: Dashboard → Projects → Storyboard → Media Manager → Audio → Create → Test → Tools → Login (emojis + `>` separators) | 🟢 enriched |
| §13 Phased Plan | Only phases 0–6 listed | Phases 7 (error handling) and 8 (prompt audit) completed but not in original plan | 🟡 missing in spec |
