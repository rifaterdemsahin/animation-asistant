# Navigation — Animation Assistant

## Two-Menu System

The project uses a **two-menu** navigation system:

### 1. Project Menu (Top Nav)

Visible on every page. Provides links to all tools and pages. Rendered by `web/assets/js/layout.js`.

**Menu layout:**

```
🏠 Dashboard > 📁 Projects > 📋 Storyboard > 🎛️ Media Manager > 🎧 Audio > 🆕 Create > 🧪 Test > 🛠️ Tools > 🔐 Login
```

- Links are separated by `>` for visual clarity.
- Each item has an emoji prefix.
- Login/Logout is **conditional**: when unauthenticated → `🔐 Login` link; when authenticated → `👤 Logged in` badge + `Log out` button.
- A **search bar** sits in the nav for finding pages.
- The **current project slug** is displayed (when one is active).
- Auth status determined by `GET /api/me` on page load.

### 2. Debug Menu (Footer Bar)

Visible on every page. Rendered by `web/assets/js/debug.js`.

**Menu layout:**

```
🚀 animation-assistant [commit-sha] — started at  [Debug]
```

- Shows deploy-time info (commit SHA, started timestamp, fly.io vs local).
- `[Debug]` button toggles the debug bar.
- Debug bar captures:
  - **Errors:** Uncaught JS errors, failed fetch requests (non-2xx), rejected promises.
  - **Actions:** User-triggered API calls with method, URL, status code, duration (green=success, red=fail).
- Each entry has a **Copy** button (formatted block for pasting into AI agent).
- **Clear** button clears entries.
- **Pull server errors** button fetches `GET /api/errors` and appends to feed.
- Entries capped at 100, auto-rotating.

## Navigation Design Rules

1. **Shared shell:** Every page renders into `#topnav`, `#app-header`, and `#app-footer`. No page builds its own nav/footer.
2. **Single source of truth:** `layout.js` injects the nav + footer. A single edit updates all pages.
3. **Pages directory:** All page content lives in `web/pages/`. The root `web/index.html` is the Dashboard.
4. **Current project context:** The header (`#app-header`) shows which project is active. Links in the nav carry `?project=<project_id>` when a project is selected.
5. **Auth gate:** `auth.js` checks `/api/me` and provides `requireAuth()` for pages that need login.
6. **Debug bar always present:** Even collapsed, the `[Debug]` button is always in the footer. Expand for diagnostic info.

## All Pages

| Route | File | Requires Auth | Description |
|-------|------|---------------|-------------|
| `/` | `web/index.html` | No | Dashboard |
| `/pages/projects.html` | `web/pages/projects.html` | Yes | List/create/delete projects |
| `/pages/media-manager.html` | `web/pages/media-manager.html` | Yes | Generate outline → script → components → audio |
| `/pages/storyboard.html` | `web/pages/storyboard.html` | Yes | Scene-by-scene storyboard from scripts + components |
| `/pages/storyboard-gallery.html` | `web/pages/storyboard-gallery.html` | Yes | View storyboard images |
| `/pages/audio.html` | `web/pages/audio.html` | Yes | Voiceover + music + SFX generation |
| `/pages/create.html` | `web/pages/create.html` | Yes | Project creation (Q&A → single/bulk mode) |
| `/pages/script-page.html` | `web/pages/script-page.html` | Yes | View/edit scripts per act |
| `/pages/scripts.html` | `web/pages/scripts.html` | Yes | Script management |
| `/pages/script-compare.html` | `web/pages/script-compare.html` | Yes | Compare script models |
| `/pages/compare-models.html` | `web/pages/compare-models.html` | Yes | Side-by-side model comparison |
| `/pages/tools.html` | `web/pages/tools.html` | Yes | Quick links + utilities |
| `/pages/test.html` | `web/pages/test.html` | Yes | Test generation endpoints |
| `/pages/prompts.html` | `web/pages/prompts.html` | Yes | Edit prompt templates |
| `/pages/process.html` | `web/pages/process.html` | No | Production process documentation |
| `/pages/self_learning.html` | `web/pages/self_learning.html` | No | Bloom's Taxonomy self-learning guide |
| `/pages/login.html` | `web/pages/login.html` | No | Login page |
