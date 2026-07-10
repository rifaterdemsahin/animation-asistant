# 01 — Page Error Scan

> **Date:** 2026-07-10
> **Server:** `go run ./server` on `:8080` (Azure storage + ElevenLabs active,
> text=`google/gemini-3.5-flash`, image=`google/gemini-3-pro-image`,
> storyboard image=`google/gemini-3.1-flash-image`, tts=on)
> **Verdict:** ✅ **No errors found** across all pages, states, and interactions.

## Goal

Open every user-facing page, surface any error (HTTP, console, uncaught
exception, failed network/API request, broken interaction), and fix it.

## Method

A headless Chrome (`puppeteer-core` driving the system Google Chrome) loaded each
page as an **authenticated** user, capturing four error channels in parallel:

1. `console` messages of type `error`
2. `pageerror` (uncaught JS exceptions)
3. `requestfailed` (network-layer failures)
4. every HTTP `response` with status `>= 400`

Auth was injected via the `auth` cookie obtained from `POST /api/login`.
Project-specific pages were driven twice — once bare (no project selected) and
once with `localStorage.current_project` pre-set — because most pages are gated
on the selected project and only run their fetch logic when one is present.

## Pages under test (14 routes)

| Page | URL | HTTP |
|---|---|---|
| Dashboard | `/` (serves `web/index.html`) | 200 |
| Projects | `/pages/projects.html` | 200 |
| Create | `/pages/create.html` | 200 |
| Storyboard | `/pages/storyboard.html` | 200 |
| Script | `/pages/script-page.html` | 200 |
| Media Manager | `/pages/media-manager.html` | 200 |
| Audio | `/pages/audio.html` | 200 |
| Tools | `/pages/tools.html` | 200 |
| Compare Models | `/pages/compare-models.html` | 200 |
| Self Learning | `/pages/self_learning.html` | 200 |
| Prompts Editor | `/pages/prompts.html` | 200 |
| Production Process | `/pages/process.html` | 200 |
| Test Runner | `/pages/test.html` | 200 |
| Login | `/pages/login.html` | 200 |

## Results

| Check | Scope | Result |
|---|---|---|
| HTTP status | all 14 routes | all `200` |
| JS syntax (`node --check`) | all 13 files in `web/assets/js/` | all valid |
| Static asset references | every `src`/`href` in all HTML | none missing |
| Console / page errors — bare load | all pages, no project | none |
| Console / page errors — project `q09` | storyboard, script, media-mgr, audio | none |
| Failed API/asset requests (`>= 400`) | all pages, all states | none |
| Button interactions | Show Prompt / Preview / view buttons | none |
| Project × page matrix | 7 projects × 5 project-pages (35 combos) | none |
| `GET /api/errors` (built-in error log) | server-wide recent errors | empty |
| Server log | startup + request log | clean |
| `go vet ./...` | Go backend | clean |
| `go test ./...` | Go backend (`main_test.go`, `prompts_test.go`, `storyboard_test.go`) | pass |

### Rendered-DOM review

The `document.body.innerText` of every page was dumped and inspected for the
usual failure tells (`undefined`, `null`, `[object Object]`, `NaN`, `Error`).
**None found.** Every page renders its expected content (nav + header + footer +
page body).

## Code paths exercised

- **Auth:** `POST /api/login` → cookie; `GET /api/me` gated by `authed()`
  middleware — [server/app.go](../server/app.go), [server/auth.go](../server/auth.go).
- **Project data:** `GET /api/projects`, `GET /api/projects/{slug}` (resolves
  `project_id` **or** legacy `slug`), outline/script/components/audio/storyboard
  reads — [server/projects.go](../server/projects.go), [server/script.go](../server/script.go),
  [server/storyboard.go](../server/storyboard.go).
- **Assets:** `GET /api/projects/{slug}/browse`, `GET /api/projects/{slug}/raw/{path}`
  — [server/app.go serveRaw](../server/app.go).
- **Editable prompts:** `GET /api/prompts`, `GET /api/prompts/{id}` (Azure
  `prompts` container) — [server/prompts_api.go](../server/prompts_api.go).

## Notes / non-issues

- **`/pages/dashboard.html` returns 404.** Not a bug — the nav's "🏠 Dashboard"
  links to `/`, which serves `web/index.html`. No code references
  `dashboard.html`. Left as-is.
- **Compare Models is project-pinned.** `web/assets/js/compare-models.js`
  hard-codes `q10-multi-agent-research-system` by design (it is a fixed Pro-vs-
  Flash comparison page), so it ignores `localStorage.current_project`. Loads
  cleanly with 200s.

## Conclusion

The application surfaces **no errors** in the tested state — all 14 pages load
and render correctly across bare/authed/project-selected states and across a
35-cell project×page matrix, with an empty built-in error log and passing Go
tests. No fixes were required. If a regression appears, re-run the reproduction
script below and compare against this baseline.

## Reproduction

```bash
# 1. start the server
go run ./server

# 2. authenticate (cookie-based auth)
curl -c cookies.txt -X POST http://localhost:8080/api/login \
  -H 'Content-Type: application/json' \
  -d '{"password":"'"$(grep ADMIN_PASSWORD .env | sed "s/ADMIN_PASSWORD=//;s/^'//;s/'$//")"'"}'

# 3. quick endpoint smoke (every route should be 200)
AUTH=$(grep HttpOnly_localhost cookies.txt | awk '{print $NF}')
for u in / pages/projects.html pages/create.html pages/storyboard.html \
         pages/script-page.html pages/media-manager.html pages/audio.html \
         pages/tools.html pages/compare-models.html pages/self_learning.html \
         pages/prompts.html pages/process.html pages/test.html pages/login.html; do
  printf '%s  /%s\n' "$(curl -s -o /dev/null -w '%{http_code}' -b "auth=$AUTH" "http://localhost:8080/$u")" "$u"
done

# 4. backend checks
go vet ./... && go test ./...

# 5. full browser sweep (console + network + interactions) — see README
node <puppeteer script> "$AUTH"   # bare, per-project, click-through, matrix
```
