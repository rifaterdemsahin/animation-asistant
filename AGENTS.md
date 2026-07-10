# Agents — Animation Assistant

Agent coordination rules for the Animation Assistant project (Go+Python web app).

## Agents

| Agent   | Role | Strengths |
|---------|------|-----------|
| Claude  | Primary architect — full 7-stage journey, system design, Go backend, frontend, Python scripts | Structured thinking, multi-file reasoning, error analysis |
| Gemini  | Multimodal specialist — storyboard image review, 3_Simulation visual analysis, image prompt tuning | Image understanding, multimodal comparisons |
| Copilot | GitHub-native — PR reviews, commit discipline, CI/CD, issue management | IDE integration, git workflow, GitHub Actions |
| Kilo Code | Precision code gen — type-safe Go, unit tests, strict linting | Focused edits, minimal changes, testing |

## 7-Stage Structure

| Stage | Folder | Purpose |
|-------|--------|---------|
| 1_Real_Unknown | `1_Real_Unknown/` | Problem discovery, requirements gathering |
| 2_Environment | `2_Environment/` | Context, constraints, existing system analysis |
| 3_Simulation | `3_Simulation/` | Prototyping, modeling, image analysis (Gemini) |
| 4_Formula | `4_Formula/` | Solution design, architecture decisions, Thinking & Planning Gate |
| 5_Symbols | `5_Symbols/` | Implementation — code in `server/`, `web/`, `scripts/`, `shared/` |
| 6_Semblance | `6_Semblance/` | Testing, error logging, Error & Fix logging |
| 7_Testing_Known | `7_Testing_Known/` | Validation, QA, edge cases |

## Hard Rules

- **Never commit secrets** — use Azure Key Vault `dp-kv-deliverypilot` for all secrets. `.env` is gitignored.
- **Commit + push after every command** — each successful operation is committed with a descriptive message.
- **Thinking & Planning Gate** in `4_Formula/` — before any implementation, document the plan in `4_Formula/` and get sign-off.
- **Error & Fix logging** in `6_Semblance/` — every error encountered and its resolution is logged to `6_Semblance/`.
- **Record every prompt** in `prompts.md` — all AI interactions are logged.
- **Keep `index.html` at root** — the web root serves from `web/index.html`.
- **Two-menu navigation system** — `projectMenu` (App, Docs, Specs) and `debugMenu` (all 7 stages + agent files).
- **Active Reflection Routine** — after each task, reflect on what was done, what was learned, and what should change.

## Infrastructure

| Component | Detail |
|-----------|--------|
| Backend | Go (`go run ./server`, port 8080) |
| Frontend | Static HTML/CSS/JS in `web/` |
| Storage | Azure Blob (container: `projects`; prompts container: `prompts`) |
| AI Text | OpenRouter → Gemini models |
| AI Images | OpenRouter → Gemini image models |
| TTS | ElevenLabs (`eleven_turbo_v2_5`, voice "George") |
| Music | fal.ai (`fal-ai/mmaudio-v2`) |
| SFX | fal.ai (`fal-ai/stable-audio`) |
| Deploy | Fly.io (`fly deploy`, `fly secrets`) |
| Secrets | Azure Key Vault `dp-kv-deliverypilot` |
| DNS | GitHub Pages → fly.io redirect |

## Run / Deploy

```bash
# Local
go run ./server                              # http://localhost:8080
open -a "Google Chrome" "http://localhost:8080"

# Deploy
fly deploy

# Secrets from KeyVault
KV=dp-kv-deliverypilot
get(){ az keyvault secret show --vault-name "$KV" --name "$1" --query value -o tsv; }
echo "ADMIN_PASSWORD='$(get AdminPassword)'" > .env
echo "OPENROUTER_API_KEY='$(get OPENROUTER-API-KEY)'" >> .env
echo "AZURE_STORAGE_CONNECTION_STRING='$(get AZURE-STORAGE-CONN-STR-AA)'" >> .env
echo "TTS_API_KEY='$(get ELEVEN-LABS-API-KEY)'" >> .env
echo "FAL_KEY='$(get FAL-KEY)'" >> .env
```

## Active Reflection Routine

After every task:
1. What was the goal?
2. What was actually done?
3. What worked well?
4. What went wrong?
5. What should change for next time?
6. Update `risks.md` and `prompts.md` as needed.
