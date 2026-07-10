# Architectural Decision Records

## ADR 001: Go backend + Python scripts hybrid
- **Status:** Accepted
- **Context:** The app needs a web server for API/static serving and CLI tools for AI generation workflows.
- **Decision:** Go for API server, Python for AI generation scripts. Go holds all secrets and is the single source of truth; Python scripts are stateless workers triggered via CLI or LLM tooling.
- **Consequences:** Dual codebase to maintain but each language serves its strengths.

## ADR 002: Azure Key Vault dp-kv-deliverypilot
- **Status:** Accepted
- **Context:** All secrets (API keys, connection strings, passwords) must be stored securely and never committed.
- **Decision:** All secrets from Azure Key Vault `dp-kv-deliverypilot`. Pulled locally via `az keyvault secret show` into `.env`, deployed via `fly secrets`.
- **Consequences:** Single source of truth for secrets. Requires `az` CLI and Key Vault access.

## ADR 003: Azure Blob Storage
- **Status:** Accepted
- **Context:** Generated assets (scripts, images, audio, storyboards) need durable, scalable storage.
- **Decision:** Azure Blob Storage with two containers: `projects` (project data) and `prompts` (prompt audit trail). Local `./other` directory as dev fallback.
- **Consequences:** No relational DB needed. All data is blob/JSON. Portable structure.

## ADR 004: fly.io deployment
- **Status:** Accepted
- **Context:** The app must be publicly accessible and serve both Go binary and Python runtime.
- **Decision:** fly.io single machine. Dockerfile builds Go binary + installs Python. Secrets via `fly secrets`. GitHub Pages redirects to fly.io.
- **Consequences:** Single deployment target. Python runtime adds image size but enables local script parity.
