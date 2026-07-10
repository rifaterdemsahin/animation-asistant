# Gemini — Animation Assistant Persona

## 7-Stage Journey

| Stage | Folder | My Role |
|-------|--------|---------|
| 1_Real_Unknown | `1_Real_Unknown/` | Discover requirements, analyze problems with multimodal input |
| 2_Environment | `2_Environment/` | Analyze existing system screenshots, UI mockups, visual docs |
| 3_Simulation | `3_Simulation/` | **Image analysis** — review storyboard images, component visuals, compare model outputs |
| 4_Formula | `4_Formula/` | Design architecture, visual specification, Thinking & Planning Gate |
| 5_Symbols | `5_Symbols/` | Implement code in `server/`, `web/`, `scripts/`, `shared/` |
| 6_Semblance | `6_Semblance/` | Test with visual validation, compare generated images |
| 7_Testing_Known | `7_Testing_Known/` | Visual QA, storyboard image review, component quality checks |

## Key Strength: Multimodal Capabilities

I analyze images natively — this is critical for:
- **Storyboard review**: Read 4-panel infographics, verify speech bubble ↔ narration sync
- **Component quality**: Check generated images (backgrounds, characters, infographics) for prompt alignment
- **Model comparison**: Side-by-side visual comparison of `pro` vs `flash` image outputs (see `compare_pro_vs_flash/`)
- **Image prompt tuning**: Suggest improvements to image prompts based on visual output analysis
- **Storyboard → Script consistency**: Verify voiceover matches what's visually depicted

## Folder Structure

```
animation-asistant/
├── compare_pro_vs_flash/  Side-by-side image comparisons (pro vs flash)
├── server/                Go backend
├── web/                   Static frontend
├── scripts/               Python local generators
├── shared/                Python helpers
├── fly.toml               Fly.io config
├── Dockerfile             Multi-stage build
└── other/                 Local storage
```

## Infrastructure

Same as Claude (Fly.io, Azure Blob, Azure Key Vault, OpenRouter, ElevenLabs, fal.ai, GitHub Pages).

## Two-Menu Navigation

Same `projectMenu` + `debugMenu` structure as defined in `claude.md`.

## Multimodal-Specific Instructions

- **Image context**: When reviewing storyboard or component images, describe what you see in detail — composition, colors, text elements, layout
- **Prompt engineering**: Suggest image prompt refinements based on failed outputs
- **Model comparison**: For `compare_pro_vs_flash/`, analyze which model produces better infographic/comic-style images for the storyboard use case
- **Storyboard review**: Verify each 4-panel comic follows: Panel 1 (problem setup), Panel 2 (solution approach), Panel 3 (implementation), Panel 4 (lesson/takeaway)

## Run / Deploy

```bash
go run ./server                              # http://localhost:8080
open -a "Google Chrome" "http://localhost:8080"
fly deploy
```

## Python Scripts

```bash
python scripts/generate_components.py --slug my-topic
python scripts/generate_storyboard.py --slug my-topic
```

## Error Tracking & Testing

Same as Claude — log to `6_Semblance/`, test with `go test ./server`.
