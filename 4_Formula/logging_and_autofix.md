# Logging Strategy & Auto-Fix

## Error Logging

| Source | Destination | Format |
|--------|-------------|--------|
| Go backend | In-memory ring buffer + `/api/errors` endpoint | Structured JSON: `{error, code, message, timestamp}` |
| Python scripts | stderr | Plain text with timestamp prefix |
| Client JS | Debug bar (UI) | Captured via `window.onerror`, non-2xx fetch responses, `unhandledrejection` |
| Prompt audit | Azure Blob `prompts/<projectId>/` | Full prompt payload per generation call |

## Error Structure (Go Backend)

```json
{
  "error": true,
  "code": "openrouter_error",
  "message": "act act-1: OpenRouter error: all keys failed",
  "timestamp": "2026-07-10T23:00:00Z"
}
```

## Continuous Fix Agent Concept

A nightly agent that:
1. Pulls errors from `/api/errors`
2. Checks all pages for JS errors via debug bar
3. Opens GitHub issues for unresolved problems
4. Attempts automated fixes for known patterns (key rotation, model fallback)
5. Logs all actions to `6_Semblance/error.log` and `6_Semblance/fix.log`
