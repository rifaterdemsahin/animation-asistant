# 11 — Storyboard Generation Cost Report & Full Pipeline Estimate

> **Date:** 2026-07-09
> **Scope:** 48 projects (q10–q58), 3-act storyboards per project

## Actual Storyboard Costs

### q10–q31: Gemini 3 Pro (first batch)

Used `google/gemini-3-pro-image` at ~$0.146/image.

| Item | Count | Rate | Cost |
|------|-------|------|------|
| Image generations (3 per project) | 66 | $0.146 | $9.64 |
| Scene assembly text calls | 22 | $0.007 | $0.15 |
| Duplicates / retries (q16: 4×, q11: 2×, etc.) | ~18 | $0.146 | $2.63 |
| **Subtotal** | | | **$12.42** |

### q32–q58: Gemini 3.1 Flash (second batch)

Switched to `google/gemini-3.1-flash-image` at ~$0.036/image (75% savings).

| Item | Count | Rate | Cost |
|------|-------|------|------|
| Image generations (3 per project) | 78 | $0.036 | $2.81 |
| Scene assembly text calls | 26 | $0.007 | $0.18 |
| Regens (q38, q51, q52 partial → full) | 9 | $0.036 | $0.32 |
| **Subtotal** | | | **$3.31** |

### Grand Total

| Category | Cost |
|----------|------|
| Pro images (q10–q31) | $9.64 |
| Pro duplicates | $2.63 |
| Flash images (q32–q58) | $2.81 |
| Flash regens | $0.32 |
| Text/assembly calls (48) | $0.34 |
| **Total storyboards** | **$15.74** |

**Per project:** $0.33 average (pro: $0.46, flash: $0.13)

---

## Remaining Phases — Cost Estimate for 48 Projects

### Phase 1: Outline

1 text call per project via `google/gemini-3.5-flash`.

| Item | Count | Rate | Cost |
|------|-------|------|------|
| Text calls | 48 | $0.007 | **$0.34** |

### Phase 2: Script (per act)

3 text calls per project (one per act) via `google/gemini-3.5-flash`.

| Item | Count | Rate | Cost |
|------|-------|------|------|
| Text calls | 144 | $0.007 | **$1.01** |

### Phase 3: Components (per act × type)

Up to 9 component types × 3 acts = 27 images per project. Using `google/gemini-3-pro-image` (~$0.146/image).

| Scenario | Images/Project | Total Images | Rate | Cost |
|----------|---------------|-------------|------|------|
| All 9 types | 27 | 1,296 | $0.146 | **$189.22** |
| Typical (~6 types) | 18 | 864 | $0.146 | **$126.14** |
| Minimal (~4 types) | 12 | 576 | $0.146 | **$84.10** |

Switching components to flash (`gemini-3.1-flash-image`, $0.036/image) would reduce this:

| Scenario | Images/Project | Total Images | Rate | Cost |
|----------|---------------|-------------|------|------|
| All 9 types (flash) | 27 | 1,296 | $0.036 | **$46.66** |
| Typical (flash) | 18 | 864 | $0.036 | **$31.10** |

### Phase 4: Audio

Three layers per act, 48 projects × 3 acts = 144 act-generations.

| Layer | Provider | Model | Est. Rate | Count | Cost |
|-------|----------|-------|-----------|-------|------|
| Voiceover (TTS) | ElevenLabs | `eleven_turbo_v2_5` | ~$0.05/act | 144 | **$7.20** |
| Music | fal.ai | `fal-ai/mmaudio-v2` | ~$0.05/act | 144 | **$7.20** |
| SFX (3 types/act) | fal.ai | `fal-ai/stable-audio` | ~$0.02/sfx | 432 | **$8.64** |
| **Audio subtotal** | | | | | **$23.04** |

---

## Full Pipeline Cost Projection

| Phase | Cost (Pro Components) | Cost (Flash Components) |
|-------|----------------------|------------------------|
| 1. Outline | $0.34 | $0.34 |
| 2. Script | $1.01 | $1.01 |
| 3. Components | $126.14 | $31.10 |
| 4a. Voiceover | $7.20 | $7.20 |
| 4b. Music | $7.20 | $7.20 |
| 4c. SFX | $8.64 | $8.64 |
| 5. Storyboard | $15.74 | $15.74 |
| **Total** | **$166.27** | **$71.23** |

> **Note:** Storyboard cost is actual from OpenRouter logs. Other phases are estimates based on model pricing and typical token usage. ElevenLabs and fal.ai rates are approximate — actual costs depend on input text length and model version.

## Cost per Project

| Components Model | Total | Per Project (48) | Per Project (1) |
|-----------------|-------|-----------------|-----------------|
| Pro (all 9 component types) | $220.35 | $4.59 | $5.13 |
| Pro (typical 6 types) | $166.27 | $3.46 | $3.86 |
| Flash (typical 6 types) | $71.23 | $1.48 | $1.66 |

## Recommendation

Switch components to `gemini-3.1-flash-image` to bring the full pipeline from ~$166 to ~$71 — a 57% reduction. Combined with the already-switched storyboard model, this keeps all image generation on the flash model for maximum savings.
