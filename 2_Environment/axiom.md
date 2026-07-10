# Axiom — Animation Assistant

## Status: Not Currently Used

Axiom is **not integrated** in the Animation Assistant project. There are no Axiom log shippers, API calls, or configuration in any part of the codebase.

## Current Logging

The project uses its own lightweight logging and error-tracking approach:

| Layer | Mechanism |
|-------|-----------|
| **Server errors** | Structured JSON error responses, in-memory ring buffer at `/api/errors` |
| **Client errors** | Debug bar captures JS errors, failed fetch requests, rejected promises |
| **Deployment logs** | `fly logs` for live Fly.io streaming |
| **Prompt audit** | All generation prompts saved to Azure Blob (`prompts` container) |

## If Axiom Were Added

Axiom would be useful for:
- Centralized log aggregation from Fly.io
- Long-term log retention and querying
- Structured JSON ingestion from the Go backend's error middleware
- Alerting on generation failures or API errors

To integrate, you would add the Axiom Go SDK to `server/` and configure it with `AXIOM_API_TOKEN` + `AXIOM_DATASET` env vars (stored in Key Vault and propagated to `fly secrets`).

For now, this is not needed — `fly logs` + `/api/errors` + the debug bar provide sufficient observability for a single-user tool.
