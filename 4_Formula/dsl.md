# Domain Dictionary — Animation Assistant

## Narrative Structure

| Term | Definition |
|------|-----------|
| 3-act structure | Fixed narrative framework: Act 1 = Problem (Hook), Act 2 = Solution, Act 3 = Lesson. Every project follows this. |
| Act | One of three narrative segments (act-1, act-2, act-3), each with a defined role. |
| Beat | A discrete story moment within an act. 3–6 beats per act. Each beat has an id and text description. |

## Component Types

| Type | Role in Video |
|------|--------------|
| background | Full-frame scene backdrop for a beat |
| lower-third | Text/label bar overlay (names, captions, stats) |
| speech-bubble | Dialogue / quote / thought callout |
| infographic | Data / numbers / diagram visualizing a point |
| character | On-screen figure / subject / mascot |
| icon | Small symbolic graphic accent |
| title-card | Full-screen heading for the act or a key line |
| transition | Animated connecting element between beats |
| extensible | New types can be added without changing the pipeline |

## Pipeline Stages

| Stage | Description |
|-------|-------------|
| outline | Project-level 3-act narrative summary |
| script | Per-act voiceover script with narration and beats |
| components | Typed visual parts (images) per script beat |
| audio | Three layers per act: voiceover, music, sound effects |
| storyboard | Scene-by-scene plan assembling components against beats |

## Cross-Phase Feedback Loop

Each downstream phase receives the output of prior phases as input:
- Outline → Script: act summaries fill `{{summary}}`
- Storyboard → Script: image prompts + speech bubbles injected as mandatory context
- Script → Components: beats drive component type selection
- Script → Audio: voiceover.txt feeds ElevenLabs TTS

## Prompt Audit Trail

Every generation call saves the full prompt payload to `<slug>/prompts/<timestamp>-<step>.json` for debugging and reproducibility.
