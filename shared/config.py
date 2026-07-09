"""Config + paths for local Python scripts. Loads .env when present."""
from __future__ import annotations
import os
from pathlib import Path
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / ".env")

OTHER_DIR = Path(os.environ.get("OTHER_DIR", str(BASE_DIR / "other")))

# OpenRouter (comma-separated keys enable rotation on token expiry/limit)
OPENROUTER_KEYS = [k.strip() for k in os.environ.get("OPENROUTER_API_KEY", "").split(",") if k.strip()]
OPENROUTER_API_KEY = OPENROUTER_KEYS[0] if OPENROUTER_KEYS else ""
OPENROUTER_TEXT_MODEL = os.environ.get("OPENROUTER_TEXT_MODEL",
                                       os.environ.get("OPENROUTER_MODEL", "google/gemini-3.5-flash"))
OPENROUTER_IMAGE_MODEL = os.environ.get("OPENROUTER_IMAGE_MODEL", "google/gemini-3-pro-image")
OPENROUTER_BASE = os.environ.get("OPENROUTER_BASE", "https://openrouter.ai/api/v1")

# ElevenLabs TTS
ELEVEN_LABS_API_KEY = os.environ.get("TTS_API_KEY", "")
ELEVEN_LABS_VOICE = os.environ.get("TTS_VOICE", "JBFqnCBsd6RMkjVDRZzb")  # George
ELEVEN_LABS_MODEL = os.environ.get("TTS_MODEL", "eleven_turbo_v2_5")

OTHER_DIR.mkdir(parents=True, exist_ok=True)
