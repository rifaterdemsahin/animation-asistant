# Cloudflare Workers — Animation Assistant

## Status: Not Currently Used

Cloudflare Workers are **not integrated** in the Animation Assistant project. There are no Worker scripts, Cloudflare API configuration, or Wrangler setup anywhere in the codebase.

## Current Edge / CDN

The app is served directly from **Fly.io** (region `iad`, Ashburn VA). Fly.io handles:
- HTTPS termination
- Global anycast edge proxy
- Auto-scaling (zero-to-N machines)

GitHub Pages (`rifaterdemsahin.github.io/animation-asistant/`) provides a redirect to the Fly.io URL — no Worker involved.

## If Cloudflare Workers Were Added

Workers would be useful for:
- **Edge caching** of static assets (CSS, JS, images) closer to users
- **Rate limiting** or bot protection on API endpoints
- **Custom redirect logic** (more flexible than the current meta-refresh)
- **A/B testing** or canary deployments

To integrate, you would:
1. Add the domain to Cloudflare DNS
2. Write a Worker script in `cloudflare-worker/`
3. Deploy via `wrangler deploy` or GitHub Actions

For now, Fly.io's built-in edge proxy + GitHub Pages redirect provide sufficient serving capability for a single-user development tool.
