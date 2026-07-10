# Hypotheses

## H1: 3-Act Structure Produces Better Engagement

**Hypothesis:** A fixed 3-act narrative structure (Problem → Solution → Lesson) produces more engaging explainer animations than a single flat script, because it follows proven storytelling patterns.

**Test:** Compare user retention/feedback for animations created with the 3-act pipeline vs. single-script output. Currently untested — the 3-act structure is enforced by design in all generation steps.

**Status:** Accepted as design axiom. The pipeline (outline → script → components → audio → storyboard) is built around per-act generation from the ground up. No A/B test has been run.

## H2: Storyboard→Script Feedback Loop Improves Script Quality

**Hypothesis:** Injecting storyboard image prompts and file references into the script generation context produces scripts with better visual-narrative alignment (fewer mismatches between narration and generated images).

**Test:** The feedback loop is live — after storyboard generation, per-act image prompts are injected via a `STORYBOARD CONSISTENCY` header. The Script page displays storyboard images for visual verification. Script quality improvement is subjective; no quantitative metrics collected.

**Status:** ✅ Implemented. Qualitative feedback available via visual inspection on the Script page.

## H3: Azure KeyVault Secrets Management Is Sufficient for fly.io Deployment

**Hypothesis:** Pulling secrets from Azure KeyVault (`dp-kv-deliverypilot`) into local `.env` and `fly secrets` provides a secure, auditable, and repeatable deployment workflow without needing a dedicated secrets management platform.

**Test:** All 8 secrets (AdminPassword, OpenRouter keys, Azure connection string, ElevenLabs key, FAL key, model overrides) are managed through KeyVault. The workflow is: `az keyvault secret show` → write to `.env` → `fly secrets set`. Secret rotation is done via Azure Portal.

**Status:** ✅ Validated. KeyVault version history preserves old secrets. New secret names (e.g. `AZURE-STORAGE-CONN-STR-AA`) avoid overwrites. Known pitfall: `fly secrets import` truncates at `#` (comment delimiter) — mitigated by using single-quoted values.

## H4: Per-Component Regeneration with Merge Semantics Is Correct

**Hypothesis:** Regenerating a single component type should only replace that type's entry in the act's `components.json`, preserving all other already-generated types (merge semantics), rather than regenerating everything.

**Test:** The merge approach is implemented — regenerating `infographic` alone uses beat-4 (its canonical index) and only replaces that entry. The Script page shows per-component Generate buttons.

**Status:** ✅ Validated. Works as designed — users can regenerate a single component without wiping others.

## H5: Gemini 3.1 Flash Is a Cost-Effective Replacement for Gemini 3 Pro in Storyboard Images

**Hypothesis:** `google/gemini-3.1-flash-image` produces storyboard infographic quality comparable to `google/gemini-3-pro-image` at 4× lower cost.

**Test:** Side-by-side comparison done in `compare_pro_vs_flash/` directory. Results confirmed flash quality is sufficient for the infographic/comic-strip style used in storyboards.

**Status:** ✅ Validated. Flash model is the default for `STORYBOARD_IMAGE_MODEL`. The pro model remains the default for component images (`OPENROUTER_IMAGE_MODEL`).

## H6: Local Filesystem Fallback Is Sufficient for Development

**Hypothesis:** Using `./other` as a local storage backend (when `AZURE_STORAGE_CONNECTION_STRING` is not set) provides a viable development workflow without needing Azure credentials locally.

**Test:** Local dev currently uses `./other` by default. Storage interface (`Backend`) abstracts both implementations behind the same API. All features work identically with either backend.

**Status:** ✅ Validated. No known gaps between local and Azure storage behavior.
