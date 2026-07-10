# Copilot — Animation Assistant Persona

## 7-Stage Journey

| Stage | Folder | My Role |
|-------|--------|---------|
| 1_Real_Unknown | `1_Real_Unknown/` | GitHub Issues, feature requests, bug reports |
| 2_Environment | `2_Environment/` | Analyze CI/CD, GitHub Actions workflows, repo health |
| 3_Simulation | `3_Simulation/` | Prototype via PR branches, test new endpoints |
| 4_Formula | `4_Formula/` | Design review via PR comments, Thinking & Planning Gate |
| 5_Symbols | `5_Symbols/` | **Code implementation** in `server/`, `web/`, `scripts/`, `shared/` |
| 6_Semblance | `6_Semblance/` | CI test results, lint checks, PR status |
| 7_Testing_Known | `7_Testing_Known/` | Validate via GitHub Actions, review test outputs |

## Key Strengths: GitHub-Native

- **PR creation and review**: Open, review, and merge PRs
- **CI/CD via GitHub Actions**: `.github/workflows/static.yml` publishes GitHub Pages
- **Commit discipline**: Conventional commits, atomic changes per command
- **Issue management**: Link PRs to issues, track project board
- **Code review**: Inline comments, suggested changes, approval workflow

## Folder Structure

```
animation-asistant/
├── .github/workflows/     GitHub Actions (static.yml — Pages deploy)
├── server/                Go backend
├── web/                   Static frontend
├── scripts/               Python local generators
├── shared/                Python helpers
├── fly.toml               Fly.io config
├── Dockerfile             Multi-stage build
└── other/                 Local storage
```

## Infrastructure

Same as Claude (Fly.io, Azure Blob, Azure Key Vault, OpenRouter, ElevenLabs, fal.ai, GitHub Pages).

## Two-Menu Navigation

Same `projectMenu` + `debugMenu` structure as defined in `claude.md`.

## GitHub-Native Instructions

- **Commit format**: `git add -A && git commit -m "descriptive message" && git push`
- **Branch naming**: `fix/description`, `feat/description`, `refactor/description`
- **PR template**: Include summary, testing notes, screenshots if visual
- **GitHub Actions**: `.github/workflows/static.yml` — on push to main, builds and deploys to GitHub Pages (redirect to fly.io)
- **Secrets**: Never commit `.env` — GitHub Actions uses repository secrets for deploy tokens
- **Code review**: Check for: secrets exposure, error handling, test coverage, Go lint, Python style

## GitHub Workflow

1. Create feature branch from `main`
2. Implement changes
3. Commit + push
4. Open PR with description
5. Run CI checks (if configured)
6. Merge after review
7. Deploy (fly.io or GitHub Pages)

## Run / Deploy

```bash
go run ./server                              # http://localhost:8080
fly deploy
```

## Error Tracking & Testing

Same as Claude — log to `6_Semblance/`, test with `go test ./server`.
