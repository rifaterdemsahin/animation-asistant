# 03 — Frontend (UI)

## Page Inventory

All pages render into a shared shell: `#topnav` → `#app-header` → page content → `#app-footer`.
Every page includes `<script src="/assets/js/layout.js">`, `<script src="/assets/js/auth.js">`,
and `<script src="/assets/js/debug.js">`.

| Page | File | Purpose |
|------|------|---------|
| Dashboard | `web/index.html` | Landing page: current project panel, quick links to all tools |
| Projects | `web/pages/projects.html` | List, create, delete projects |
| Storyboard | `web/pages/storyboard.html` | Generate storyboard JSON + per-act images (editable prompts) |
| Script | `web/pages/script-page.html` | View/regenerate per-act scripts |
| Media Manager | `web/pages/media-manager.html` | Full pipeline: outline → script → components → audio |
| Audio | `web/pages/audio.html` | Voiceover, music, SFX generation per act |
| Create | `web/pages/create.html` | New project: Q&A input, single/bulk mode |
| Test | `web/pages/test.html` | Hit all API endpoints for testing |
| Tools | `web/pages/tools.html` | Quick links to Canva, OpenRouter, fal.ai, ElevenLabs, Azure |
| Login | `web/pages/login.html` | Admin login form |
| Prompts | `web/pages/prompts.html` | Edit generation prompt templates live |
| Self Learning | `web/pages/self_learning.html` | Bloom's Taxonomy mapping to pipeline |
| Process | `web/pages/process.html` | Production process documentation |

## JavaScript Modules (`web/assets/js/`)

| File | Lines | Purpose |
|------|-------|---------|
| `layout.js` | 164 | Shared shell: top nav (10 links + search + auth), project header, footer |
| `auth.js` | ~30 | Login form handler + redirect logic |
| `debug.js` | ~100 | Client debug bar: error capture, action tracking, copy, pull server errors |
| `dashboard.js` | ~80 | Dashboard: current project panel, quick links |
| `projects.js` | ~100 | Project list, create, delete |
| `storyboard.js` | ~250 | Storyboard UI: per-act prompt editing, execute, image gallery |
| `script-page.js` | ~80 | Script reading per act |
| `media-manager.js` | ~200 | Pipeline orchestrator: step-by-step generation |
| `audio.js` | ~150 | Audio page: voiceover, music, SFX panels |
| `create.js` | ~150 | Project creation: Q&A form, single/bulk modes, progress visualization |
| `prompts.js` | ~100 | Prompt template editing: list, edit, reset |
| `test.js` | ~50 | Test page: hit all endpoints |

## Shared Shell (`layout.js`)

### Top Navigation Bar (`#topnav`)
- **Brand:** `🎬 Animation Assistant` (links to `/`)
- **10 Nav Links:** Dashboard → Projects → Storyboard → Script → Media Manager → Audio → Create → Test → Tools → Self Learning
- **Separator:** ` > ` between links
- **Search:** `<input type="search">` with dropdown results (`PAGES.filter()`)
- **Auth:** Conditional based on `GET /api/me`:
  - Not authenticated → `🔐 Login` link
  - Authenticated → `👤 Logged in` badge + `Log out` button

### Project Header (`#app-header`)
- Reads `current_project` from `localStorage`
- Deep-link support: `?project=<slug>` or `?slug=<slug>` query params set the project
- Displays: `Project: <title> (<slug>)` or `Project: none selected`

### Footer (`#app-footer`)
- Links: Tools, GitHub repo, OpenRouter Logs, fly.io, Local
- Deploy info: commit SHA (from `/healthz`) as clickable link to GitHub commit
- Timestamp: `started_at` from healthz endpoint

## CSS Theme (`web/assets/css/styles.css`, 209 lines)

```css
/* Key variables */
--bg: #0f1115;           /* Dark background */
--bg-card: #1a1d24;      /* Card/section background */
--accent: #6c8cff;       /* Primary accent (blue-purple) */
--text: #e4e6eb;         /* Primary text */
--text-muted: #8a8d94;   /* Muted/secondary text */
--border: #2d3139;       /* Border color */
--error: #ff6b6b;        /* Error/danger */
--success: #51cf66;      /* Success */
--warning: #ffd43b;      /* Warning */

/* Layout */
.navbar      /* Flexbox row: brand + links + search + auth */
.app-header  /* Project context bar */
.footer      /* Bottom bar with links */
.card        /* Standard card component */
.btn         /* Button styles: .btn-primary, .btn-danger, .btn-small */
```

## Client Debug Bar (`debug.js`)

Injected at page bottom, collapsed by default:

```
[Debug] button (always visible in footer)
    ▼
┌─ Debug Bar ──────────────────────────────┐
│  [Errors] tab  │  [Actions] tab          │
│  ┌─────────────────────────────────────┐ │
│  │ timestamp │ url │ method │ status   │ │
│  │ [Copy] button per entry             │ │
│  └─────────────────────────────────────┘ │
│  [Clear]  [Pull server errors]          │
└─────────────────────────────────────────┘
```

- Captures: `window.onerror`, failed fetches (non-2xx), `unhandledrejection`
- Action tracker: all API calls with method, URL, status, duration
- Green ✓ for success, Red ✗ for failure
- Copy button: formats entry for AI agent paste
- "Pull server errors": fetches `GET /api/errors` and appends

## Authentication Flow

```
Page Load
  └── layout.js: checkAuth() → GET /api/me
        ├── 200 → isAuthenticated = true → show "Logged in" + Logout button
        └── 401 → isAuthenticated = false → show "Login" link

Login Flow:
  POST /api/login {password} → 200 → redirect to referrer or "/"

Logout Flow:
  POST /api/logout → clear localStorage.current_project → redirect to login

Auth Cookie: HttpOnly, SameSite=Lax, 7-day expiry
```

## Deep-Link Support

- `?project=<slug>` or `?slug=<slug>` on any page sets the active project
- `setCurrentProject(slug, title)` called by project-aware pages
- Persisted in `localStorage.current_project` as JSON `{slug, title}`

## Page Relationships

```
Dashboard  ──▶  Projects  ──▶  Create (new project)
    │                             │
    ├──▶ Storyboard              ├── Single mode (one act)
    ├──▶ Script                  └── Bulk mode (all 3 acts full pipeline)
    ├──▶ Media Manager
    ├──▶ Audio           Process ──▶ Full pipeline documentation
    ├──▶ Test
    ├──▶ Tools           Self Learning ──▶ Bloom's Taxonomy mapping
    └──▶ Login           Prompts ──▶ Edit generation templates
```
