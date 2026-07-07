# AGENTS.md — Guidance for AI coding agents working on this repo

This file tells any coding agent (human or AI) how this project is structured,
what the rules are, and how to run/build/deploy it. **Read this before making
changes.** The source of truth for *what* we are building is `SPEC.md`.

---

## 0. Working order

The owner requested: **spec + AGENTS.md first, before any implementation.**
Do not jump ahead. Implement in the phased order in `SPEC.md §12` unless told
otherwise. When unsure, ask before generating large amounts of code.

## 1. What this project is

Animation Assistant = HTML multi-tool web app to help build animations.

- Shared top menu + footer on every page.
- A **Media Manager** generates **script**, **images**, **audio**.
- A **Storyboard Creator** turns **act scripts** + **images** into a storyboard
  using **OpenRouter (Gemini models)**.
- Output for each animation lives in its own folder under `other/`.
- Runs locally and deploys to **fly.io**.

**Three-Act structure is mandatory.** Every project is built on three acts:
- `act-1` = **Problem**, `act-2` = **Solution**, `act-3` = **Lesson**.
- Script, images, and audio are generated **per act**.
- The storyboard groups scenes by act.
Never generate a project as a single flat script; always split into the 3 acts.

## 2. Repository map

```
web/        static HTML/CSS/JS frontend (shared layout in assets/js/layout.js)
server/     Python backend: serves static files + JSON API, orchestrates calls
scripts/    standalone Python generation workers (script/image/audio)
shared/     config, paths, io helpers shared by server + scripts
other/      OUTPUT ONLY — one subfolder per animation project (gitignored)
  other/<slug>/project.json          metadata (topic, type, acts status)
  other/<slug>/act-1-problem/{script,components,audio}
  other/<slug>/act-2-solution/{script,components,audio}
  other/<slug>/act-3-lesson/{script,components,audio}
  other/<slug>/storyboard/storyboard.json
.env        local secrets (NEVER commit) — loaded by server at startup
.env.example  documented placeholder keys (committed)
fly.toml    fly.io app definition
```

- `other/` is **generated output**, treat it as disposable data, not source.
  Never check generated assets into git.
- Each animation project = one folder `other/<slug>/` with `project.json`,
  split into the three act folders (`act-1-problem`, `act-2-solution`,
  `act-3-lesson`).

## 3. Rules (do / don't)

**DO**
- Keep every page inside the shared layout (top menu + footer). Edit the layout
  helper once; never copy the menu/footer by hand into each page.
- Make generation scripts standalone and CLI-callable (server calls the same
  code). Example: `python scripts/generate_image.py --project x --prompt "..."`.
- Read secrets **only** from environment variables (via `os.environ` / pydantic
  settings). Local: `.env`. Remote: fly.io secrets.
- Write all generated artifacts into `other/<project>/<kind>/`.
- Keep the backend thin: it validates input, delegates to `scripts/`/APIs,
  writes files, returns JSON.
- Prefer small, composable functions; one responsibility per script.

**DON'T**
- Don't hardcode API keys, tokens, or passwords anywhere.
- Don't commit `.env`, `other/`, or any generated asset.
- Don't build pages without the shared menu/footer.
- Don't store output anywhere except under `other/`.
- Don't add heavy frameworks unless the owner approves.

## 4. Secrets model (important)

Secrets are identical in name locally and on fly.io, only the *delivery*
differs:

| Variable          | Local source | Deployed source |
|-------------------|--------------|-----------------|
| `OPENROUTER_API_KEY` | `.env` | `fly secrets set` |
| `IMAGE_API_KEY`      | `.env` | `fly secrets set` |
| `TTS_API_KEY`        | `.env` | `fly secrets set` |
| `FLY_API_TOKEN`      | `.env` / keychain | n/a (deploy only) |

- When adding a new secret: add it to `.env.example` (placeholder), document it
  in `SPEC.md §7`, and tell the owner to run `fly secrets set KEY=value`.
- Never print secrets to logs. Redact before logging request bodies.

## 5. How to run (once Phase 1 exists)

Local dev:
```bash
cp .env.example .env        # then fill real values
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
python server/app.py        # serves web/ + API on http://localhost:8080
```

CLI test of a generation worker (no server needed):
```bash
python scripts/generate_script.py --project demo --topic "..."
python scripts/generate_image.py  --project demo --prompt "..."
python scripts/generate_audio.py  --project demo --text "..."
```

## 6. How to deploy

Deploy runs from the owner's local machine using the existing fly token:
```bash
# one-time per new secret:
fly secrets set OPENROUTER_API_KEY=... IMAGE_API_KEY=... TTS_API_KEY=...
# every release:
fly deploy
fly apps open        # or visit the fly.io URL
```
- Never put secrets in the deployed image; they come from `fly secrets`.
- After deploy, verify the remote app can read secrets (a `/healthz` that
  reports which keys are present — without printing values).

## 7. Coding conventions

- Python: functions typed, `pathlib` for paths, no shell-out when a library
  exists. One entry-point per script with `argparse`.
- HTML/CSS/JS: semantic HTML, small modules, no build step required. Shared
  styling in `web/assets/css/styles.css`.
- File naming: lowercase-hyphenated (`media-manager.html`).
- Keep commits focused; this repo already has a GitHub remote
  (`git@github.com:rifaterdemsahin/animation-asistant.git`).

## 8. Environment facts (verified)

- OS: macOS (arm64). Python 3.14, Node v22, ffmpeg present, fly CLI present
  and authenticated as `rifaterdemsahin@gmail.com`.
- `OPENROUTER_API_KEY` is already exported in the owner's local shell.
- No implementation files exist yet — start from Phase 1 in `SPEC.md §12`.

## 9. When in doubt

- Re-read `SPEC.md`. If still unclear, ask the owner before building.
- Don't expand scope (new tools, new providers) without confirmation.
