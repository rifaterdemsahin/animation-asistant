# 10 — Google Gemini Direct vs OpenRouter Cost Comparison

> **Date:** 2026-07-09
> **Context:** Cost comparison between OpenRouter (current) and calling Google Gemini directly for storyboard image generation.
> **Current setup:** OpenRouter pay-as-you-go, single key, `google/gemini-3-pro-image`

## OpenRouter Fee Structure

| Plan | Platform Fee | Notes |
|------|-------------|-------|
| Free | $0 | 50 req/day, free models only |
| **Pay-as-you-go** (current) | **5.5%** | 400+ models, no rate limits |
| BYOK (Bring Your Own Key) | **$0** up to $25K/month | 5% after $25K — best option |
| Enterprise | Negotiated | Volume commits, SLAs |

OpenRouter states: *"We do not mark up provider pricing — pricing shown in the model catalog is what you pay which is exactly what you will see on provider's websites."* The 5.5% is the platform fee on top.

---

## Cost Breakdown: 26 Remaining Projects (78 Images)

| Path | Price/Image | 78 Images | 48 Projects (144 images) | Notes |
|------|------------|-----------|--------------------------|-------|
| **OpenRouter pay-as-you-go** (current) | $0.15 | $11.70 | $21.60 | 5.5% fee included |
| **Google Gemini direct** (same model) | $0.142 | $11.08 | $20.45 | **Saves $0.62** on 26 projects |
| **OpenRouter BYOK** (own Google key) | $0.142 | $11.08 | $20.45 | Same as direct, unified API |
| **Google AI Studio free tier** | $0.00 | $0.00 | $0.00 | If image gen counts toward free quota |

### Savings Summary

| Path | vs Current (78 images) | vs Current (144 images) |
|------|----------------------|--------------------------|
| Google direct | Save $0.62 (5.5%) | Save $1.15 |
| OpenRouter BYOK | Save $0.62 (5.5%) | Save $1.15 |
| Google AI Studio free tier | Save $11.70 (100%) | Save $21.60 |

## The Real Savings: Model Choice > Provider Choice

The 5.5% platform fee is negligible compared to **model selection**. Switching models saves far more:

| Model | Provider | Price/Image | 78 Images | vs Current |
|-------|----------|------------|-----------|------------|
| `gemini-3-pro-image` | OpenRouter (current) | $0.15 | $11.70 | — |
| `gemini-3.1-flash-image` | OpenRouter | **$0.04** | **$3.12** | Save $8.58 (73%) |
| `gemini-3.1-flash-image` | Google direct | **$0.038** | **$2.96** | Save $8.74 (75%) |
| `gemini-3.1-flash-lite-image` | OpenRouter | $0.02 | $1.56 | Save $10.14 (87%) |
| `gemini-3.1-flash-lite-image` | Google direct | $0.019 | $1.48 | Save $10.22 (87%) |

**Key takeaway:** Switching to `gemini-3.1-flash-image` saves **73%** regardless of whether you use OpenRouter or Google direct. The provider choice only adds/subtracts ~5%.

## Google AI Studio Free Tier

Google offers free quotas on AI Studio (not Vertex AI):

| Model | Free Requests/Day | Free Tokens/Min (RPM) |
|-------|-------------------|----------------------|
| Gemini 2.5 Flash | 1,500 | 1M tokens/min |
| Gemini 2.5 Pro | 50 | 1M tokens/min |

If storyboard image generation falls under the Flash free tier, **the remaining 26 projects would cost $0**. However:
- Image generation may have separate quotas
- Free tier data may be used for training (can opt out)
- Rate limits may slow batch generation (1,500/day should be fine for 78 images)

## Integration Effort: OpenRouter → Google Direct

### Option A: OpenRouter BYOK (Recommended — Zero Code Changes)

Add your Google API key to OpenRouter's BYOK settings. OpenRouter routes requests using your key, charging $0 platform fee up to $25K/month.

```
No code changes. No env changes. Configure in OpenRouter dashboard.
```

### Option B: Google Gemini API Direct (Moderate — ~2-4 hours)

Replace `server/openrouter.go` calls with Google AI SDK (`@google/generative-ai`):

Changes needed:
1. **New `gemini.go`** — Google AI client using `generativeai` SDK
2. **New env vars** — `GEMINI_API_KEY`, `GEMINI_IMAGE_MODEL`
3. **Branch in `openrouter.go`** — route Google-prefixed models to Gemini client
4. **Python parity** — update `shared/openrouter.py` and `shared/storyboard.py`

### Option C: Hybrid (Best Value + Convenience)

- Keep OpenRouter for text models and routing/fallback
- Add Google direct only for image generation
- Route via model prefix: `google-direct/gemini-3.1-flash-image`

---

## Recommendation Matrix

| Scenario | Best Path | Est. Cost (26 projects) | Effort |
|----------|-----------|------------------------|--------|
| Minimize effort | OpenRouter BYOK + swap to flash | $3.12 | 5 minutes |
| Minimize cost | Google AI Studio free tier + flash | $0.00 | 2-4 hours |
| Best value | OpenRouter BYOK + flash model swap | $3.12 | 5 minutes |
| Maximize quality | Keep pro model, Google direct | $11.08 | 2-4 hours |

**Bottom line:** The 5.5% OpenRouter fee is not the cost driver. The model choice (`pro` vs `flash`) is 15× more impactful. Switch to `gemini-3.1-flash-image` first, then consider BYOK to eliminate the remaining fee.

## Appendix: Gemini Image Model Token Pricing

| Model | Input ($/1M tokens) | Output ($/1M tokens) | Per-Image Fee |
|-------|---------------------|----------------------|---------------|
| `gemini-3-pro-image` (Nano Banana Pro) | $2.00 | $12.00 | $0.000002 |
| `gemini-3.1-flash-image` (Nano Banana 2) | $0.50 | $3.00 | — |
| `gemini-3.1-flash-lite-image` | $0.25 | $1.50 | — |
| `gemini-2.5-flash-image` (original Nano Banana) | $0.30 | $2.50 | $0.0000003 |

*Pricing from OpenRouter model catalog (July 2026). Google direct pricing is identical to these list prices — OpenRouter adds 5.5% on pay-as-you-go.*

## Storyboard Image Prompt Cost Breakdown (per image)

A typical storyboard image prompt is ~800 tokens input + ~2,000 tokens output:

| Model | Input Cost | Output Cost | Image Fee | **Total/Image** |
|-------|-----------|-------------|-----------|-----------------|
| `pro` (current) | $0.0016 | $0.0240 | ~$0.00 | **~$0.026** |
| `flash` | $0.0004 | $0.0060 | — | **~$0.006** |
| `flash-lite` | $0.0002 | $0.0030 | — | **~$0.003** |

> **Note:** The observed $0.15/image cost from OpenRouter logs is higher than this token-based calculation. The discrepancy comes from the Gemini multimodal response that includes both the generated image (large output) AND descriptive text alongside it, inflating output tokens. The model sometimes generates 5,000-10,000+ output tokens for a complex 4-panel comic description.
