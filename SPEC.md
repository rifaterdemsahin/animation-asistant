# Animation Assistant — Project Specification

> Status: **Draft v2** — planning/spec phase. No implementation exists yet.
> This document defines what we are building before any code is written.

## 1. Overview

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

## 2. Goals

- Provide a unified web UI for animation production tasks for its components.
- namings for the items come with project name as prefix.
- Generate **scripts**, **images**, and **audio** from a single Media Manager.
- Whole goal is to leverage the large language models capacaity to trigger self learning process.
- Self learning happens when generated content is placed in canva and created an aestethic learning experience.
- Generate a **storyboard** from a script + images using OpenRouter calls to Gemini or other related models.
- Keep each animation project isolated in its own folder under the azure.
- Have an an admin login and keep that password in .env file so not everyone should be able to trigger have a login page in a common menu.
- Run locally and deploy to **fly.io** with the same secrets model.
- Share a consistent layout (top menu + footer) across every page which has the links to all the tools and have search to be able find pages.

## 3. Non-Goals (for now)

- Full timeline/keyframe video editing UI this is delegated to canva which does the final post production
- Real-time collaboration we only focus on production and self learning in the process.
- Account/auth system (single-user tool for the owner) and there is a canva video project link that gets saved. 

## 4. Architecture (high level)

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

## 5. Tools

### 5.1 Media Manager (the orchestrator)
The central tool that produces the raw materials for an animation. It generates:
1. **Outline** — text/script for the storyboard via OpenRouter (Gemini models).
1. **Script** — text/script produced via OpenRouter (Gemini models).
2. **Images** — visuals produced by the image generator (Python script).
3. **Audio** — voiceover/sound produced by the audio generator (Python script).

The Media Manager lets you pick/create a project, then run each generation step
per **act** (see §5.1.1) and see the results.

#### 5.1.1 Three-Act narrative structure
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

#### 5.1.2 Components (typed visual parts)
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
- One act typically contains a **mix** of types (e.g. a `background` + a
  `lower-third` + an `infographic`) that together demonstrate the act.
- The image generator (`generate_image.py`) is type-aware: it takes a `--type`
  and adapts the prompt/style for that component type.
- Components are the building blocks the Storyboard assembles into scenes.
- Use json structures in Azure to hold the metadata and the data 

### 5.2 Storyboard Creator
Takes the existing **act scripts** and the generated **components** for each
act, then produces a **storyboard** organized by act — a scene-by-scene plan
that places components (by type) against script beats with timing — using
Story board gets created with a problem and answer about a large language models
**OpenRouter with Gemini models**. Output is saved into the project's
`storyboard/` folder as `storyboard.json` with sections `act-1` / `act-2` /
`act-3`, each scene referencing component `id`s (and therefore `type` + file).

### 5.3 Animation components
One project should be able to create different *types* of animation components. The
project model carries an `component_type` so the pipeline can adapt. More
specialized tools can be added behind the same shared menu.

## 6. Project & Data Model

An **animation project** is a folder + a metadata file, organized by the fixed
**three-act** structure (Problem → Solution → Lesson). Per act, it holds a
script, a set of typed **components**, and audio.

```
<project-slug>/                     # one folder per animation (in Azure Blob Storage)
    ├── project.json                # metadata: topic, animation_type, acts status
    ├── outline.json                # project-level 3-act outline
    ├── act-1-problem/              # Act 1 — Problem
    │   ├── script/act.md           #   this act's script + beats
    │   ├── script/beats.json       #   structured beat data
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

## 7. Secrets

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

## 8. Deployment (fly.io)

- Deploy from the **local machine** using the existing fly CLI token
  (`fly auth whoami` → already authenticated).
- A `fly.toml` describes the app (one Python service).
- Deploy command: `fly deploy` (uses the local `FLY_API_TOKEN`).
- Runtime secrets are set once with `fly secrets set ...` and persist across
  deploys. New deploys never contain secrets in the image.
- The app is a single service: serves the static HTML **and** exposes the API.

## 9. Shared Layout

Every page reuses:
- **Top menu** — links to Dashboard, Media Manager, Storyboard Creator, etc.
- **Bottom footer** — project info / links / github build link/ commits link/ fly.io link and local link

Implemented with a small shared component (JS layout injection + shared CSS),
so a single edit updates all pages. No page is built from scratch; each page
just renders into the shared shell.

## 10. Central Error Handling

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

## 11. Repository Layout (planned)

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

## 12. Tech Choices

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

## 13. Phased Plan

1. **Phase 0 — Foundations (this step):** SPEC.md + AGENTS.md only.
2. **Phase 1 — Skeleton:** repo layout, shared layout (menu/footer/debug bar),
   dashboard page, Go backend serving static files + REST API, `.env.example`,
   `fly.toml`, `Dockerfile`, `.gitignore`. Storage backend interface with local
   + Azure impl.
3. **Phase 2 — Script generation:** `generate_script.py` + Media Manager page
   (OpenRouter/Gemini), write to Azure Blob Storage (dev fallback: `./other/`).
4. **Phase 3 — Images:** `generate_image.py` + UI, write typed components
   per act with `<slug>-<type>-<n>.<ext>` naming.
5. **Phase 4 — Audio:** `generate_audio.py` + UI.
6. **Phase 5 — Storyboard Creator:** combine script + components via OpenRouter
   (Gemini) → storyboard per act.
7. **Phase 6 — Deploy:** `fly secrets set`, `fly deploy`, GitHub Pages → fly.io
   redirect, verify on remote.

## 14. Open Questions

- Which image-generation provider/model to standardize on (key placeholder
  `IMAGE_API_KEY`).
- Which TTS provider/model to standardize on (key placeholder `TTS_API_KEY`).
- Default Gemini model id on OpenRouter for script + storyboard.
- Exact set of animation types to support in v1.
