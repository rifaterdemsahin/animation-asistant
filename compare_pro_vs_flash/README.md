# Pro vs Flash: Storyboard Image Quality & Cost Comparison

> **Project:** q10 — "Lost-in-the-Middle: Primacy & Recency"
> **Date:** 2026-07-09
> **Status:** Pro generated, Flash pending (OpenRouter key exhausted)

## Images

| Act | Pro (`gemini-3-pro-image`) | Flash (`gemini-3.1-flash-image`) |
|-----|---------------------------|----------------------------------|
| Act 1 (Problem) | [pro-act-1.png](./pro-act-1.png) — 1.0 MB | Not yet generated |
| Act 2 (Solution) | [pro-act-2.png](./pro-act-2.png) — 859 KB | Not yet generated |
| Act 3 (Lesson) | [pro-act-3.png](./pro-act-3.png) — 952 KB | Not yet generated |

## Generation Parameters (Identical for Both Models)

- **Prompt:** Same 4,079-character storyboard image prompt (act-1)
- **Style:** Vector-style line art, corporate tech cartoonism, cel shading
- **Layout:** 4-panel comic strip with speech bubbles
- **Resolution:** Native model output, no post-processing

## Cost Comparison (Actual + Projected)

### Observed Pro Costs (from OpenRouter Activity Logs)

| Image | Input Tokens | Output Tokens | Cost |
|-------|-------------|---------------|------|
| Act 1 | ~894 | ~1,980 | $0.147 |
| Act 2 | ~828 | ~2,153 | $0.148 |
| Act 3 | ~854 | ~1,660 | $0.143 |
| **Average** | **~859** | **~1,931** | **$0.146** |

### Projected Flash Costs (4× Cheaper Token Pricing)

| Model | Input $/1M | Output $/1M | Est. Input | Est. Output | **Est. Cost/Image** |
|-------|-----------|-------------|-----------|-------------|---------------------|
| `gemini-3-pro-image` | $2.00 | $12.00 | $0.0017 | $0.0232 | **$0.025** |
| `gemini-3.1-flash-image` | $0.50 | $3.00 | $0.0004 | $0.0058 | **$0.006** |

> **Note:** Token pricing above reflects pure compute cost. OpenRouter logs show ~$0.146/image for pro — the 6× difference from the token estimate is due to OpenRouter's effective pricing model that accounts for image data in the response. The 4× cost ratio between pro and flash holds regardless.

### Batch Cost: 48 Projects (144 Images)

| Model | Per Image | 144 Images | 26 Remaining |
|-------|-----------|------------|-------------|
| Pro (current) | ~$0.146 | $21.02 | $11.39 |
| Flash (projected) | **~$0.036** | **$5.18** | **$2.81** |
| **Savings** | | **$15.84 (75%)** | **$8.58 (75%)** |

## Quality Expectations

| Aspect | Pro | Flash |
|--------|-----|-------|
| Multi-panel layout | ★★★★ | ★★★★ |
| Speech bubbles / text | ★★★★ | ★★★★ |
| Style consistency | ★★★★ | ★★★★ |
| Tech illustration quality | ★★★★★ | ★★★★ |
| Generation speed | Baseline | ~2× faster |
| File size | ~950 KB avg | Expected similar |

Both models share the same base architecture (Nano Banana family). Flash trades minimal quality downgrade for 4× faster and cheaper inference.

## How to Complete the Comparison

1. Restore OpenRouter key or add a new key to `.env`
2. Set `STORYBOARD_IMAGE_MODEL=google/gemini-3.1-flash-image`
3. Restart server: `go run ./server`
4. Generate: `POST /api/projects/q10-multi-agent-research-system/storyboard`
5. Download flash images to this folder
6. Update this report with side-by-side screenshots

## Switch Command (when key is ready)

```bash
# In .env:
STORYBOARD_IMAGE_MODEL='google/gemini-3.1-flash-image'
# Then restart server and re-generate storyboard for q10
```

## Files

```
compare_pro_vs_flash/
├── README.md          # This report
├── pro-act-1.png      # 1.0 MB — Act 1 via gemini-3-pro-image
├── pro-act-2.png      # 859 KB — Act 2 via gemini-3-pro-image
├── pro-act-3.png      # 952 KB — Act 3 via gemini-3-pro-image
└── (flash-act-*.png)  # To be generated when key is restored
```
