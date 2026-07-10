# Refactor Cost Summary — Animation Assistant

## 1. Refactor Summary

The Animation Assistant project was restructured to match the `delivery-pilot-template` 7-stage structure:

- **Added stages**: `1_Real_Unknown` (7 files), `2_Environment` (12 files), `5_Symbols` (README)
- **Renamed**: `7_Test` → `7_Testing_Known`
- **Template files added** to `3_Simulation`, `4_Formula`, `6_Semblance`
- **Root agent files** created: `agents.md`, `prompts.md`, `claude.md`, `gemini.md`, `copilot.md`, `kilocode.md`
- **GitHub Pages navigation** set up: `index.html`, `markdown_renderer.html`, `navigation_config.json`, `robots.txt`, `sitemap.xml`
- **Moved** `SPEC.md` and `SPEC-SCRIPT.md` into `4_Formula` (specs live in formulas)
- **Updated**: `AGENTS.md`, `README.md`, `.gitignore`, `.github/workflows/static.yml`
- **KeyVault integration**: confirmed reuse of `dp-kv-deliverypilot` — no new vault created

## 2. AI Token Cost Estimate for the Refactor

| Metric | Value |
|--------|-------|
| Task agent invocations | ~6 major calls |
| Estimated input tokens | ~200K |
| Estimated output tokens | ~100K |
| Estimated cost (Claude/GPT-4 class) | **$1–2** |

Files created/modified: 60+ files with thousands of lines of content across all 7 stages.

## 3. Project Infrastructure Costs (Monthly)

| Service | Cost | Notes |
|---------|------|-------|
| Fly.io | $0/mo | Free tier (shared CPU 512MB) |
| Azure Key Vault (`dp-kv-deliverypilot`) | ~$0.03/10K ops | Existing vault, minimal ops |
| Azure Blob Storage | ~$0.01–0.05/GB | Container: `projects`, `prompts` |
| GitHub Pages | $0 | Static hosting |
| OpenRouter API | Pay-per-token | Gemini models, variable usage |
| ElevenLabs TTS | $5/mo (100K chars) | Voice "George", `eleven_turbo_v2_5` |
| fal.ai | ~$0.01–0.05/inference | MMAudio, Stable Audio |
| **Total monthly estimate** | **$5–15** | Depends on usage volume |

## 4. Historical Costs (Project to Date)

| Activity | Cost |
|----------|------|
| Go backend development | $0 (local) |
| Python scripts | $0 (local) |
| Docker build + fly deploy | $0 |
| Storyboard generations (testing) | ~$3–4 (OpenRouter + fal.ai) |
| Script generations | ~$0.50/project |
| Image components | ~$0.02–0.05/image |
| TTS audio | ~$0.01/minute |
| **Total project cost to date** | **~$5–8** |

## 5. Lessons Learned

- **Template adoption is mostly structural** — code artifacts don't need to physically move; the 7-stage structure is a documentation/organization overlay.
- **5_Symbols maps to existing code** — the root-level `server/`, `web/`, `scripts/`, `shared/` directories remain the canonical implementation locations. No breaking changes needed.
- **Agent coordination files** provide clear boundaries: each AI agent (Claude, Gemini, Copilot, Kilo Code) knows its role without overlap.
- **Navigation separation** — the project UI (`projectMenu`) is cleanly separated from the stage/agent UI (`debugMenu`), keeping the framework navigation independent of project content.
- **Two-menu architecture scales** — adding new stages, agents, or sections requires only config changes, not HTML restructuring.
