# Tools — Animation Assistant

## Service Overview

| Tool/Service | Role | Config | Used by |
|-------------|------|--------|---------|
| **Go Backend** (`server/`) | HTTP server + REST API + AI orchestration | 18 source files, stdlib + azblob SDK | fly.io runtime |
| **Python Scripts** (`scripts/`) | Local CLI generation | 8 scripts (script, components, audio, storyboard) | AI agent (local) |
| **Shared Python** (`shared/`) | Cross-cutting helpers | 10 modules (config, acts, openrouter, elevenlabs, storage, audio, storyboard, prompts, components) | Python scripts |
| **Web Frontend** (`web/`) | Static HTML/CSS/JS UI | 16 pages, 17 JS files, 1 CSS file | Browser |
| **Fly.io** | Deployment platform | `fly.toml` + `Dockerfile` | App hosting |
| **Azure Blob Storage** | Primary data storage | `AZURE_STORAGE_CONNECTION_STRING` | Project data + prompts |
| **Azure Key Vault** | Secrets management | Vault: `dp-kv-deliverypilot` | All secrets |
| **OpenRouter** | AI text + image generation | Gemini 3.5 Flash / 3 Pro Image / 3.1 Flash Image | Outline, script, components, storyboard |
| **ElevenLabs** | TTS voiceover | `eleven_turbo_v2_5`, voice "George" | Audio generation |
| **fal.ai** | Music + SFX generation | `mmaudio-v2` (music), `stable-audio` (SFX) | Audio generation |
| **GitHub Actions** | CI/CD | `.github/workflows/static.yml` | GitHub Pages deploy |
| **Docker** | Container build | Multi-stage: Go build → Python slim | fly.io image |

## Secrets Map

All secrets are stored in **Azure Key Vault** (`dp-kv-deliverypilot`) and propagated to `.env` (local) or `fly secrets` (deployed).

| Secret | KeyVault Name | Env Var | Used by |
|--------|--------------|---------|---------|
| Admin password | `AdminPassword` | `ADMIN_PASSWORD` | Auth (login page) |
| Auth secret | — | `AUTH_SECRET` | Cookie signing (defaults to ADMIN_PASSWORD) |
| OpenRouter keys | `OPENROUTER-API-KEY` | `OPENROUTER_API_KEY` | AI text/image generation (comma-separated, rotation on 401/402/429) |
| OpenRouter text model | — | `OPENROUTER_MODEL` | Default: `google/gemini-3.5-flash` |
| Storyboard image model | — | `STORYBOARD_IMAGE_MODEL` | Default: `google/gemini-3.1-flash-image` |
| Image API key | — | `IMAGE_API_KEY` | Image generation (legacy) |
| ElevenLabs API key | `ELEVEN-LABS-API-KEY` | `TTS_API_KEY` | TTS voiceover generation |
| ElevenLabs voice | — | `TTS_VOICE` | Default: "George" |
| fal.ai key | `FAL-KEY` | `FAL_KEY` | Music + SFX generation |
| Azure storage connection string | `AZURE-STORAGE-CONN-STR-AA` | `AZURE_STORAGE_CONNECTION_STRING` | Blob storage access |
| Azure container | — | `AZURE_CONTAINER` | Default: `projects` |
| Azure prompts container | — | `AZURE_PROMPTS_CONTAINER` | Default: `prompts` |
| DeepSeek API key | — | `DEEPSEEK_API_KEY` | Optional alternative text provider |

**Important rules:**
- Secrets are **never committed**. `.env` is gitignored; `.dockerignore` keeps it out of the image.
- `#` in secrets truncates `fly secrets import` — use single quotes or `fly secrets set KEY='value'`.
- Azure connection strings contain `;` and `=` — always single-quote in shell commands.
- OpenRouter keys can be comma-separated for rotation on 401/402/429.
