# Open Questions

## Q1: Canva Deep-Link Integration
**Status:** ❓ Unresolved
**Question:** Should we push components directly into Canva via their API (deep-link with asset references), or keep the current workflow where users manually download/copy assets and paste them into Canva?
**Context:** Canva has a developer platform with API endpoints for asset upload. Direct push would streamline the workflow but adds auth complexity (Canva OAuth). Current workflow uses clipboard image data + manual drag-drop.
**Impact:** If solved → one-click "Send to Canva" from Media Manager. If not → current manual workflow remains.

## Q2: Video Rendering Pipeline
**Status:** ❓ Backlog
**Question:** Should we add a server-side video rendering step that combines components + audio into a single MP4 per act?
**Context:** Currently, the output is raw assets (images + audio) that the user assembles in Canva. A rendering step would produce finished videos but requires ffmpeg on the server (or a cloud rendering service) and increases fly.io resource requirements.
**Impact:** If solved → downloadable MP4 per act. If not → Canva remains the assembly tool.

## Q3: Multi-Tenant Support
**Status:** ❓ Future
**Question:** Should the app support multiple users with separate project spaces, or remain a single-user tool?
**Context:** Current design uses a single admin password (cookie auth). Multi-tenant would require user accounts, per-user storage isolation, and session management — significant scope increase.
**Impact:** If solved → shared deployment for teams. If not → single-user tool per deployment instance.

## Q4: Custom Component Types
**Status:** ❓ Backlog
**Question:** Should users be able to define custom component types beyond the 9 built-in types (background, lower-third, speech-bubble, infographic, character, icon, title-card, transition, custom)?
**Context:** The pipeline is extensible by design (the type list is not hard-coded), but there's no UI for defining new types with custom prompts, styles, and beat assignment.
**Impact:** If solved → users can invent new visual parts. If not → locked to 9 types.

## Q5: Full-Text Search Across Projects
**Status:** ❓ Backlog
**Question:** Should project search span full-text content (scripts, outlines, component metadata) or remain title/topic-only?
**Context:** Current search (`GET /api/projects`) returns project list with title/topic. Full-text search would require indexing script and outline content in Azure or in-memory.
**Impact:** If solved → search finds projects by script content. If not → only title/topic matching.

## Q6: fal.ai Model Deprecation for SFX
**Status:** ❓ Open
**Question:** When `fal-ai/stable-audio` is deprecated, which replacement model should we use for sound effects?
**Context:** `fal-ai/mmaudio-v2` covers music. `fal-ai/stable-audio` is currently used for SFX. Both model IDs are configurable via env, but a deprecation would require identifying and testing a replacement.
**Impact:** If solved → seamless model migration. If not → SFX generation breaks until config updated.

## Q7: Per-Act Retry/Backoff for OpenRouter
**Status:** ❓ Backlog
**Question:** Should we add exponential backoff and per-act retry for OpenRouter failures, or keep the current fail-fast approach?
**Context:** Currently, an OpenRouter failure aborts the batch mid-way. Acts are independent, so partial progress is kept, but the handler returns 500. Retry logic would improve reliability at the cost of longer generation times.
**Impact:** If solved → fewer failed generations. If not → user retries manually.
