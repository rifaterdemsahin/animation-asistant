# GitHub Pages — Animation Assistant

**Repository:** https://github.com/rifaterdemsahin/animation-asistant  
**GitHub Pages URL:** https://rifaterdemsahin.github.io/animation-asistant/  

## Purpose

GitHub Pages serves a **single redirect page** that forwards users to the live Fly.io app. The app itself is deployed to Fly.io — Pages is purely a redirect entrypoint for the repository.

## Redirect Behavior

The deployed `index.html` uses a meta-refresh redirect:

```html
<meta http-equiv="refresh" content="0; url=https://animation-assistant.fly.dev/">
```

Visitors to `rifaterdemsahin.github.io/animation-asistant/` are immediately forwarded to `https://animation-assistant.fly.dev/`.

## CI/CD: GitHub Actions Workflow

**File:** `.github/workflows/static.yml`

```yaml
name: Deploy redirect to Pages

on:
  push:
    branches: ["main"]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

jobs:
  deploy:
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - name: Checkout
        uses: actions/checkout@v4
      - name: Build redirect page
        run: |
          mkdir -p site
          printf '%s\n' \
            '<!doctype html>' \
            '<html lang="en"><head><meta charset="utf-8">' \
            '<meta http-equiv="refresh" content="0; url=https://animation-assistant.fly.dev/">' \
            '<title>Animation Assistant</title></head>' \
            '<body>Redirecting to <a href="https://animation-assistant.fly.dev/">Animation Assistant</a>.</body></html>' \
            > site/index.html
      - name: Setup Pages
        uses: actions/configure-pages@v5
      - name: Upload artifact
        uses: actions/upload-pages-artifact@v3
        with:
          path: site
      - name: Deploy to GitHub Pages
        id: deployment
        uses: actions/deploy-pages@v5
```

### Trigger

- **Automatic:** On every push to `main` branch
- **Manual:** Via `workflow_dispatch` (GitHub UI → Actions → "Deploy redirect to Pages" → Run workflow)

### Permissions

The workflow requires `contents: read`, `pages: write`, and `id-token: write` permissions (configured via `static.yml`). GitHub Pages must be enabled in the repository Settings → Pages → Source set to "GitHub Actions".

## Verification

After a successful workflow run:

1. Visit `https://rifaterdemsahin.github.io/animation-asistant/`
2. You should be immediately redirected to `https://animation-assistant.fly.dev/`
