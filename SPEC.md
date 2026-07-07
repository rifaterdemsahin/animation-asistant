# Animation Assistant — Project Specification

> Status: **Draft v2** — planning/spec phase. No implementation exists yet.
> This document defines what we are building before any code is written.

## 1. Overview

**Animation Assistant** is an HTML-based, multi-tool web app that helps build
animations. It orchestrates AI generation (script, images, audio) and assembles
them into storyboards that can be turned into animation components.

the backend to hold secrets is GO and getting deployed to fly.io locally it uses gitignored .env file  to tyrigger pythons and load the GO runtime. 
It gets deployed to fly.io and github pages gets redirected to fly.io.

The app is a collection of focused **tools** that all share a common UI shell
(top menu + bottom footer). It serves multiple animation projects which has the data and metadata hosted in Azure storage.  A single project can produce many different kinds of
animation components, and every animation components is not mixed so it is easier to use in canva video timelines where they turn into final animations.

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
│  Browser  (HTML pages, shared top menu + footer)            │
│   • Dashboard   • Media Manager   • Storyboard Creator ...  │
└───────────────────────────┬─────────────────────────────────┘
                            │ HTTP / fetch
┌───────────────────────────▼─────────────────────────────────┐
│  Backend  (GO, Python scripts for local create and push to Azure — thin API/orchestration layer)│
│   - Exposes endpoints for each tool                         │
│   - Reads secrets from environment (.env local / fly secrets)│
│   - Calls OpenRouter (Gemini) + runs generation scripts from local and places into Azure    │
└───────────────────────────┬─────────────────────────────────┘
                            │
        ┌───────────────────┼────────────────────────┐
        ▼                   ▼                        ▼
   generate_script     generate_image          generate_audio
   (OpenRouter/Gemini,etc) (Python + image API)    (Python + TTS API in openrouter)
        │                   │                        │
        └───────────────────┴────────────────────────┘
                            ▼
                   other/<project>/{script,images,audio,storyboard}
```

- **Frontend**: static HTML/CSS/JS. A small shared layout helper injects the
  common top menu and footer into every page so all pages stay consistent.
  It follows the project, outline, script, assets order
  Header would display which project we are currently working on
- **Backend**: a lightweight Python server (FastAPI or Flask) that exposes
  endpoints and orchestrates generation. It only does I/O + delegation.
- **Generation workers**: standalone Python scripts under `scripts/` that do the
  real work (one responsibility each). They can be called by the server **or**
  directly from the CLI for local testing.
- **Storage**: all generated artifacts live under Azure storage subfolder per
  animation project.

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
azure_project folder/
└── <project-slug>/                 # one folder per animation
    ├── project.json                # metadata: topic, animation_type, acts status
    ├── act-1-problem/              # Act 1 — Problem
    │   ├── script/act.md           #   this act's script + beats
    │   ├── components/
    │   │   ├── components.json     #   manifest of typed components
    │   │   ├── bg-01.png           #   type: background
    │   │   ├── lowerthird-01.png   #   type: lower-third
    │   │   ├── bubble-01.png       #   type: speech-bubble
    │   │   └── infographic-01.png  #   type: infographic
    │   └── audio/narration.mp3
    ├── act-2-solution/             # Act 2 — Solution (same structure)
    ├── act-3-lesson/               # Act 3 — Lesson   (same structure)
    └── storyboard/
        └── storyboard.json         # scenes grouped by act, referencing component ids
            storyboard.png          # info graphic stype generated image
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

## 10. Repository Layout (planned)

```
animation-asistant/
├── README.md
├── SPEC.md                  # this file
├── AGENTS.md                # agent/coding guidance
├── .env.example             # documented keys (placeholders only)
├── .gitignore
├── fly.toml                 # fly.io app definition
├── requirements.txt         # Python deps
├── web/                     # static frontend
│   ├── index.html
│   ├── assets/
│   │   ├── css/styles.css
│   │   └── js/layout.js     # shared top menu + footer
│   └── pages/
│       ├── dashboard.html
│       ├── media-manager.html
│       └── storyboard.html
│       └── projects.html
├── server/                  # Python backend (API + orchestration)
│   ├── app.py
│   └── routes/
├── scripts/                 # standalone generation workers
│   ├── generate_script.py
│   ├── generate_image.py
│   └── generate_audio.py
├── shared/                  # cross-cutting helpers (config, paths, io)
└── other/                   # output: one folder per animation project
    └── .gitkeep
```

## 11. Tech Choices

- **Frontend**: vanilla HTML/CSS/JS (no heavy framework) — pages are simple tool
  screens. Shared layout via a tiny JS helper + shared CSS.
- **Backend**: Python (FastAPI preferred for async + simple JSON APIs; Flask as
  fallback). Serves static files + JSON endpoints.
- **AI text/script/storyboard**: OpenRouter API → Gemini models.
- **Images**: a Python script calling an image generation API.
- **Audio**: a Python script calling a TTS API; ffmpeg available for slicing.
- **Deploy**: fly.io single machine, secrets via `fly secrets`.

## 12. Phased Plan

1. **Phase 0 — Foundations (this step):** SPEC.md + AGENTS.md only.
2. **Phase 1 — Skeleton:** repo layout, shared layout (menu/footer), dashboard
   page, backend serving static files, `.env.example`, `fly.toml`, `.gitignore`.
3. **Phase 2 — Script generation:** `generate_script.py` + Media Manager page
   (OpenRouter/Gemini), write to `other/<project>/script/`.
4. **Phase 3 — Images:** `generate_image.py` + UI, write to
   `other/<project>/images/`.
5. **Phase 4 — Audio:** `generate_audio.py` + UI, write to
   `other/<project>/audio/`.
6. **Phase 5 — Storyboard Creator:** combine script + images via OpenRouter
   (Gemini) → `other/<project>/storyboard/`.
7. **Phase 6 — Deploy:** `fly secrets set`, `fly deploy`, verify on remote.

## 13. Open Questions

- Which image-generation provider/model to standardize on (key placeholder
  `IMAGE_API_KEY`).
- Which TTS provider/model to standardize on (key placeholder `TTS_API_KEY`).
- Default Gemini model id on OpenRouter for script + storyboard.
- Exact set of animation types to support in v1.
