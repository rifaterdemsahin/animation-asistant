# 09 — Alternative Image Generation Models

> **Date:** 2026-07-09
> **Context:** Comparing image models for storyboard comic-strip generation to reduce cost or improve quality.
> **Current model:** `google/gemini-3-pro-image` (via OpenRouter)

## Cost Comparison: Full Batch (48 Projects × 3 Acts = 144 Images)

| Model | Provider | Cost/Image | 144 Images | Text Calls (48×$0.007) | **Total 48 Projects** | vs Current |
|-------|----------|-----------|------------|------------------------|----------------------|------------|
| `google/gemini-3-pro-image` | OpenRouter | ~$0.15 | $21.60 | $0.34 | **$21.94** | — (current) |
| `google/gemini-3.1-flash-image` | OpenRouter | ~$0.04 | $5.76 | $0.34 | **$6.10** | **72% cheaper** |
| `google/gemini-3.1-flash-lite-image` | OpenRouter | ~$0.02 | $2.88 | $0.34 | **$3.22** | 85% cheaper |
| `openai/gpt-5-image-mini` | OpenRouter | ~$0.05 | $7.20 | $0.34 | **$7.54** | 66% cheaper |
| `ideogram/v4` (Turbo) | fal.ai | ~$0.06 | $8.64 | $0.34 | **$8.98** | 59% cheaper |
| `fal-ai/seedream/v4` | fal.ai | ~$0.03 | $4.32 | $0.34 | **$4.66** | 79% cheaper |
| `fal-ai/nano-banana-pro` | fal.ai | ~$0.04 | $5.76 | $0.34 | **$6.10** | 72% cheaper |
| `fal-ai/flux/schnell` | fal.ai | ~$0.006 | $0.86 | $0.34 | **$1.20** | 95% cheaper |

> **Note:** OpenRouter model costs include token pricing for both prompt (the ~600-900 token image prompt) and completion. Gemini flash models charge per-token at 4-6× lower rates than pro. Per-image cost shown is estimated from observed usage patterns.

## Model Capability Matrix

| Model | Multi-Panel Layout | Speech Bubbles / Text | Style Consistency | Tech Illustration | Integration Effort |
|-------|-------------------|----------------------|-------------------|-------------------|-------------------|
| `gemini-3-pro-image` ★★★★ | ★★★★ | ★★★★ | ★★★★★ | **None** (current) |
| `gemini-3.1-flash-image` ★★★★ | ★★★★ | ★★★★ | ★★★★★ | **None** (env var only) |
| `openai/gpt-5-image-mini` ★★★★★ | ★★★★★ | ★★★★ | ★★★★ | **None** (env var only) |
| `ideogram/v4` ★★★★ | ★★★★★ | ★★★★★ | ★★★★ | Moderate (new fal.ai image client) |
| `seedream/v4` ★★★ | ★★★ | ★★★★ | ★★★★ | Moderate |
| `flux/schnell` ★★ | ★★ | ★★★ | ★★★ | Moderate |

## Integration Paths

### Path A: OpenRouter Model Swap (Zero Code)
Change one env var, zero code changes.

```bash
# .env or fly secrets
OPENROUTER_IMAGE_MODEL='google/gemini-3.1-flash-image'
# or override only storyboard:
STORYBOARD_IMAGE_MODEL='google/gemini-3.1-flash-image'
```

Works because all OpenRouter image models share the same `POST /chat/completions` API with `message.images[]` response format — the project's `server/openrouter.go:generateImageWith()` already handles this generically.

### Path B: fal.ai Image Integration (Moderate — ~2-3 hours)
Add image support to the existing `server/fal.go:falCall()` which currently only handles audio responses.

Changes needed:
1. **New `falImageCall()` in `server/fal.go`** — parses `{ images: [{ url }] }` response (vs current `{ audio: { url } }`)
2. **Add branch in `server/openrouter.go:generateImageWith()`** — route fal.ai-prefixed models to `falImageCall()`
3. **Python parity** — `shared/openrouter.py:generate_image()` and `shared/components.py`
4. **Set `FAL_KEY`** env var (currently empty in `.env`)

### Path C: Hybrid (OpenRouter for drafts + fal.ai for finals)
Use the cheaper `gemini-3.1-flash-image` for iterative/intermediate storyboard generations, and `ideogram/v4` for final publish-quality renders. Requires Path B infrastructure.

## Recommendations

| Priority | Action | Cost Impact | Effort |
|----------|--------|-------------|--------|
| **Immediate** | Swap to `google/gemini-3.1-flash-image` | Save $15.84 on remaining 26 projects | 30 seconds (env var) |
| **Short-term** | Swap to `openai/gpt-5-image-mini` if better prompt-following needed | Save $14.40 | 30 seconds (env var) |
| **Medium-term** | Add fal.ai image support for `ideogram/v4` | Best comic/infographic quality | 2-3 hours |

## API Key Status

| Service | Key | Status |
|---------|-----|--------|
| OpenRouter | `OPENROUTER_API_KEY` in `.env` | Set, single key, currently exhausted (HTTP 402) |
| fal.ai | `FAL_KEY` in `.env.example` only | **Not set** — needs key to use Path B/C |

## Appendix: OpenRouter Token Pricing (for Image Models)

| Model | Prompt ($/token) | Completion ($/token) | Per-Image Fee |
|-------|-----------------|---------------------|---------------|
| `google/gemini-3-pro-image` | $0.000002 | $0.000012 | $0.000002 |
| `google/gemini-3.1-flash-image` | $0.0000005 | $0.000003 | — |
| `google/gemini-3.1-flash-lite-image` | $0.00000025 | $0.0000015 | — |
| `openai/gpt-5-image-mini` | $0.0000025 | $0.000002 | — |
| `openai/gpt-5-image` | $0.00001 | $0.00001 | — |
