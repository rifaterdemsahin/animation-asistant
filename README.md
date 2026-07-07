# animation-assistant

HTML multi-tool web app that builds animation **components** (outline → script →
typed images → audio → storyboard) on a fixed **3-act** structure
(Problem → Solution → Lesson), ready to drop into a Canva video timeline.

**Live:** https://animation-assistant.fly.dev/  ·  (GitHub Pages redirects here)
**Login:** basic admin password (from Azure KeyVault → fly secret).

- **Go backend** on fly.io holds secrets, serves the static UI, and calls
  **OpenRouter (Gemini)** for text + images, **ElevenLabs** for audio.
- **Python scripts** (`scripts/`) do the same generation locally for the AI agent.
- Data persists in **Azure Blob Storage** (local `./other` fallback).
- Shared top nav (links + search), current-project header, footer on every page.
- Multi-key OpenRouter rotation (token expiry/limit tolerant).

See **[SPEC.md](SPEC.md)** (design), **[AGENTS.md](AGENTS.md)** (contributing),
**[risks.md](risks.md)** (status + risks).

## Models (good quality + good rate)

- Text / outline / script / storyboard: `google/gemini-2.5-flash`
- Images (components, storyboard infographic): `google/gemini-2.5-flash-image`
- Audio (TTS): ElevenLabs `eleven_turbo_v2_5`, voice "George"

## Run (local)

```bash
cp .env.example .env          # or source keys from Azure KeyVault (see below)
go run ./server               # http://localhost:8080  (login → /pages/login.html)
```

Populate `.env` from the Azure KeyVault (values not printed):
```bash
KV=dp-kv-deliverypilot
get(){ az keyvault secret show --vault-name "$KV" --name "$1" --query value -o tsv; }
echo "ADMIN_PASSWORD='$(get AdminPassword)'" > .env
echo "OPENROUTER_API_KEY='$(get OPENROUTER-API-KEY)'" >> .env
echo "AZURE_STORAGE_CONNECTION_STRING='$(get AZURE-STORAGE-CONN-STR)'" >> .env
echo "TTS_API_KEY='$(get ELEVEN-LABS-API-KEY)'" >> .env
```

Python CLI (local agent generation → `./other`):
```bash
python3 -m venv .venv && source .venv/bin/activate && pip install -r requirements.txt
python scripts/generate_script.py     create "My topic" --topic "..."
python scripts/generate_script.py     outline --slug my-topic
python scripts/generate_script.py     script  --slug my-topic
python scripts/generate_components.py --slug my-topic
python scripts/generate_audio.py      --slug my-topic
python scripts/generate_storyboard.py --slug my-topic
```

## Deploy

```bash
fly secrets set ADMIN_PASSWORD=... OPENROUTER_API_KEY=... AZURE_STORAGE_CONNECTION_STRING=... TTS_API_KEY=...
fly deploy
```

## Status — all phases complete

- ✅ Phase 1 skeleton (Go backend, shared layout, auth, project CRUD)
- ✅ Phase 2 outline + per-act scripts (OpenRouter/Gemini)
- ✅ Phase 3 typed components (OpenRouter image model)
- ✅ Phase 4 audio (ElevenLabs TTS)
- ✅ Phase 5 storyboard (Gemini scenes + infographic)
- ✅ Phase 6 fly.io deploy + GitHub Pages redirect
