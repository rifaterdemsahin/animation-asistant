# Lessons Learned

## Architecture

- **Go + Python hybrid works well**: Go for API server (performance, static binary), Python for AI generation scripts (ecosystem). Go holds all secrets; Python calls Go API or uses same storage interface.
- **Storyboard-driven script generation is valuable**: Generating storyboard images first, then using them as visual context for script/narration ensures tight audio-visual sync. The cross-phase feedback loop (outline→storyboard→script→components→audio) produces coherent output.

## Infrastructure

- **Azure Key Vault integration is reliable**: `dp-kv-deliverypilot` as single source of truth for secrets. Pull via `az keyvault secret show` into `.env` locally and `fly secrets` for deploy.
- **Prompt audit trail is essential**: Every generation call saves the full prompt payload. Invaluable for debugging, reproducibility, and cost analysis.
- **KeyVault version history preserves old secrets**: New secret names (e.g. `AZURE-STORAGE-CONN-STR-AA`) avoid overwrites.

## Deployment

- **Commit-to-deploy traceability**: `fly deploy --build-arg BUILD_COMMIT=$(git rev-parse --short HEAD)` + Go `-ldflags` = footer shows clickable commit SHA.
- **`#` in secrets must be single-quoted**: `fly secrets import` treats `#` as comment delimiter. Always single-quote values containing `#`.

## Development

- **Emoji-heavy UX works well** for dev tools: menu items, section headers, status badges all benefit from visual cues.
- **File cards with inline image/audio previews** give instant feedback. Modal popup for full-visibility review.
