# Animation Assistant — Stage 1: Real & Unknown

**Live:** https://animation-assistant.fly.dev/
**Stack:** Go backend + Python scripts + Azure Blob Storage
**Secrets:** Azure Key Vault (`dp-kv-deliverypilot`)

## Problem

Content creators need automated animation component generation for Canva. Currently, producing educational animations requires manual Canva editing — dragging elements, writing scripts, sourcing images and audio. This is slow, inconsistent, and doesn't scale.

Animation Assistant solves this with an AI-driven pipeline that produces ready-to-use animation assets (script, typed visual components, voiceover, music, SFX, storyboard) from a simple Q&A prompt.

## Pipeline (3-act structure)

Every project follows a fixed 3-act narrative:

| Act | Role | Purpose |
|-----|------|---------|
| Act 1 | Problem | Set up the world and the pain point |
| Act 2 | Solution | Introduce the solution |
| Act 3 | Lesson | The takeaway insight |

Generation flow per project: **Outline → Script → Components → Audio → Storyboard**.

## Architecture

- **Go backend** (`server/`) — serves static frontend + REST API on fly.io; calls OpenRouter (Gemini) for text/images, ElevenLabs for TTS, fal.ai for music/SFX
- **Python scripts** (`scripts/`) — local generation triggered by the AI agent, same pipeline
- **Azure Blob Storage** — project data, prompts, all generated assets
- **Editable prompts** — prompt templates stored in Azure (`prompts` container), seeded from compiled defaults, editable live at `/pages/prompts.html`
- **Storyboard→Script feedback loop** — after storyboard generation, image prompts are injected as context for re-generating scripts, ensuring visual- narrative consistency

## Deployment

```bash
# Local
go run ./server           # http://localhost:8080

# Production
fly deploy                # fly.io (secrets from Azure KeyVault)
```

## Status

All 6 phases complete. Live at https://animation-assistant.fly.dev/. Backlog items tracked in `kanban.md`.
