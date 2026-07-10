# Problem Statement

## The Problem

Content creators, educators, and course developers need to produce short animated explainer videos for Canva, but the current workflow is entirely manual:

1. **Script writing** — researching and writing a 3-act narrative from scratch
2. **Visual design** — creating backgrounds, lower-thirds, speech bubbles, infographics, characters, and icons in Canva
3. **Voiceover recording** — recording and syncing narration
4. **Music & SFX** — finding or composing background music and sound effects
5. **Storyboarding** — planning scene-by-scene how components fit together
6. **Assembly** — manually placing everything on the Canva timeline

This process takes hours per animation and requires skills in writing, graphic design, audio production, and video editing — a high bar for most subject-matter experts.

## Target Users

- **AI agents** — automated generation pipelines that produce animation assets without human intervention
- **Course creators** — educators building explainer video series for online learning platforms
- **Content teams** — small teams producing regular educational content for social media and courses

## The Solution

Animation Assistant provides an automated 5-step pipeline that generates all raw materials from a single Q&A prompt:

| Step | Output | Model |
|------|--------|-------|
| 1. Outline | 3-act project outline | `google/gemini-3.5-flash` (OpenRouter) |
| 2. Script | Per-act narration with beats | `google/gemini-3.5-flash` (OpenRouter) |
| 3. Components | Typed images (background, lower-third, speech-bubble, infographic, character, icon, title-card, transition) | `google/gemini-3-pro-image` (OpenRouter) |
| 4. Audio | Voiceover (ElevenLabs) + Music (`fal-ai/mmaudio-v2`) + SFX (`fal-ai/stable-audio`) | ElevenLabs + fal.ai |
| 5. Storyboard | Scene-by-scene plan + 4-frame infographic PNG | `google/gemini-3.1-flash-image` (OpenRouter) |

## Value

- **10x faster** animation asset production vs. manual Canva editing
- **Consistent 3-act structure** applied to every project
- **Typed components** designed for direct use in Canva timelines
- **Self-learning loop** — user arranges components in Canva, deepening understanding (Bloom's Taxonomy)
- **Storyboard→Script feedback loop** ensures visual-narrative consistency across regeneration cycles

## Current State

All 6 phases implemented and deployed. The app is live at https://animation-assistant.fly.dev/ using Azure Blob Storage (`dp-kv-deliverypilot` KeyVault), Go backend on fly.io, and dual Python/Go generation surfaces.
