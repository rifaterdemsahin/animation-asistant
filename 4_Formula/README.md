# 4_Formula — Complete Implementation Specification

> **Status:** v1 — comprehensive spec derived from live codebase
> **App:** https://animation-assistant.fly.dev/

This directory documents every layer of the Animation Assistant codebase, derived
from the live implementation. It serves as both a blueprint for understanding the
system and a reference for future changes.

## Document Index

| # | Document | Covers |
|---|----------|--------|
| 1 | [Architecture](01-architecture.md) | System topology, dual Go+Python surface, service boundaries |
| 2 | [Backend](02-backend.md) | Go server: routes, handlers, auth, error handling, OpenRouter/ElevenLabs/fal.ai clients |
| 3 | [Frontend](03-frontend.md) | All 12 HTML pages, 12 JS modules, CSS theme, shared shell, debug bar |
| 4 | [API Reference](04-api.md) | Complete REST API: all endpoints, request/response shapes, auth model |
| 5 | [Data Model](05-data-model.md) | Project structure, acts, components, beats, storage layout |
| 6 | [Storage](06-storage.md) | Backend interface, Local + Azure implementations, blob layout |
| 7 | [Pipeline](07-pipeline.md) | End-to-end generation flow: outline → script → components → audio → storyboard |
| 8 | [Storyboard Cost](08-storyboard-generation-cost.md) | Cost analysis for storyboard image generation |
| 9 | [Alternative Image Models](09-alternative-image-models.md) | Comparison of image generation model options |
| 10 | [Gemini Direct vs OpenRouter](10-gemini-direct-vs-openrouter-cost.md) | Cost comparison: Gemini direct API vs OpenRouter |
| 11 | [Storyboard Pipeline Estimate](11-storyboard-cost-and-pipeline-estimate.md) | End-to-end storyboard cost and pipeline projections |
| 12 | [Checking Missing Scripts](12-checking-missing-scripts.md) | Formula and API for identifying projects without scripts |
| 16 | [Sprite Generator](16-sprite-generator.md) | 14-icon technical sprite sheet: concept extraction + image generation endpoints |

## Quick Reference

```
4_Formula/
├── README.md                                    # This index
├── 01-architecture.md                           # System topology & boundaries
├── 02-backend.md                                # Go server internals
├── 03-frontend.md                               # HTML/CSS/JS pages & modules
├── 04-api.md                                    # REST API specification
├── 05-data-model.md                             # Project, act, component, beat schemas
├── 06-storage.md                                # Storage interface & implementations
├── 07-pipeline.md                               # Generation flow & prompt audit trail
├── 08-storyboard-generation-cost.md             # Storyboard image generation cost analysis
├── 09-alternative-image-models.md               # Alternative image model comparison
├── 10-gemini-direct-vs-openrouter-cost.md        # Gemini direct vs OpenRouter cost
├── 11-storyboard-cost-and-pipeline-estimate.md  # Storyboard cost & pipeline projections
└── 12-checking-missing-scripts.md               # Formula for checking missing scripts
```

## Source Coverage

- **Go backend:** 18 files in `server/` + `server/storage/`
- **Frontend:** 12 HTML pages, 12 JS modules, 1 CSS file in `web/`
- **Python:** 4 scripts in `scripts/`, 11 modules in `shared/`
- **Config:** `.env.example`, `fly.toml`, `Dockerfile`, `go.mod`, `requirements.txt`
