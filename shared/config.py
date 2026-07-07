"""Config + paths for local Python scripts. Loads .env when present."""
from __future__ import annotations
import os
from pathlib import Path
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / ".env")

OTHER_DIR = Path(os.environ.get("OTHER_DIR", str(BASE_DIR / "other")))
OPENROUTER_API_KEY = os.environ.get("OPENROUTER_API_KEY", "")
OPENROUTER_MODEL = os.environ.get("OPENROUTER_MODEL", "google/gemini-2.5-flash")
OPENROUTER_BASE = os.environ.get("OPENROUTER_BASE", "https://openrouter.ai/api/v1")

OTHER_DIR.mkdir(parents=True, exist_ok=True)
