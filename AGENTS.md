# AGENTS.md — Guidance for AI coding agents working on this repo

Read before making changes. Source of truth for *what* we build is `SPEC.md`;
*this* file is *how*. Also read `risks.md` for known issues.

## 1. What this is

Animation Assistant = HTML multi-tool web app to build animation components for
Canva. A **Go backend** (deployed to fly.io) holds the secrets, serves the
static frontend, exposes the API, and calls OpenRouter (Gemini). **Python
scripts** under `scripts/` do local/CLI generation and write to the same storage
layout. Data lives under a storage backend (local `./other` now; **Azure** is
the intended production store — not yet implemented).

Flow per project: **project → outline → script → components → storyboard**.

## 2. Hard rules

- **Three-act structure is mandatory.** `act-1` = Problem, `act-2` = Solution,
  `act-3` = Lesson. Outline is project-level; script/components/audio are per
  act. Never produce a single flat script.
- **Components are typed, not plain images.** Types: `background`,
  `lower-third`, `speech-bubble`, `infographic`, `character`, `icon`,
  `title-card`, `transition` (extensible). Every component references its script
  beat (`script_ref`).
- **Naming prefix:** items are prefixed with the project slug
  (`<slug>-<type>-<n>.<ext>`).
- **Shared layout on every page:** top nav (links + search + logout), header
  showing the current project, footer (GitHub/commits/fly/local). Pages render
  into `<div id="topnav">`, `<header id="app-header">`, `<footer id="app-footer">`
  and include `layout.js` + `auth.js`. Never hand-copy the chrome.
- **Secrets only via env.** Local: `.env` (gitignored). Deployed: `fly secrets`.
  Never log secrets. `ADMIN_PASSWORD` gates all tools (cookie auth).
- **Storage via the Backend interface** (`server/storage/storage.go`). Never
  hardcode `./other` paths in handlers — use `a.store`. Add the Azure impl there.
- **Keep the backend thin:** validate input, delegate to generation, write to
  storage, return JSON. Generation prompts live in `server/script.go`.

## 3. Repo map

```
server/           Go backend (package main): app.go, config.go, auth.go,
                  openrouter.go, jsonx.go, acts.go, projects.go, script.go,
                  healthz.go, util.go, main.go
server/storage/   storage Backend interface + Local (default) + Azure stub
web/              static frontend (index.html + pages/ + assets/{css,js})
                  assets/js/layout.js = shared nav/header/footer + search
                  assets/js/auth.js   = login + requireAuth gate
scripts/          standalone Python workers (generate_script.py …)
shared/           Python helpers mirroring Go logic (config, acts, openrouter,
                  storage, scriptgen)
other/            OUTPUT ONLY (local storage fallback) — gitignored
.env.example      documented keys (placeholders only)
fly.toml/Dockerfile  fly.io deploy (Go build + Python runtime)
risks.md          known risks / TODOs
```

## 4. Run (local)

```bash
cp .env.example .env        # fill ADMIN_PASSWORD + OPENROUTER_API_KEY (+ set both in your shell)
go run ./server             # serves web/ + API on http://localhost:8080
```
Open http://localhost:8080 → redirected to login (`/pages/login.html`).

Python CLI (writes to the same local layout under `./other`):
```bash
python3 -m venv .venv && source .venv/bin/activate && pip install -r requirements.txt
python scripts/generate_script.py create "My topic" --topic "..."
python scripts/generate_script.py outline --slug my-topic
python scripts/generate_script.py script  --slug my-topic           # all 3 acts
python scripts/generate_script.py script  --slug my-topic --act 1   # one act
```

## 5. Deploy (Phase 6)

```bash
fly secrets set ADMIN_PASSWORD=... OPENROUTER_API_KEY=... AZURE_STORAGE_CONNECTION_STRING=...
fly deploy
```
GitHub Pages should redirect to the fly.io URL (see risks.md).

## 6. Conventions

- Go: stdlib-only so far; `gofmt`/`go vet` clean. Handlers in `package main`.
- Frontend: vanilla HTML/CSS/JS, no build step, absolute asset paths (`/assets/...`).
- JSON on disk is pretty-printed UTF-8; timestamps are RFC3339 UTC.

## 7. Known gotchas

- Azure backend is a stub — setting `AZURE_STORAGE_CONNECTION_STRING` currently
  makes every storage call fail. Don't set it until implemented.
- OpenRouter model id is configurable (`OPENROUTER_MODEL`); `google/gemini-2.0-flash-001`
  does NOT exist — default is `google/gemini-2.5-flash`.
- Go + Python prompts are duplicated (drift risk) — see risks.md.

## 8. When in doubt

Re-read `SPEC.md` + `risks.md`. If still unclear, ask before building. Don't
expand scope (new tools/providers) without confirmation.
