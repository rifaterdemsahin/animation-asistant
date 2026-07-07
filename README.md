# 🎬 Animation Assistant

HTML multi-tool web app that builds animation **components** (outline → script →
typed images → audio → storyboard) on a fixed **3-act** structure
(Problem → Solution → Lesson), ready to drop into a Canva video timeline.

🌐 **Live:** https://animation-assistant.fly.dev/  
🔐 **Login:** https://animation-assistant.fly.dev/pages/login.html  
(GitHub Pages redirects to fly.io)

- **Go backend** on fly.io holds secrets, serves the static UI, and calls
  **OpenRouter (Gemini)** for text + images, **ElevenLabs** for TTS, **fal.ai** for music + SFX.
- **Python scripts** (`scripts/`) do the same generation locally for the AI agent.
- Data persists in **Azure Blob Storage** (local `./other` fallback).
- Shared top nav (links + search), current-project header, footer on every page.
- Multi-key OpenRouter rotation (token expiry/limit tolerant).
- 📝 All prompts saved to Azure for audit & reproducibility.

📖 See **[SPEC.md](SPEC.md)** (design), **[AGENTS.md](AGENTS.md)** (contributing),
⚠️ **[risks.md](risks.md)** (status + risks).

## 🛠️ Tools

| Page | What it does |
|------|-------------|
| 🏠 Dashboard | Project overview + quick links |
| 📁 Projects | List, create, delete animation projects |
| 📋 Storyboard | Scene-by-scene plan from scripts + components |
| 🎛️ Media Manager | Generate outline → script → components → audio |
| 🎧 Audio | Voiceover (ElevenLabs), music + SFX (fal.ai) |
| 🆕 Create | Q&A → single-act test or full pipeline for Canva |
| 🧪 Test | Run all generation endpoints, outline errors |
| 🛠️ Tools | Quick links: Canva, OpenRouter, fal.ai, ElevenLabs, Azure |

## 🤖 Models (good quality + good rate)

- Text / outline / script / storyboard: `google/gemini-2.5-flash` (OpenRouter)
- Images (components, infographics): `google/gemini-2.5-flash-image` (OpenRouter)
- TTS (voiceover): ElevenLabs `eleven_turbo_v2_5`, voice "George"
- Music: fal.ai `fal-ai/mmaudio-v2`
- Sound effects: fal.ai `fal-ai/stable-audio`

## 💻 Run (local)

```bash
cp .env.example .env          # or source keys from Azure KeyVault (see below)
go run ./server               # http://localhost:8080  → login at /pages/login.html
```

Populate `.env` from Azure KeyVault (values not printed):
```bash
KV=dp-kv-deliverypilot
get(){ az keyvault secret show --vault-name "$KV" --name "$1" --query value -o tsv; }
echo "ADMIN_PASSWORD='$(get AdminPassword)'" > .env
echo "OPENROUTER_API_KEY='$(get OPENROUTER-API-KEY)'" >> .env
echo "AZURE_STORAGE_CONNECTION_STRING='$(get AZURE-STORAGE-CONN-STR)'" >> .env
echo "TTS_API_KEY='$(get ELEVEN-LABS-API-KEY)'" >> .env
echo "FAL_KEY='$(get FAL-KEY)'" >> .env
```

> ⚠️ If `ADMIN_PASSWORD` contains `#`, replace it with `!` — fly secrets import
> truncates values at `#` (treated as comment). See risks.md.

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

## 🚀 Deploy

```bash
fly secrets set ADMIN_PASSWORD='...' OPENROUTER_API_KEY='...' AZURE_STORAGE_CONNECTION_STRING='...' TTS_API_KEY='...' FAL_KEY='...'
fly deploy
```

## ✅ Status — all phases complete

- ✅ Phase 1: skeleton (Go backend, shared layout, auth, project CRUD)
- ✅ Phase 2: outline + per-act scripts (OpenRouter/Gemini)
- ✅ Phase 3: typed components (OpenRouter image model)
- ✅ Phase 4: audio (ElevenLabs TTS + fal.ai music + SFX)
- ✅ Phase 5: storyboard (Gemini scenes + infographic)
- ✅ Phase 6: fly.io deploy + GitHub Pages redirect
- ✅ Central error handling + debug bar
- ✅ Prompt audit trail (saved to Azure)
- ✅ Project creation page with Q&A + single/bulk modes
- ✅ Page tests (Go `main_test.go`)
