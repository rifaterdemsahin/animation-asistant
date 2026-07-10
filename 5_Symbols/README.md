# 5_Symbols — Code Artifacts

This stage maps to the actual code in the project. The symbols (code artifacts) live in:

| Location | Contents |
|----------|----------|
| `server/` | Go backend API — `main.go`, `acts.go`, `script.go`, `storyboard.go`, `components.go`, `audio.go`, `openrouter.go`, `elevenlabs.go`, `fal.go`, `prompts.go`, `prompts_api.go`, `auth.go`, `backup.go`, `errors.go`, `healthz.go`, `config.go`, `util.go`, `jsonx.go`, `main_test.go` + `storage/storage.go` |
| `web/` | Frontend HTML/CSS/JS — 17 pages + shared assets (`layout.js`, `auth.js`, `debug.js`, `styles.css`) |
| `scripts/` | Python generation scripts — 8 scripts (`generate_script.py`, `generate_image.py`, `generate_audio.py`, etc.) |
| `shared/` | Python shared library — acts, audio, components, config, openrouter, prompts, scriptgen, storage, tts, imagegen |
| `Dockerfile` | Container build for fly.io deployment |
| `fly.toml` | Fly.io deployment configuration |
| `go.mod` / `go.sum` | Go module dependencies |
| `requirements.txt` | Python dependencies |
| `.github/workflows/` | CI/CD — GitHub Pages redirect, deploy |

## Key Architecture

- **Go backend** (`server/`): 18 Go files + storage layer. Single binary, serves static frontend + REST API.
- **Frontend** (`web/`): Static HTML/CSS/JS with shared layout injection. No framework.
- **Python workers** (`scripts/` + `shared/`): CLI tools for local generation. Use same prompt templates as Go.
- **Config**: `.env` (gitignored), `fly.toml`, `Dockerfile`, `go.mod`, `requirements.txt`.
