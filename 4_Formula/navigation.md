# Navigation Formula — Animation Assistant

## Two-Menu System

### Project Menu (App)
Links to core application pages: Dashboard → Projects → Storyboard → Media Manager → Audio → Create → Test → Tools → Login

### Debug Menu (7 Stages + Agent Files)
Links to all 7-stage directories and agent coordination files for project management.

## Layout Implementation

- Shared layout via `web/assets/js/layout.js` — injects top menu + footer + debug bar into every page
- Footer shows build commit SHA + started_at timestamp (or `local` for dev)
- Auth-conditional nav: logged out shows "🔐 Login", logged in shows "👤 Logged in" badge + "Log out"
- Search bar in nav for finding pages
- Debug bar collapsible at bottom, captures JS errors + API call actions

## Navigation Principles

1. Every page reuses the shared shell — no page builds its own chrome
2. Project menu for user-facing tools; debug menu for developer/agent visibility
3. Active project displayed in header
