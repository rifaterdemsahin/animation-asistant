# Risks

After completing **all phases (1–6)** the app is live at
**https://animation-assistant.fly.dev/** (GitHub Pages redirects here).
Status: ✅ mitigated · 🟡 partial / accepted · 🟢 low.

## Storage

- ✅ **Azure backend implemented and tested.** `server/storage/storage.go` now
  uses the Azure Blob SDK (`azblob`); selected automatically when
  `AZURE_STORAGE_CONNECTION_STRING` is set. Verified end-to-end (project files
  written/read as blobs in the `projects` container).
- ✅ **Deployed app uses Azure** (healthz reports `storage: azure:projects`), so
  data persists across fly.io restarts/redeploys.
- 🟢 Local `./other` remains as a fallback when no connection string is set.

## Architecture (reframed — not a risk)

- ✅ **Go vs Python is intentional dual-mode, not duplication.** Per the owner:
  **Python** = local generation triggered by the AI agent (`scripts/*.py`,
  writes to local `./other`); **Go** = browser-based generation on fly.io
  (`server/`, writes to Azure). They serve different contexts on purpose.

## Auth & security

- 🟡 **Basic login only (by design).** Single shared `ADMIN_PASSWORD` (from
  Azure KeyVault → fly secret). No 2FA, no rate limiting on `/api/login`. This
  is accepted for a single-user tool. Action if exposed broadly: add rate
  limiting + fail2ban-style lockout.
- 🟡 **Auth cookie `HttpOnly` + `SameSite=Lax`, not `Secure`** (so local http
  works). Behind fly.io TLS this is fine; set `Secure=true` if ever proxied over
  plain http.
- 🟢 7-day HMAC token; rotating `AUTH_SECRET`/`ADMIN_PASSWORD` invalidates all.

## OpenRouter / model tokens (expiry + usage limits)

- ✅ **Multi-key rotation.** `OPENROUTER_API_KEY` may be comma-separated; the
  client rotates to the next key on **401/402/429** (invalid/expired/limit) and
  returns a clear message. Mitigates the token validation-date / usage-limit
  concern.
- ✅ **Model selection = good quality + good rate.** Text & storyboard:
  `google/gemini-2.5-flash`. Images: `google/gemini-2.5-flash-image`. All on
  OpenRouter (one bill). TTS: ElevenLabs (`eleven_turbo_v2_5`, voice "George").
  All configurable via env.
- 🟡 **No per-call retry/backoff.** A generation failure aborts the batch
  mid-way (acts are independent, so partial progress is kept, but the handler
  returns 500). Action: per-act retry + idempotent resume.
- 🟢 Prompt injection from topic/title into LLM output — low risk for this tool.

## Deployment

- ✅ **Deployed to fly.io** as app `animation-assistant`
  (https://animation-assistant.fly.dev). Flexible naming handled (name was free).
- ✅ **Secrets populated from Azure KeyVault** (`dp-kv-deliverypilot`) into both
  local `.env` and `fly secrets` (AdminPassword, OPENROUTER, AZURE-CONN-STR,
  ELEVEN-LABS). `.env` is gitignored; `.dockerignore` keeps it out of the image.
- ✅ **GitHub Pages → fly.io redirect** (`.github/workflows/static.yml` now
  publishes a single meta-refresh redirect page).
- 🟢 **`FLY_API_TOKEN`:** deploy ran via the already-authenticated fly CLI
  (`fly auth whoami`), so no token-in-env was required.

## Data model / naming

- ✅ **Project-name prefix on items enforced.** Component files are named
  `<slug>-<type>-NN.png`; manifest `components.json` carries `script_ref`.
- 🟢 Go unit tests exist (`server/main_test.go`); no UI/Playwright tests yet.

## Functional status

- ✅ Phase 1 skeleton · ✅ Phase 2 script · ✅ Phase 3 components · ✅ Phase 4
  audio · ✅ Phase 5 storyboard · ✅ Phase 6 deploy. All verified live + locally.
