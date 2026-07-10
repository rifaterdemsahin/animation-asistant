# Kanban — Animation Assistant

## Done ✅

| Item | Details |
|------|---------|
| Phase 0: Foundations | SPEC.md (in 4_Formula/), AGENTS.md, risks.md written |
| Phase 1: Skeleton | Go backend, shared layout, auth, CRUD, Azure + Local storage |
| Phase 2: Script | Outline + per-act script generation via OpenRouter/Gemini |
| Phase 3: Components | Typed component images per act (background, lower-third, speech-bubble, infographic, character, icon, title-card, transition) |
| Phase 4: Audio | TTS voiceover (ElevenLabs `eleven_turbo_v2_5` / George) + Music (`fal-ai/mmaudio-v2`) + SFX (`fal-ai/stable-audio`) |
| Phase 5: Storyboard | Scene-by-scene plan + 4-frame infographic PNG via Gemini 3.1 Flash |
| Phase 6: Deploy | fly.io (animation-assistant), fly secrets from Azure KeyVault, GitHub Pages redirect |
| Phase 7: Error handling | Central middleware, structured JSON errors, `/api/errors` endpoint, client-side debug bar |
| Phase 8: Prompt audit | All prompts saved to Azure: `<slug>/prompts/<timestamp>-<act>-<step>.json` |
| Prompt templates (editable) | Prompts stored in Azure container, seeded from compiled defaults, editable live |
| Storyboard→Script feedback loop | Image prompts + file references injected into script generation context |
| Single-act test mode | Per-act partial generation without affecting other acts |
| Bulk pipeline mode | Generate all 3 acts (outline→script→components→audio→storyboard) in one pass |
| Model visibility badges | `.model-badge` pills filled from `GET /api/models` on every step |
| Per-component regeneration | Regenerate individual component types with merge semantics |
| Script versioning | v01/v02/... with version manifest, per-act grouping in UI |
| Bloom's Taxonomy page | `/pages/self_learning.html` mapping 5 cognitive levels to pipeline |
| Comparison: Pro vs Flash | `compare_pro_vs_flash/` side-by-side storyboard image comparison |

## In Progress 🔄

| Item | Details |
|------|---------|
| Template refactoring | Align Go + Python prompt templates, ensure dual-mode parity |

## Backlog 📋

| Priority | Item | Details |
|----------|------|---------|
| P1 | Video rendering pipeline | Combine components + audio into MP4 per act via ffmpeg |
| P2 | Canva deep-link integration | Push components directly to Canva via API |
| P3 | Full-text search across projects | Index scripts, outlines, component metadata |
| P4 | Per-act OpenRouter retry/backoff | Exponential backoff on 401/402/429, per-act resume |
| P5 | Usage dashboard | Token counts, generation stats per project |
| P6 | Component style presets | Save and reuse style configurations across projects |
| P7 | Mobile-responsive layout pass | Ensure all pages work on mobile viewports |
| P8 | Custom component types | UI for defining new types with custom prompts |
| P9 | Export entire project as ZIP | One-click download from Azure |
| P10 | Webhook/email notification | Notify when bulk pipeline completes |
| P11 | Animation preview | In-browser preview of storyboard scenes with timing |
| P12 | AI error fixer skill | Agent that checks pages, finds errors, opens issues, fixes and closes |

## Icebox 🧊

| Item | Details |
|------|---------|
| Multi-tenant support | User accounts, per-user storage, sessions |
| Canva OAuth integration | Auth flow for direct asset push |
| CI/CD pipeline | Automated test + deploy on merge |
