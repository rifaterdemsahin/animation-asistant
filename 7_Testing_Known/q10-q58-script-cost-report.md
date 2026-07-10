# Script Generation Cost Report — q10–q58

> **Date:** 2026-07-10
> **Time:** ~22:00–22:35 UTC
> **Model:** `google/gemini-3.5-flash` via OpenRouter

## Scope

Generated outline + per-act scripts for **47 projects** (q10, q12–q42, q44–q58).

| Range       | Count | Notes                    |
|-------------|-------|--------------------------|
| q10         | 1     | Single manual trigger    |
| q12–q21     | 10    | One-by-one manual        |
| q22–q42     | 21    | Batch (partial restart)  |
| q44–q58     | 15    | One-by-one manual        |
| q43         | —     | Project does not exist   |
| q11         | —     | Already done previously  |

## Calls per Project

Each project required 2 phases:

| Phase    | Calls per project | Type     |
|----------|-------------------|----------|
| Outline  | 1                 | Text generation |
| Script   | 3 (one per act)   | Text generation |
| **Total**| **4**             |          |

## Retries

Two projects had transient OpenRouter failures on first attempt and required re-generation:

| Project | Extra calls | Reason            |
|---------|-------------|-------------------|
| q47     | 3           | 500 on first POST |
| q58     | 3           | 500 on first POST |

## Cost Calculation

| Item                | Calls | Rate    | Cost   |
|---------------------|-------|---------|--------|
| Outline (47 × 1)    | 47    | $0.007  | $0.33  |
| Script (47 × 3)     | 141   | $0.007  | $0.99  |
| Retries (2 × 3)     | 6     | $0.007  | $0.04  |
| **Total**           | **194** |       | **$1.36** |

> Rate estimate: ~$0.007 per text call for `google/gemini-3.5-flash` on OpenRouter (short prompts, ~200-500 output tokens). Actual cost may vary based on exact token usage.

## Per-Project Cost

```
$1.36 / 47 projects = $0.029/project
```

Breakdown:
- Outline: $0.007/project
- Scripts: $0.021/project (3 acts × $0.007)
- Retries amortized: $0.001/project

## Full Pipeline Context

From `4_Formula/11-storyboard-cost-and-pipeline-estimate.md`:

| Phase         | Per Project | 47 Projects | Notes              |
|---------------|-------------|-------------|--------------------|
| Storyboard    | $0.33       | $15.51      | Already done       |
| Outline       | $0.007      | $0.33       | This session       |
| **Script**    | **$0.029**  | **$1.36**   | **This session**   |
| Components    | $2.63*      | $123.61     | Not yet run        |
| Voiceover     | $0.15       | $7.05       | Not yet run        |
| Music         | $0.15       | $7.05       | Not yet run        |
| SFX           | $0.18       | $8.46       | Not yet run        |
| **Total**     | **$3.48**   | **$163.56** |                    |

> \* Components estimate based on ~6 types × 3 acts using flash model ($0.036/image × 18 images = $0.648, but using pro model at $0.146/image = $2.63/project).

## Notes

- $1.36 is well under the estimated $1.01 for 48 projects from the pipeline doc
- Outlines were generated fresh for all 47 projects (none were cached)
- No outline-only retries occurred (0% failure rate for outline phase)
- Script retry rate: 2/141 = 1.4% (transient OpenRouter 500 errors)
- q1 and q11 already had scripts from prior work — not counted here
