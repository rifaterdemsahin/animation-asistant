# animation-assistant

HTML multi-tool web app that builds animation **components** (script → typed
images → audio → storyboard) on a fixed **3-act** structure (Problem → Solution
→ Lesson), ready to drop into a Canva video timeline.

- **Go backend** (deployed to fly.io) holds secrets, serves the static UI, and
  calls **OpenRouter (Gemini)** for text generation.
- **Python scripts** (`scripts/`) do the same generation locally/CLI.
- Storage is abstracted (local `./other` now; **Azure** is the intended store).
- Shared top nav (links + search), current-project header, and footer on every page.
- Admin login (password in `.env` / fly secret) gates all tools.

See **[SPEC.md](SPEC.md)** for the full design, **[AGENTS.md](AGENTS.md)** for
contributing rules, and **[risks.md](risks.md)** for known issues.

## Quickstart (local)

```bash
cp .env.example .env          # set ADMIN_PASSWORD and OPENROUTER_API_KEY
export $(grep -v '^#' .env | xargs)   # or put them in your shell
go run ./server               # http://localhost:8080  (login → /pages/login.html)
```

Python CLI (writes under `./other`):

```bash
python3 -m venv .venv && source .venv/bin/activate && pip install -r requirements.txt
python scripts/generate_script.py create "Why sleep matters" --topic "..."
python scripts/generate_script.py outline --slug why-sleep-matters
python scripts/generate_script.py script  --slug why-sleep-matters
```

## Status

- ✅ Phase 0 — specs + agents guide
- ✅ Phase 1 — skeleton (Go backend, shared layout, auth, project CRUD)
- ✅ Phase 2 — outline + per-act script generation (OpenRouter/Gemini), Media Manager UI
- ⏳ Phase 3 — typed components / images
- ⏳ Phase 4 — audio (TTS)
- ⏳ Phase 5 — storyboard creator
- ⏳ Phase 6 — fly.io deploy + GitHub Pages redirect
