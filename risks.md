# Risks

Captured after completing **Phase 1 (skeleton)** and **Phase 2 (script generation)**.
Each item lists severity, owner action, and where it should be resolved.

Legend: 🔴 high · 🟡 medium · 🟢 low.

## Storage

- 🔴 **Azure backend not implemented.** The storage interface
  (`server/storage/storage.go`) has a local filesystem backend (default) and an
  Azure placeholder that returns "not implemented". All data currently lives in
  `./other`. **Action:** implement the Azure Blob backend (Go SDK + shared key
  / SAS), set `AZURE_STORAGE_CONNECTION_STRING`. Needed before real use.
- 🔴 **Local storage on fly.io is ephemeral.** If deployed with no Azure config,
  generated projects are lost on every redeploy/restart. **Action:** do not rely
  on local fs in production; wire Azure first (Phase 3+ prerequisite).
- 🟢 **`./other` is gitignored.** Fresh clones have no data by design (Azure is
  the intended persistent store).

## Spec consistency (Draft v2 has internal contradictions)

- 🟡 **§11/§10 are stale.** The Overview (§1) and Architecture (§4) call for a
  **Go** backend + **Azure** storage, but §11 still says "Python (FastAPI)" and
  §10 still lists `server/ # Python backend` and `other/`. **This build follows
  the Overview/Architecture (Go).** Action: reconcile the SPEC text.
- 🟡 **Go vs Python generation duplication.** Outline/script prompts exist in
  both `server/script.go` and `shared/scriptgen.py`. They can drift. Action:
  pick one canonical generator (recommend Go, since it holds the secrets and
  deploys) and make the Python CLI call the Go API instead of duplicating.

## Auth & security

- 🟡 **Single shared admin password.** `ADMIN_PASSWORD` in `.env`/fly secret.
  No 2FA, no rate limiting on `/api/login`. Action: add rate limiting + a
  strong password; consider per-request CSRF token for state changes.
- 🟡 **Auth cookie is `HttpOnly` + `SameSite=Lax` but not `Secure`** (so it works
  on local http). Behind fly.io TLS this is acceptable; if ever proxied over
  plain http it is a risk. Action: set `Secure=true` when `PORT`/env indicates
  production.
- 🟢 **No CSRF token.** Same-origin cookie auth; low risk for a single-user tool
  but should be hardened if exposed publicly.
- 🟢 **7-day token, no revocation list.** Changing `ADMIN_PASSWORD`/`AUTH_SECRET`
  invalidates all tokens (acceptable).

## OpenRouter / model

- 🟡 **Default model `google/gemini-2.5-flash`** verified available today; model
  ids change over time. Action: keep `OPENROUTER_MODEL` configurable; add a
  startup model-existence check.
- 🟡 **No retry/backoff.** A single OpenRouter failure aborts the whole script
  batch mid-way (some acts done, some not). Action: per-act retry + idempotent
  resume (acts are independent, so partial progress is fine, but the handler
  should not 500 the whole request).
- 🟢 **Prompt injection** from topic/title into LLM output — not security-critical
  for this tool, but outputs are untrusted text; sanitize before any reuse.

## Deployment

- 🟡 **fly.io app name `animation-assistant` may be taken.** Rename in
  `fly.toml` if `fly deploy` rejects it. Deploy is Phase 6, not done yet.
- 🟡 **`FLY_API_TOKEN` is not set** in the local env. Needed to deploy.
- 🟡 **GitHub Pages → fly.io redirect not configured.** The repo has
  `.github/workflows/static.yml` (Pages build). It must become a redirect to the
  fly.io URL (or be removed) so Pages doesn't serve a stale copy. Action: add a
  redirect `index.html` / CNAME in Phase 6.
- 🟢 **Docker image bundles Python** (for Phase 3/4 media scripts) — larger
  image, acceptable.

## Data model / naming

- 🟢 **Project-name prefix on items** (SPEC: "namings come with project name as
  prefix") is only partially applied (Python `shared/storage.py` notes it).
  Component files (Phase 3) must enforce `<slug>-<type>-<n>.<ext>`.
- 🟢 **No automated tests** yet. Action: add Go table tests for slugify,
  `extractJSON`, token sign/verify; Python tests for `extract_json`.

## Functional gaps (expected — later phases)

- 🟢 Phase 3 (typed components/images), Phase 4 (audio), Phase 5 (storyboard),
  Phase 6 (deploy) are not implemented. Pages for those are stubs/hidden.
