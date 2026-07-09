# 08 — Storyboard Generation Cost Analysis

> **Date:** 2026-07-09
> **Model:** `google/gemini-3-pro-image` (images), `google/gemini-3.5-flash` (text/assembly)
> **API Gateway:** OpenRouter

## Generation Summary

Batch generation of storyboards for projects q10 through q58 (48 total).

| Status | Projects | Count |
|--------|----------|-------|
| Complete (3-act images generated) | q10–q31 | 22 |
| Pending (API key exhausted) | q32–q58 | 26 |
| **Total** | | **48** |

### Per-Project Breakdown

Each storyboard generation runs in two stages:

| Stage | Model | Calls | Cost/ea | Subtotal |
|-------|-------|-------|---------|----------|
| Scene assembly (JSON plan) | `google/gemini-3.5-flash` | 1 text chat | ~$0.007 | $0.007 |
| Per-act image generation | `google/gemini-3-pro-image` | 3 images | ~$0.15 | $0.45 |
| **Total per project** | | | | **~$0.46** |

### Actual Spend (Observed from OpenRouter Logs)

From the visible log window (~20 calls):

| Type | Calls | Input Tokens | Output Tokens | Cost |
|------|-------|-------------|---------------|------|
| Image (generation) | 17 | ~12,600 | ~30,300 | ~$2.43 |
| Text (scene assembly) | 5 | ~1,900 | ~3,700 | ~$0.12 |
| **Window subtotal** | **22** | | | **~$2.55** |

Total estimated spend across all 22 completed projects (including accidental duplicates from batch-retry overlap): **~$12–13** for ~84 image generations + ~25 text calls.

## Remaining: q32–q58 (26 Projects)

| Item | Calculation | Estimate |
|------|-------------|----------|
| 26 projects × 3 image calls | 78 × $0.15 | $11.70 |
| 26 text calls (scene assembly) | 26 × $0.007 | $0.18 |
| Buffer (retries/duplicates ~15%) | — | $2.00 |
| **Recommended key top-up** | | **$15–20** |

## API Key Status

- Current key `sk-or-v1-...` returned HTTP 402 (payment required / over-limit)
- Server supports comma-separated key rotation (`OPENROUTER_API_KEY=key1,key2`)
- Adding a second $15–20 key enables rotation and resume from q32

## Resume Plan

Once key is topped up or a second key is added, resume with:

```bash
for num in $(seq 32 58); do
  [ $num -eq 43 ] && continue  # q43 does not exist
  slug="q${num}-<type-slug>"
  curl -b /tmp/cookies.txt -X POST \
    "http://localhost:8080/api/projects/$slug/storyboard" \
    -H 'Content-Type: application/json'
done
```

Projects grouped by type for slug pattern reference:

| Range | Type slug |
|-------|-----------|
| q32–q42, q44–q45 | `customer-support-resolution-agent` |
| q46–q58 | `claude-code-for-continuous-integration` |
