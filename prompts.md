# Prompts — Animation Assistant

## Project Manager Framework

### Phase 1: Delegation
- Agent receives a task from the user or another agent.
- Agent records the task in this log.
- Agent breaks the task into sub-steps.
- Agent executes each sub-step, recording prompts and results.

### Phase 2: Diligence
- Agent reviews the output for correctness, security, and style.
- Agent checks for committed secrets, lint errors, test failures.
- Agent updates this log with the outcome.
- Agent reflects and records lessons learned.

## Prompt Log

| # | Date | Agent | Task | Prompt Summary | Outcome |
|---|------|-------|------|----------------|---------|
| 1 | 2026-07-10 | Claude | Initial project setup | Create Animation Assistant project structure, Go backend skeleton, shared layout, auth | ✅ All phases complete, live at fly.io |
| 2 | 2026-07-10 | Claude | Go backend creation | Build server/ with main.go, app.go, config.go, auth.go, routes, middleware | ✅ Server serves frontend + REST API |
| 3 | 2026-07-10 | Claude | Azure Blob integration | Implement storage.Backend interface with Local + Azure (azblob SDK) backends | ✅ Automatic switching via env var |
| 4 | 2026-07-10 | Claude | Fly.io deployment | Create fly.toml, Dockerfile (Go+Python multi-stage), .dockerignore, deploy | ✅ Live at https://animation-assistant.fly.dev/ |
| 5 | 2026-07-10 | Claude | OpenRouter integration | Build openrouter.go with multi-key rotation, Gemini text+image calls, prompt audit | ✅ Script, components, storyboard generation |
| 6 | 2026-07-10 | Claude | ElevenLabs integration | Build elevenlabs.go for TTS voiceover generation per act | ✅ Voiceover with "George" voice |
| 7 | 2026-07-10 | Claude | fal.ai integration | Build fal.go for music (mmaudio-v2) and SFX (stable-audio) generation | ✅ Three-layer audio per act |
| 8 | 2026-07-10 | Claude | Storyboard generation | Build storyboard.go — scene-by-scene JSON + 4-frame infographic PNG | ✅ Storyboard with image prompt feedback loop |
| 9 | 2026-07-10 | Claude | Python scripts | Create scripts/ and shared/ Python mirrors for local CLI generation | ✅ Dual-mode Go + Python generation |
| 10 | 2026-07-10 | Claude | Template refactoring | Refactor project to 7-stage delivery-pilot-template structure | 🔄 Current task |
