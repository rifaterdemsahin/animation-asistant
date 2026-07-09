# 01 — Architecture

## System Topology

```
┌──────────────────────────────────────────────────────────┐
│                    Browser (Client)                       │
│  Dashboard · Projects · Storyboard · Script · Audio      │
│  Media Manager · Create · Test · Tools · Self Learning    │
│  (vanilla HTML/CSS/JS — no framework)                     │
│  + Layout shell (top nav, project header, footer)         │
│  + Client debug bar (error/action capture)                │
└──────────────────────┬───────────────────────────────────┘
                       │ HTTP REST / static files
┌──────────────────────▼───────────────────────────────────┐
│                 Go Backend (server/)                       │
│                                                           │
│  ┌─────────┐  ┌──────────┐  ┌──────────────┐             │
│  │  Auth   │  │  Projects │  │  Prompts API  │             │
│  │ (cookie)│  │  CRUD     │  │  (editable)   │             │
│  └─────────┘  └──────────┘  └──────────────┘             │
│                                                           │
│  ┌──────────┐ ┌──────────┐ ┌────────┐ ┌────────────┐    │
│  │  Script  │ │Components│ │ Audio  │ │ Storyboard │    │
│  │ outline  │ │ 9 types  │ │TTS/Msc │ │JSON+images │    │
│  │ per-act  │ │ per-act  │ │/SFX    │ │per-act     │    │
│  └──────────┘ └──────────┘ └────────┘ └────────────┘    │
│                                                           │
│  ┌──────────────────────────────────────────────────┐    │
│  │          Error Handling (middleware)               │    │
│  │  recoverMiddleware → ring buffer → /api/errors     │    │
│  └──────────────────────────────────────────────────┘    │
│                                                           │
│  ┌────────────┐  ┌────────────────┐  ┌─────────────┐    │
│  │ OpenRouter │  │   ElevenLabs   │  │   fal.ai     │    │
│  │ text+image │  │   TTS (mp3)    │  │ music + SFX  │    │
│  │ multi-key  │  │ voice "George" │  │              │    │
│  └────────────┘  └────────────────┘  └─────────────┘    │
│                                                           │
│  ┌──────────────────────────────────────────────────┐    │
│  │              Storage Backend                       │    │
│  │  Backend interface → Local (./other) or Azure Blob  │    │
│  │  Auto-selected: Azure when conn string is set       │    │
│  └──────────────────────────────────────────────────┘    │
└──────────────────────┬───────────────────────────────────┘
                       │
        ┌──────────────┼──────────────┐
        ▼              ▼              ▼
   Azure Blob     Local ./other   OpenRouter API
   (production)   (dev fallback)  (Gemini models)

┌──────────────────────┐     ┌───────────────────────────┐
│   Python Scripts      │     │    Python Shared Helpers   │
│   scripts/            │     │    shared/                 │
│                       │     │                           │
│  generate_script.py   │────▶│  acts.py  openrouter.py    │
│  generate_components  │     │  config.py  storage.py     │
│  generate_audio.py    │     │  scriptgen.py  prompts.py  │
│  generate_storyboard  │     │  components.py  audio.py   │
│                       │     │  storyboard.py elevenlabs  │
│  CLI tools, triggered │     │                           │
│  by AI agent. Writes  │     │  Dual-mode: same logic    │
│  to local ./other.    │     │  as Go server/same prompts │
└──────────────────────┘     └───────────────────────────┘
```

## Dual Surface (by design)

The project has **two generation surfaces**, not duplication:

| Surface | Trigger | Storage | Context |
|---------|---------|---------|---------|
| **Go backend** (`server/`) | Browser UI → REST API | Azure Blob (prod) | Web-based generation on fly.io |
| **Python scripts** (`scripts/`) | CLI or AI agent tooling | Local `./other` | Local generation, LLM-driven |

Both share:
- The same prompt templates (editable via `/api/prompts`)
- The same external APIs (OpenRouter, ElevenLabs, fal.ai)
- The same 3-act structure (`acts.go` ↔ `acts.py`)
- The same file naming conventions

## Technology Stack

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| Frontend | Vanilla HTML/CSS/JS | Simple tool screens, no heavy framework needed |
| Backend | Go (stdlib + Azure SDK) | Single binary, secrets-safe, HTTP serve + API |
| AI Text | OpenRouter → `google/gemini-3.5-flash` | Good quality + rate balance |
| AI Images | OpenRouter → `google/gemini-3-pro-image` | Storyboard + component images |
| TTS | ElevenLabs `eleven_turbo_v2_5` | Fast quality voice, voice "George" |
| Music/SFX | fal.ai (`fal-ai/mmaudio-v2`, `fal-ai/stable-audio`) | Background music + sound effects |
| Storage | Azure Blob (primary), local FS (dev) | Switchable via env var |
| Deployment | fly.io (Go service) | Single machine, secrets via `fly secrets` |
| Python | stdlib + `httpx` + `python-dotenv` | CLI scripts, local generation |

## Secrets Flow

```
Azure KeyVault (dp-kv-deliverypilot)
    │
    ├──▶ .env (local, gitignored) → Go server localhost:8080
    │
    └──▶ fly secrets → Go server fly.io deployment
```

- `.env` is gitignored; `.dockerignore` excludes it from images
- `.env.example` documents all required keys with placeholders
- `fly secrets import` caveat: `#` is comment delimiter — single-quote values
- Azure connection strings contain `;` and `=` — always quote in shell commands

## Project → Generation Flow

```
Create Project (Q&A form)
    │
    ▼
Generate Outline (project-level, 3-act summary)
    │
    ▼
Generate Script (per act: act-1 problem, act-2 solution, act-3 lesson)
    │  └── outputs: act.md (markdown) + beats.json (structured)
    │
    ▼
Generate Components (per act: typed images from script beats)
    │  └── outputs: <slug>-<type>-NN.png + components.json manifest
    │
    ▼
Generate Audio (per act: TTS narration + music + SFX)
    │  └── outputs: narration.mp3, music.mp3, sfx-*.mp3
    │
    ▼
Generate Storyboard (project-level: scene JSON + per-act images)
    │  └── outputs: storyboard.json, storyboard-<act>-NN.png, versions.json
    │
    ▼
Storyboard prompts saved → Script re-generation reads them
    │  (storyboard → script feedback loop)
    ▼
Download → Canva timeline → Self-learning loop
```

## Error Handling Architecture

**Server-side:**
- `recoverMiddleware` wraps all routes — panics caught, server never crashes
- Structured JSON errors: `{error, code, message, timestamp}`
- Ring buffer stores last N errors, exposed at `GET /api/errors`
- OpenRouter failures logged with full request context

**Client-side:**
- `debug.js` injected on every page via shared shell
- Captures: JS errors (`window.onerror`), failed fetches, unhandled rejections
- Action tracker: method, URL, status, duration
- Copy button → paste into AI agent for resolution
- "Pull server errors" button fetches `/api/errors`
- 100-entry cap, auto-rotating
