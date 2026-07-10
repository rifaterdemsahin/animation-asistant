# Image Prompts — Animation Assistant

## Model Pipeline

The project uses **OpenRouter → Gemini models** for all image generation:

| Purpose | Model | Config Var |
|---------|-------|-----------|
| Component images | `google/gemini-3-pro-image` | `OPENROUTER_IMAGE_MODEL` |
| Storyboard images | `google/gemini-3.1-flash-image` | `STORYBOARD_IMAGE_MODEL` |

## Model Comparisons

See `compare_pro_vs_flash/` for side-by-side comparison of Pro vs Flash models for storyboard generation.

- **Pro** (`gemini-3-pro-image`): Better in-panel text rendering, sharper details. ~$0.148/image.
- **Flash** (`gemini-3.1-flash-image`): ~55% cheaper at ~$0.068/image. Comparable quality for infographic/comic-strip style storyboards.

## Prompt Categories

- **Storyboard**: 4-panel comic per act, 2×2 grid. Full scene with speech bubbles, characters, backgrounds.
- **Components**: Type-aware prompts per component type (background, lower-third, speech-bubble, infographic, character, icon, title-card, transition). Each type has its own style guidelines in the prompt template.
