# Claude — Animation Assistant Persona

## 7-Stage Journey

| Stage | Folder | My Role |
|-------|--------|---------|
| 1_Real_Unknown | `1_Real_Unknown/` | Discover requirements, frame the problem, research unknowns |
| 2_Environment | `2_Environment/` | Analyze existing system, document constraints, map dependencies |
| 3_Simulation | `3_Simulation/` | Prototype solutions, model behavior, evaluate trade-offs |
| 4_Formula | `4_Formula/` | Design architecture, write specs, Thinking & Planning Gate sign-off |
| 5_Symbols | `5_Symbols/` | **Implement code** in `server/`, `web/`, `scripts/`, `shared/` |
| 6_Semblance | `6_Semblance/` | Log errors, track fixes, run tests, Error & Fix logging |
| 7_Testing_Known | `7_Testing_Known/` | Validate, QA, edge case testing, compare model outputs |

## Folder Structure (5_Symbols — Implementation)

```
animation-asistant/
├── server/           Go backend (main): app, config, auth, openrouter,
│                     elevenlabs, components, audio, storyboard, projects,
│                     script, acts, healthz, util, errors, prompts, fal,
│                     main_test.go
│   └── storage/      Backend interface + Local + Azure (azblob SDK)
├── web/              Static frontend: HTML pages, assets/js/{layout,auth,
│                     media-manager,storyboard,projects,dashboard,debug}.js,
│                     assets/css/styles.css
├── scripts/          Python local generators (generate_script, generate_components,
│                     generate_audio, generate_storyboard)
├── shared/           Python helpers (config, acts, openrouter, elevenlabs,
│                     components, audio, storyboard, storage, prompts)
├── fly.toml          Fly.io app definition
├── Dockerfile        Multi-stage Go + Python build
├── go.mod / go.sum   Go module dependencies
├── requirements.txt  Python dependencies
└── other/            Local storage fallback (gitignored)
```

## Infrastructure

| Service | Purpose | Access |
|---------|---------|--------|
| Fly.io | Hosting — https://animation-assistant.fly.dev/ | `fly deploy`, `fly secrets` |
| Azure Blob | Project data + generated assets | Connection string via KeyVault |
| Azure Key Vault | Secret store (`dp-kv-deliverypilot`) | `az keyvault secret show` |
| OpenRouter | AI text + image generation (Gemini) | API key via KeyVault |
| ElevenLabs | TTS voiceover | API key via KeyVault |
| fal.ai | Music + SFX generation | API key via KeyVault |
| GitHub Pages | Domain redirect → fly.io | `.github/workflows/static.yml` |

## Two-Menu Navigation

```javascript
// projectMenu — user-facing links
[
  {"label": "App", "url": "https://animation-assistant.fly.dev/"},
  {"label": "Docs", "url": "markdown_renderer.html?file=2_Environment/README.md"},
  {"label": "Specs", "url": "markdown_renderer.html?file=4_Formula/README.md"}
]

// debugMenu — 7 stages + agent files
[
  {"label": "1_Real_Unknown", "children": [{"label": "README", "url": "markdown_renderer.html?file=1_Real_Unknown/README.md"}]},
  {"label": "2_Environment", "children": []},
  {"label": "3_Simulation", "children": [{"label": "README", "url": "markdown_renderer.html?file=3_Simulation/readme.md"}]},
  {"label": "4_Formula", "children": [{"label": "README", "url": "markdown_renderer.html?file=4_Formula/README.md"}, {"label": "Architecture", "url": "markdown_renderer.html?file=4_Formula/01-architecture.md"}, {"label": "Backend", "url": "markdown_renderer.html?file=4_Formula/02-backend.md"}, {"label": "Frontend", "url": "markdown_renderer.html?file=4_Formula/03-frontend.md"}, {"label": "API", "url": "markdown_renderer.html?file=4_Formula/04-api.md"}, {"label": "Data Model", "url": "markdown_renderer.html?file=4_Formula/05-data-model.md"}, {"label": "Storage", "url": "markdown_renderer.html?file=4_Formula/06-storage.md"}, {"label": "Pipeline", "url": "markdown_renderer.html?file=4_Formula/07-pipeline.md"}]},
  {"label": "5_Symbols", "children": [{"label": "Server", "url": "markdown_renderer.html?file=5_Symbols/server.md"}, {"label": "Web", "url": "markdown_renderer.html?file=5_Symbols/web.md"}, {"label": "Scripts", "url": "markdown_renderer.html?file=5_Symbols/scripts.md"}, {"label": "Shared", "url": "markdown_renderer.html?file=5_Symbols/shared.md"}]},
  {"label": "6_Semblance", "children": [{"label": "README", "url": "markdown_renderer.html?file=6_Semblance/README.md"}, {"label": "Errors", "url": "markdown_renderer.html?file=6_Semblance/errors.md"}]},
  {"label": "7_Testing_Known", "children": [{"label": "README", "url": "markdown_renderer.html?file=7_Testing_Known/README.md"}]},
  {"label": "Agents", "children": [{"label": "claude.md", "url": "markdown_renderer.html?file=claude.md"}, {"label": "gemini.md", "url": "markdown_renderer.html?file=gemini.md"}, {"label": "copilot.md", "url": "markdown_renderer.html?file=copilot.md"}, {"label": "kilocode.md", "url": "markdown_renderer.html?file=kilocode.md"}, {"label": "agents.md", "url": "markdown_renderer.html?file=agents.md"}]}
]
```

## Go-Code Specific Instructions

- **Run**: `go run ./server` (serves on `http://localhost:8080`)
- **Test**: `go test ./server` (runs `main_test.go`)
- **Build**: `CGO_ENABLED=0 go build -o /out/app ./server`
- **Module**: Uses stdlib-only Go (no external web framework)
- **Pattern**: Handler functions register on `mux.HandleFunc`, middleware wraps with error handling
- **Storage**: All handlers use `a.store` (Backend interface) — never raw file paths
- **Errors**: Structured JSON `{"error": true, "code": "...", "message": "...", "timestamp": "..."}`
- **Secrets**: Read from `os.Getenv()`, never hardcoded, never logged

## Python Scripts (Local Generation)

```bash
python scripts/generate_script.py     create "Topic" --topic "..."
python scripts/generate_script.py     outline --slug my-topic
python scripts/generate_script.py     script  --slug my-topic
python scripts/generate_components.py --slug my-topic
python scripts/generate_audio.py      --slug my-topic
python scripts/generate_storyboard.py --slug my-topic
```

## Error Tracking Workflow

1. Error detected → log to `6_Semblance/` with full context
2. Capture: timestamp, operation, file/line, error message, stack trace
3. Fix implemented → record the fix alongside the error
4. Test added to prevent regression
5. Update `risks.md` if needed

## Testing Checklist

- [ ] `go test ./server` passes
- [ ] `go build ./server` compiles
- [ ] Python scripts run without import errors
- [ ] No secrets in committed files (grep for keys, passwords)
- [ ] Frontend pages load without JS errors
- [ ] Debug bar shows no server errors after generation
