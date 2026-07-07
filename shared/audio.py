"""Per-act narration audio via ElevenLabs (mirror of server/audio.go)."""
from __future__ import annotations
import json
from .acts import ACTS, ACT_BY_KEY
from . import storage
from .elevenlabs import tts, TTSError


def _narration(slug: str, act: dict) -> str:
    try:
        obj = json.loads(storage.read(slug, f"{act['slug']}/script/beats.json"))
        if obj.get("narration", "").strip():
            return obj["narration"]
    except FileNotFoundError:
        pass
    return ""


def generate_audio(slug: str, acts=None) -> dict:
    p = storage.read_project(slug)
    keys = acts or [a["key"] for a in ACTS]
    out = {}
    for key in keys:
        act = ACT_BY_KEY[key]
        text = _narration(slug, act)
        if not text.strip():
            raise TTSError(f"act {key} has no narration (generate the script first)")
        audio = tts(text)
        rel = f"{act['slug']}/audio/narration.mp3"
        storage.write(slug, rel, audio)
        out[key] = rel
        p["acts"][key]["audio"] = "done"
    p["status"] = "audio"
    storage.write_project(slug, p)
    return out
