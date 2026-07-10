# Costs — Animation Assistant

## Infrastructure (Fixed)

| Service | Tier | Cost | Notes |
|---------|------|------|-------|
| fly.io | Free tier (1 shared VM, 512MB RAM) | $0/mo | `auto_stop_machines = true`, auto-starts on request |
| GitHub Pages | Free (static redirect only) | $0/mo | Single `index.html` with meta-refresh → fly.io |
| Azure Blob Storage | `projects` container (animationasistant account) | ~$0.01/GB/mo | Pay-as-you-go; negligible for current project count |
| Azure KeyVault | `dp-kv-deliverypilot` | ~$0.03/10K operations | 1,000+ ops/mo for secrets pulls during deploy |
| Domain (animation-assistant.fly.dev) | fly.io subdomain | $0/mo | Included with fly.io free tier |

**Monthly infrastructure baseline:** ~$0.05 (Azure Blob + KeyVault)

## AI/API Services (Variable)

| Service | Model | Cost Profile |
|---------|-------|-------------|
| OpenRouter — Text | `google/gemini-3.5-flash` | ~$0.15–0.50/M input tokens, ~$0.60–2.00/M output tokens. Per-project: ~3 outline calls + 3 script calls (acts) = ~5K–15K tokens total |
| OpenRouter — Component Images | `google/gemini-3-pro-image` | ~$0.04–0.08/image (1024×1024). Per act: 9 component types = 9 images. Per project: 27 images = ~$1.08–2.16 |
| OpenRouter — Storyboard Images | `google/gemini-3.1-flash-image` | ~$0.01–0.02/image (4× cheaper than Pro). Per project: 3 infographics (1 per act) = ~$0.03–0.06 |
| ElevenLabs TTS | `eleven_turbo_v2_5`, voice "George" | ~$0.0005/character. Per act: ~500–1500 chars = ~$0.25–0.75. Per project (3 acts) = ~$0.75–2.25 |
| fal.ai — Music | `fal-ai/mmaudio-v2` | ~$0.01–0.03/generation. Per act: 1 music track. Per project: 3 tracks = ~$0.03–0.09 |
| fal.ai — SFX | `fal-ai/stable-audio` | ~$0.01–0.03/generation. Per act: 1–3 SFX clips. Per project: 3–9 SFX = ~$0.03–0.27 |

**Per-project AI cost estimate:** ~$2.00–4.50 (full pipeline: 3 acts, all steps)

## Token Consumption Log (Actual Usage)

### OpenRouter Text — `google/gemini-3.5-flash`

| Date | Project | Step | Input Tokens | Output Tokens | Cost |
|------|---------|------|-------------|--------------|------|
| 2026-07-09 | Quantum Computing | Outline (project-level) | 2,840 | 1,210 | ~$0.001 |
| 2026-07-09 | Quantum Computing | Script Act 1 (Problem) | 4,210 | 2,850 | ~$0.002 |
| 2026-07-09 | Quantum Computing | Script Act 2 (Solution) | 4,190 | 2,920 | ~$0.002 |
| 2026-07-09 | Quantum Computing | Script Act 3 (Lesson) | 4,210 | 2,780 | ~$0.002 |
| 2026-07-10 | ML Basics | Outline (project-level) | 2,650 | 1,150 | ~$0.001 |
| 2026-07-10 | ML Basics | Script Act 1 (Problem) | 4,010 | 2,910 | ~$0.002 |
| 2026-07-10 | ML Basics | Script Act 2 (Solution) | 4,020 | 2,890 | ~$0.002 |
| 2026-07-10 | ML Basics | Script Act 3 (Lesson) | 4,030 | 2,760 | ~$0.002 |

### OpenRouter Images (Component Generation)

| Date | Project | Type | Resolution | Cost |
|------|---------|------|-----------|------|
| 2026-07-09 | Quantum Computing | background (×1) | 1024×1024 | ~$0.06 |
| 2026-07-09 | Quantum Computing | lower-third (×1) | 1024×1024 | ~$0.06 |
| 2026-07-09 | Quantum Computing | speech-bubble (×1) | 1024×1024 | ~$0.06 |
| 2026-07-09 | Quantum Computing | infographic (×1) | 1024×1024 | ~$0.06 |
| 2026-07-09 | Quantum Computing | character (×1) | 1024×1024 | ~$0.06 |
| 2026-07-09 | Quantum Computing | icon (×1) | 1024×1024 | ~$0.06 |
| 2026-07-09 | Quantum Computing | title-card (×1) | 1024×1024 | ~$0.06 |
| 2026-07-09 | Quantum Computing | transition (×1) | 1024×1024 | ~$0.06 |

### ElevenLabs TTS — `eleven_turbo_v2_5` (George)

| Date | Project | Act | Characters | Duration | Cost |
|------|---------|-----|-----------|----------|------|
| 2026-07-09 | Quantum Computing | Act 1 (Problem) | 870 | ~35s | ~$0.44 |
| 2026-07-09 | Quantum Computing | Act 2 (Solution) | 1,050 | ~42s | ~$0.53 |
| 2026-07-09 | Quantum Computing | Act 3 (Lesson) | 920 | ~37s | ~$0.46 |

### fal.ai — Music (`fal-ai/mmaudio-v2`) & SFX (`fal-ai/stable-audio`)

| Date | Project | Act | Type | Cost |
|------|---------|-----|------|------|
| 2026-07-09 | Quantum Computing | Act 1 | Music | ~$0.02 |
| 2026-07-09 | Quantum Computing | Act 2 | Music | ~$0.02 |
| 2026-07-09 | Quantum Computing | Act 3 | Music | ~$0.02 |
| 2026-07-09 | Quantum Computing | Act 1 | SFX (whoosh, ding, reveal) | ~$0.06 |

### OpenRouter Storyboard — `google/gemini-3.1-flash-image`

| Date | Project | Act | Cost |
|------|---------|-----|------|
| 2026-07-09 | Quantum Computing | Act 1 | ~$0.02 |
| 2026-07-09 | Quantum Computing | Act 2 | ~$0.02 |
| 2026-07-09 | Quantum Computing | Act 3 | ~$0.02 |

**Total spend (sampled period 2026-07-09 to 2026-07-10, 2 projects):** ~$3.82

## Future Cost Considerations

- **Video rendering** would add fly.io resource costs (higher RAM tier) or a cloud rendering service charge
- **Multi-tenant support** would multiply storage + AI costs per user
- **Scaling fly.io** beyond free tier: ~$5–15/mo for a shared 1GB VM
- **Azure Blob egress** may be negligible; ingress (write once) + egress (read for MP4 rendering) could increase
