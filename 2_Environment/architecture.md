# Architecture — Animation Assistant

## System Overview

```mermaid
graph TD
    User(["👤 User (Browser)"]) -->|HTTP / fetch| GHPages["GitHub Pages<br/>redirect → fly.io"]
    GHPages -->|302 redirect| FlyApp["Animation Assistant<br/>Fly.io (iad)"]
    User -->|Direct| FlyApp

    subgraph FlyApp["Fly.io — animation-assistant"]
        GoBackend["Go Backend<br/>server/"]
        WebFrontend["Web Frontend<br/>web/ (static)"]
        GoBackend -->|serves| WebFrontend
    end

    GoBackend -->|text + images| OpenRouter["OpenRouter API<br/>Gemini 3.5 Flash (text)<br/>Gemini 3 Pro Image (components)<br/>Gemini 3.1 Flash Image (storyboard)"]
    GoBackend -->|TTS voiceover| ElevenLabs["ElevenLabs API<br/>eleven_turbo_v2_5 · George"]
    GoBackend -->|music + SFX| FalAI["fal.ai<br/>mmaudio-v2 (music)<br/>stable-audio (SFX)"]
    GoBackend -->|read/write blobs| AzureBlob["Azure Blob Storage<br/>container: projects<br/>container: prompts"]

    OpenRouter -->|auth| KV["Azure Key Vault<br/>dp-kv-deliverypilot"]
    ElevenLabs -->|auth| KV
    FalAI -->|auth| KV
    AzureBlob -->|conn string| KV

    subgraph Local["Local Development"]
        PythonScripts["Python Scripts<br/>scripts/"]
        SharedPython["Shared Python Lib<br/>shared/"]
        LocalStorage["Local Storage<br/>./other/"]
        PythonScripts --> SharedPython
        PythonScripts -->|local reads/writes| LocalStorage
    end

    FlyApp -.->|optional: Python on fly.io| PythonScripts
```

## Core Components

| Component | Location | Role |
|-----------|----------|------|
| **Go Backend** | `server/` | HTTP server, REST API, AI orchestration, file serving, storage interface. Holds all secrets. |
| **Python Scripts** | `scripts/` | Local CLI generation (script, components, audio, storyboard) triggered by AI agent. Uses shared Python helpers. |
| **Shared Python** | `shared/` | Cross-cutting helpers (config, acts, OpenRouter client, ElevenLabs client, storage, audio, storyboard) |
| **Web Frontend** | `web/` | Static HTML pages + CSS + JS. Shared shell (top nav, footer, debug bar) on every page. |

## Generation Pipeline

```
Outline ──→ Script ──→ Components ──→ Audio ──→ Storyboard
 (3-act)     (per act)   (typed imgs)  (TTS+music+SFX) (scenes)
```

Each project follows this fixed order. Acts are independent — you can generate/regenerate any single act without touching the others.

## Data Flow

1. User creates a project via the web UI (Q&A → project creation).
2. **Outline** → 3-act narrative summary via OpenRouter (Gemini).
3. **Script** → Full script per act, with beats and voiceover text.
4. **Components** → Typed images (background, lower-third, speech-bubble, etc.) generated per act via OpenRouter image models.
5. **Audio** → Three layers per act: voiceover (ElevenLabs), music (fal.ai), SFX (fal.ai).
6. **Storyboard** → Scene-by-scene plan from scripts + components via OpenRouter. 4-frame infographic PNG generated.
7. All data persists to **Azure Blob Storage** (`projects` container) or locally (`./other`).
8. All prompts saved to audit trail (`prompts` container).
