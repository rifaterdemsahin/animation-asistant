# 6 — Semblance: Storyboard Image-Model Cost Report

> **Date:** 2026-07-09
> **Question:** *Which model is cheaper than `google/gemini-3.1-flash-image` but equal/better quality — and how much did I actually save by switching storyboard generation to Flash?*
> **Source of truth:** OpenRouter request logs (pasted) → [`openrouter_log_observed.tsv`](./openrouter_log_observed.tsv)

---

## TL;DR — how much you saved

You changed the **storyboard** image model from `google/gemini-3-pro-image` to `google/gemini-3.1-flash-image`
(`.env:5` → `STORYBOARD_IMAGE_MODEL='google/gemini-3.1-flash-image'`). The general-purpose image model
(`OPENROUTER_IMAGE_MODEL`, `.env:4`) is **still** the expensive Pro model — only storyboards moved.

| Unit | Old (Pro) | New (Flash) | You save |
|------|-----------|-------------|----------|
| **Per storyboard image** | $0.148 | $0.068 | **$0.081 (≈55%)** |
| Per project (3 img + 1 text) | $0.452 | $0.210 | $0.242 |
| Remaining 26 projects (78 img) | $11.56 | $5.27 | **$6.29** |
| Full 48-project batch (144 img) | $21.34 | $9.73 | **$11.61** |

> ⚠️ **Correction to the earlier projection.** `4_Formula/09` and `compare_pro_vs_flash` *projected* Flash at
> **~$0.036/image (75% off)** using a 4× token-price ratio. The **actual observed** Flash cost is **$0.068/image
> (55% off)** — OpenRouter bills Gemini image output as a flat-ish per-image fee, so the real saving is ~55%, not 75%.
> Still a clear win, just not as large as the estimate implied.

---

## The cheaper-AND-better question (for context)

There is **no commercial API that is both cheaper *and* better** than `gemini-3.1-flash-image`. It's a trade-off:

| Direction | Model | Cost vs Flash | Quality vs Flash |
|-----------|-------|---------------|------------------|
| Cheaper, **lower** quality | `google/gemini-3.1-flash-lite-image` | ~50% cheaper | slightly worse |
| Better, **higher** cost | `openai/gpt-5-image` | more expensive | better photoreal/text |
| Better art, ~similar cost | `black-forest-labs/flux-1.1-pro` | similar | stronger aesthetics |
| Better text in-panel, ~similar | `ideogram/v4` | similar | best typography |

For **storyboards** (consistent framing + low cost across many panels), `gemini-3.1-flash-image` is the best
price/quality point. See `4_Formula/09-alternative-image-models.md` for the full matrix and integration paths.
**Verdict: keep Flash for storyboards.** No model beats it on both axes.

---

## Observed costs (from OpenRouter logs)

The pasted log view **duplicated rows** (identical token counts to the digit: 881/1120, 827/2188…) — a
scroll/virtualization artifact, not distinct requests. Below are the **9 unique requests** actually in the window:

| Time | In tok | Out tok | Cost | Type | Model (inferred) |
|------|-------:|--------:|------:|------|------------------|
| 22:46 | 881 | 1,120 | **$0.0676** | image | Flash (after change) |
| 22:46 | 398 | 807 | $0.00786 | text | scene-assembly |
| 20:35 | 827 | 2,188 | $0.149 | image | Pro (before change) |
| 20:35 | 815 | 2,519 | $0.153 | image | Pro (before change) |
| 20:34 | 804 | 2,449 | $0.152 | image | Pro (before change) |
| 20:34 | 777 | 1,784 | $0.144 | image | Pro (before change) |
| 20:34 | 792 | 1,707 | $0.143 | image | Pro (before change) |
| 20:34 | 394 | 722 | $0.00709 | text | scene-assembly |
| 20:34 | 317 | 660 | $0.00642 | text | scene-assembly |

### Derived unit rates

| Call type | Samples | Avg cost | Note |
|-----------|--------:|---------:|------|
| Storyboard image — **Pro** | 5 | **$0.1482** | range $0.143–$0.153 |
| Storyboard image — **Flash** | 1 | **$0.0676** | only sample so far; corroborated by ~½ of Pro |
| Text (scene assembly) | 3 | **$0.00712** | unchanged — text model is `gemini-3.5-flash` |

---

## Savings breakdown

**Per image** — the headline number:
$0.1482 − $0.0676 = **$0.0806 saved per image (54.4%)**.

**Already-completed work (sunk, 22 projects / 84 images ran on Pro):**
- Spent on Pro: 84 × $0.1482 = **$12.45**
- Would have cost on Flash: 84 × $0.0676 = $5.68
- ⇒ **~$6.77 was overspent** before the switch (already spent, can't recover — but confirms the rate is real and consistent with the ~$12–13 total noted in `4_Formula/08`).

**Going forward (26 remaining projects / 78 images):**
- Pro would cost: $11.56 → Flash will cost: $5.27 ⇒ **save ~$6.29**.

**Had the entire 48-project batch run on Flash (144 images):** ~**$11.61** saved vs all-Pro.

---

## What changed (config)

```diff
# .env
 OPENROUTER_IMAGE_MODEL='google/gemini-3-pro-image'      # general images — UNCHANGED (still Pro)
+STORYBOARD_IMAGE_MODEL='google/gemini-3.1-flash-image'   # storyboards — switched to Flash (4× cheaper tokens)
```

Only the **storyboard** path uses Flash. Component thumbnails and any direct image calls still hit Pro. If you
want the saving on all image surfaces, set `OPENROUTER_IMAGE_MODEL='google/gemini-3.1-flash-image'` too — but
note Pro renders in-panel text better, so leaving component images on Pro is a reasonable quality choice.

---

## Methodology & caveats

1. **Single Flash sample.** Only one distinct Flash image ($0.0676) appears in the pasted window. It matches
   the expected ~½-of-Pro ratio, but more samples would tighten the estimate. Recommendation: confirm against the
   next full 3-image project run (~$0.21 total expected).
2. **Image billing is flat-ish, not pure-token.** OpenRouter shows token counts for image models but charges a
   near-flat per-image fee, so the 4× token-ratio projection in earlier reports over-stated savings (75% → actual 55%).
3. **Log rows were duplicated** in the paste (virtualized view). Counts above use only the 9 unique rows; a real
   per-request pull from `openrouter.ai/activities` would give an exact grand total if needed.
4. Text/assembly cost (~$0.007/call) is unaffected by the image-model swap and excluded from per-image savings.

---

## Recommendation

- ✅ **Keep Flash for storyboard generation** — best price/quality for this use case.
- 🔁 **Verify with one more project** — a 3-act run should total ~$0.21 (3 × $0.068 + text). If it lands there,
  the $0.068/image rate is locked.
- 🚀 **For finals only:** if a few hero panels need Pro's sharper text, regenerate just those with
  `STORYBOARD_IMAGE_MODEL` temporarily set to Pro — the hybrid draft-on-Flash / final-on-Pro workflow from
  `4_Formula/09` Path C.
