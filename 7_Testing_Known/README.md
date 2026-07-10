# 7_Testing_Known — Validation

> **Purpose:** Validation layer — every unknown from Stage 1 must be answered here.
> Each test, scan, and report closes the loop on a question or hypothesis raised
> in `1_Real_Unknown/`.

## Files

| File | Type | Covers |
|------|------|--------|
| [01-page-error-scan.md](01-page-error-scan.md) | Test report | Full-surface headless-Chrome sweep of all 14 pages (console, network, interactions, project matrix) |
| [02-deepseek-vs-openrouter-script-compare.py](02-deepseek-vs-openrouter-script-compare.py) | Script | Side-by-side script generation comparison DeepSeek vs OpenRouter (outline + 3-act) |
| [compare-deepseek-vs-openrouter.html](compare-deepseek-vs-openrouter.html) | HTML report | Visual diff of DeepSeek vs OpenRouter output for q1 |
| [q10-q58-script-cost-report.md](q10-q58-script-cost-report.md) | Cost report | Script generation cost for 47 projects ($1.36 total) |
| [validation_report.md](validation_report.md) | Validation | Objective mapping, hypothesis & question traceability, final sign-off |
| [sanity_check_report.md](sanity_check_report.md) | Sanity check | Cross-stage health check of the full 7-stage journey |

## Rules

1. **Link every finding back to a question or hypothesis in `1_Real_Unknown/`.**
2. Each test must carry one of three statuses:
   - `✅ VALIDATED` — hypothesis proven / question answered
   - `❌ FAILED` — hypothesis disproven / requirement not met
   - `⚠️ PARTIAL` — partially validated with caveats
3. Reports are reproducible — include the exact commands/scripts used.
4. If a test cannot be run (missing credentials, broken server, etc.), note the blocker and mark it `⚠️ BLOCKED`.

## Master Testing Checklist

- [ ] GitHub Pages site works (DNS, TLS, redirects)
- [ ] All API endpoints respond (auth, projects, outlines, scripts, components, audio, storyboard)
- [ ] Storyboard pipeline complete (outline → script → components → audio → storyboard)
- [ ] Azure Blob storage works (read/write across all containers)
- [ ] KeyVault secrets accessible (all 8 secrets resolve without error)
- [ ] Navigation renders correctly (projectMenu + debugMenu on all pages)
- [ ] Sitemap valid (all 14+ pages discoverable, no dead links)
