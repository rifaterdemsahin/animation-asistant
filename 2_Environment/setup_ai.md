# AI Setup — Animation Assistant

## Overview

The Animation Assistant uses three AI providers for generation. All API keys are stored in **Azure Key Vault** (`dp-kv-deliverypilot`) and propagated to `.env` (local) or `fly secrets` (deployed).

## Providers

### 1. OpenRouter (Text + Image Generation)

**Purpose:** Outline, script, components, storyboard generation.  
**API Key:** `OPENROUTER_API_KEY` (from KeyVault `OPENROUTER-API-KEY`)  
**Base URL:** `https://openrouter.ai/api/v1`

**Models configured:**

| Use Case | Model | Cost Profile |
|----------|-------|-------------|
| Text (outline, script, storyboard) | `google/gemini-3.5-flash` | Good rate, quality |
| Components (typed images) | `google/gemini-3-pro-image` | Higher quality |
| Storyboard images (infographic) | `google/gemini-3.1-flash-image` | 75% cheaper than pro |

**Key rotation:** `OPENROUTER_API_KEY` accepts comma-separated keys. The client rotates to the next key on HTTP 401 (invalid), 402 (quota), or 429 (rate limit).

**Custom headers sent:**
- `X-Title: animation-assistant-fly`

**Env overrides:**
- `OPENROUTER_MODEL` — override the text model
- `STORYBOARD_IMAGE_MODEL` — override the storyboard image model (defaults to `OPENROUTER_IMAGE_MODEL` when empty)
- `IMAGE_API_KEY` / `IMAGE_MODEL` — legacy image generation overrides

### 2. ElevenLabs (TTS Voiceover)

**Purpose:** Generate narration audio per act.  
**API Key:** `TTS_API_KEY` (from KeyVault `ELEVEN-LABS-API-KEY`)  
**Model:** `eleven_turbo_v2_5`  
**Voice:** "George" (warm storyteller)

**Generation:** One MP3 per act, stored at `<act-slug>/audio/narration.mp3`.  
**Input text:** The `voiceover.txt` file (clean narration, no markdown formatting).

**Env overrides:**
- `TTS_VOICE` — change the voice ID
- The model is hardcoded to `eleven_turbo_v2_5`

### 3. fal.ai (Music + Sound Effects)

**Purpose:** Background music and spot SFX per act.  
**API Key:** `FAL_KEY` (from KeyVault `FAL-KEY`)  
**Base URL:** `https://fal.run`

**Models configured:**

| Use Case | Model | Output |
|----------|-------|--------|
| Background music | `fal-ai/mmaudio-v2` | MP3 per act |
| Sound effects | `fal-ai/stable-audio` | Per-act SFX (whoosh, ding, reveal) |

**Generation endpoints (Go backend):**
- `POST /api/projects/{slug}/audio/music`
- `POST /api/projects/{slug}/audio/sfx`

**Storage:** Music → `<act-slug>/audio/music.mp3`, SFX → `<act-slug>/audio/sfx-*.mp3`

## Getting the Keys (from Azure Key Vault)

```bash
az login
KV=dp-kv-deliverypilot

# Get all AI keys
az keyvault secret show --vault-name "$KV" --name "OPENROUTER-API-KEY" --query value -o tsv
az keyvault secret show --vault-name "$KV" --name "ELEVEN-LABS-API-KEY" --query value -o tsv
az keyvault secret show --vault-name "$KV" --name "FAL-KEY" --query value -o tsv
```

## Model Visibility

The active models are exposed at `GET /api/models` and shown inline as `.model-badge` pills on the Media Manager. Every generation step (outline, script, components, audio/music/SFX, storyboard) shows which model it will trigger.

## Model Policy

- **Minimum text/image model:** Gemini 3 (enforced)
- All defaults use Gemini 3+ (Flash for text, Pro for components, Flash Image for storyboard)
- Audio models configured for best quality/rate ratio
- All model IDs are configurable via env vars — no hardcoded production values
