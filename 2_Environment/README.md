# Stage 2: Environment

> Documentation for the Animation Assistant project environment, tooling, and setup.

**Live app:** https://animation-assistant.fly.dev/  
**GitHub:** https://github.com/rifaterdemsahin/animation-asistant  
**Azure Key Vault:** `dp-kv-deliverypilot`  

This stage documents the infrastructure, deployment, and development environment. Refer to the [SPEC.md](../4_Formula/SPEC.md) for the full project specification and [AGENTS.md](../AGENTS.md) for coding guidelines.

## Files

| File | What it covers |
|------|---------------|
| [setup_mac.md](setup_mac.md) | macOS development environment setup (Go 1.26, Python 3.12, Azure CLI, flyctl, Docker) |
| [architecture.md](architecture.md) | System architecture diagram and component overview |
| [tools.md](tools.md) | Every tool/service used and the secrets map |
| [fly_io.md](fly_io.md) | Fly.io deployment configuration (app `animation-assistant`) |
| [github_pages.md](github_pages.md) | GitHub Pages redirect setup and CI/CD workflow |
| [navigation.md](navigation.md) | Two-menu navigation system (Project + Debug) |
| [setup_azure.md](setup_azure.md) | Azure Key Vault (`dp-kv-deliverypilot`) setup and secret retrieval |
| [setup_ai.md](setup_ai.md) | AI provider configuration (OpenRouter, ElevenLabs, fal.ai) |
| [supabase.md](supabase.md) | Supabase — not currently used |
| [axiom.md](axiom.md) | Axiom — not currently used |
| [cloudflare_workers.md](cloudflare_workers.md) | Cloudflare Workers — not currently used |

## Tech Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Backend | Go | 1.26 |
| Frontend | Vanilla HTML/CSS/JS | — |
| Scripts | Python | 3.12 |
| AI Text+Images | OpenRouter → Gemini models | — |
| TTS | ElevenLabs | `eleven_turbo_v2_5` |
| Music+SFX | fal.ai | `mmaudio-v2` / `stable-audio` |
| Storage | Azure Blob Storage | SDK `azblob` v1.8.0 |
| Secrets | Azure Key Vault | `dp-kv-deliverypilot` |
| Deployment | Fly.io | via `flyctl` |
| CI/CD | GitHub Actions | Pages redirect workflow |
| Container | Docker | Multi-stage (Go build → Python slim) |
