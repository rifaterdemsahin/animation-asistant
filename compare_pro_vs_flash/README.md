# Pro vs Flash: Same Prompt, Different Models

> **Project:** q10 — "Lost-in-the-Middle: Primacy & Recency"
> **Models:** `google/gemini-3-pro-image` vs `google/gemini-3.1-flash-image`
> **Date:** 2026-07-09

## The Prompt (4079 Characters — Identical for Both Models)

```
You are an expert AI instructional designer and technical illustrator. Create
a detailed infographic storyboard for ONE act of a 3-act explainer video, using
a sequential four-panel comic strip format to visually explain a technical
question and answer regarding system/LLM architecture.

Here is the architectural concept to explain:
- Question: Production monitoring reveals inconsistent synthesis quality. When
  aggregated results total ~75K tokens, the synthesis agent reliably cites
  information from the first 15K tokens (web search headlines and snippets) and
  the final 10K tokens (document analysis conclusions), but frequently omits
  critical findings that appear in the middle 50K tokens—even when those findings
  directly address the research question. How should you restructure the aggregated input?
- Correct Answer: D: Place a key findings summary at the beginning of the
  aggregated input and organize detailed results with explicit section headers
  for easier navigation.
- The "Why": This problem illustrates the well-documented 'lost-in-the-middle'
  phenomenon common in large context window LLMs...

Act being illustrated: Act 1 — Problem (role: problem)
Act summary: Set up the world and the problem/pain the audience feels.

### Strict Style & Layout Guidelines:
1. Format: Sequential four-panel grid layout (1-4), comic book dialogue bubbles
2. Art Style: Vector-style line art, corporate tech cartoonism, cel shading
3. Color Palette: Blue/cyan/teal backgrounds, bright orange Coordinator,
   purple for Synthesis agent

### This Act's Panels: Act 1 — "The Agents Report"
- Panel 1 (The Setup): Coordinator issues workflow command
- Panel 2 (Sub-Agent A Action): Blue sub-agent executes task
- Panel 3 (Sub-Agent B Action): Second blue sub-agent works in isolation
- Panel 4 (The Handoff): Both agents report back to the coordinator
```

> Full prompt stored in metadata: `GET /api/projects/q10-multi-agent-research-system/storyboard`

---

## Output Comparison

### Act 1 — Problem
| | Pro | Flash |
|---|-----|-------|
| **Image** | [pro-act-1.png](./pro-act-1.png) | [flash-act-1.png](./flash-act-1.png) |
| **File size** | 1.0 MB | 1.4 MB (+40%) |
| **Cost** | $0.147 | ~$0.036 (est.) |

### Act 2 — Solution
| | Pro | Flash |
|---|-----|-------|
| **Image** | [pro-act-2.png](./pro-act-2.png) | [flash-act-2.png](./flash-act-2.png) |
| **File size** | 859 KB | 1.6 MB (+87%) |
| **Cost** | $0.148 | ~$0.036 (est.) |

### Act 3 — Lesson
| | Pro | Flash |
|---|-----|-------|
| **Image** | [pro-act-3.png](./pro-act-3.png) | [flash-act-3.png](./flash-act-3.png) |
| **File size** | 952 KB | 1.5 MB (+60%) |
| **Cost** | $0.143 | ~$0.036 (est.) |

---

## Cost Comparison

| Metric | Pro (`gemini-3-pro`) | Flash (`gemini-3.1-flash`) | Delta |
|--------|---------------------|---------------------------|-------|
| Token pricing (input) | $2.00/1M | $0.50/1M | 4× cheaper |
| Token pricing (output) | $12.00/1M | $3.00/1M | 4× cheaper |
| Avg tokens (input) | ~860 | ~860 (same prompt) | Same |
| Avg tokens (output) | ~1,930 | ~1,930 (est.) | Same |
| **Cost per image** | **~$0.146** | **~$0.036** | **75% savings** |
| 3 images (1 project) | $0.44 | $0.11 | Save $0.33 |
| 48 projects (144 images) | $21.02 | $5.18 | Save $15.84 |

*Pro costs from observed OpenRouter logs. Flash costs projected from 4× token price ratio.*

---

## File Size & Quality Observations

| | Pro | Flash |
|---|-----|-------|
| Avg file size | 940 KB | 1.5 MB (+60%) |
| Resolution | Native model output | Native model output |
| Format | PNG | PNG |
| Generation speed | ~60-78 tok/s | ~2× faster (projected) |

Flash images are ~60% larger on disk despite having lower compute cost. This suggests flash generates more detailed output (higher pixel density, richer content) — possibly a newer model generation with improved image synthesis.

---

## When to Use Each Model

| Use Case | Model | Rationale |
|----------|-------|-----------|
| Final production storyboard | Pro | Max quality for published output |
| Iteration / drafts | Flash | 75% cheaper, sufficient quality |
| Bulk batch generation | Flash | $5 vs $21 for 48 projects |
| Text-heavy infographics | Pro | Better text rendering |
| Cost-sensitive workflows | Flash | 4× token savings |

---

## Generation Metadata

| | Pro | Flash |
|---|-----|-------|
| **Version IDs** | 1, 2, 3 | 4, 5, 6 |
| **Files** | `storyboard-act-{1,2,3}-01.png` | `storyboard-act-{1,2,3}-02.png` |
| **Model** | `google/gemini-3-pro-image` | `google/gemini-3.1-flash-image` |
| **Created** | 2026-07-09T19:11:24-30Z | 2026-07-09T21:47:00-03Z |
| **Prompt** | 4,079 chars | 4,079 chars (identical) |

---

## Switch Command

To use flash for storyboard generation:

```bash
# .env or fly secrets:
STORYBOARD_IMAGE_MODEL='google/gemini-3.1-flash-image'

# Or set globally for all image generation:
OPENROUTER_IMAGE_MODEL='google/gemini-3.1-flash-image'
```

---

## Files

```
compare_pro_vs_flash/
├── README.md          # This report
├── pro-act-1.png      # 1.0 MB
├── pro-act-2.png      # 859 KB
├── pro-act-3.png      # 952 KB
├── flash-act-1.png    # 1.4 MB
├── flash-act-2.png    # 1.6 MB
└── flash-act-3.png    # 1.5 MB
```
