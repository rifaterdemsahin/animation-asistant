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
  ELEVEN-LABS, FAL-KEY). `.env` is gitignored; `.dockerignore` keeps it out of the image.
- 🔴 **fly secrets import truncates values containing `#`.** The `#` character is
  treated as a comment delimiter in unquoted `.env`-style values. If passwords or
  connection strings contain `#`, they must be **single-quoted** in the import
  file. The `AdminPassword` currently contains `#` and was truncated on fly
  (causing `invalid password` on login). **Fix:** run `fly secrets set
  ADMIN_PASSWORD="<value>"` with double quotes, or use single quotes in the
  import file. Re-import all secrets that may contain `#`.
- ✅ **GitHub Pages → fly.io redirect** (`.github/workflows/static.yml` now
  publishes a single meta-refresh redirect page).
- 🟢 **`FLY_API_TOKEN`:** deploy ran via the already-authenticated fly CLI
  (`fly auth whoami`), so no token-in-env was required.

## Data model / naming

- ✅ **Project-name prefix on items enforced.** Component files are named
  `<slug>-<type>-NN.png`; manifest `components.json` carries `script_ref`.
- 🟢 Go unit tests exist (`server/main_test.go`); no UI/Playwright tests yet.

## Audio (fal.ai music + SFX)

- 🟡 **fal.ai audio generation added.** Music via `fal-ai/mmaudio-v2`, sound
  effects via `fal-ai/stable-audio`. Key from KeyVault (`FAL_KEY`). Endpoints:
  `POST /api/projects/{slug}/audio/music`, `POST /api/projects/{slug}/audio/sfx`.
- 🟡 **fal.ai models subject to change.** Model IDs (`fal-ai/mmaudio-v2`,
  `fal-ai/stable-audio`) may be deprecated. Keep them configurable.
- 🟢 Music + SFX stored under `<act-slug>/audio/music.mp3` and
  `<act-slug>/audio/sfx-*.mp3` in Azure Blob.

## Prompt audit trail

- ✅ **All prompts saved to Azure.** Every generation call (outline, script,
  components, audio, music, SFX, storyboard) writes the full prompt payload to
  `<slug>/prompts/<timestamp>-<act>-<step>.json`. Enables debugging and
  reproducibility.

## Functional status

- ✅ Phase 1 skeleton · ✅ Phase 2 script · ✅ Phase 3 components · ✅ Phase 4
  audio (TTS + music + SFX) · ✅ Phase 5 storyboard · ✅ Phase 6 deploy.
- ✅ Project creation page (`/pages/create.html`) with Q&A input, single-act test
  mode, and bulk full-pipeline mode for Canva workflows.
- ✅ Audio tools page (`/pages/audio.html`) with voiceover, music, and SFX panels.
- ✅ OpenRouter logs link in footer; distinct `X-Title: animation-assistant-fly`.
- 🟢 All verified live + locally.
