"""ElevenLabs TTS (mirror of server/elevenlabs.go)."""
from __future__ import annotations
import httpx
from .config import ELEVEN_LABS_API_KEY, ELEVEN_LABS_VOICE, ELEVEN_LABS_MODEL


class TTSError(Exception):
    pass


def tts(text: str) -> bytes:
    if not ELEVEN_LABS_API_KEY:
        raise TTSError("TTS_API_KEY (ElevenLabs) not set")
    voice = ELEVEN_LABS_VOICE or "JBFqnCBsd6RMkjVDRZzb"
    payload = {"text": text, "model_id": ELEVEN_LABS_MODEL,
               "voice_settings": {"stability": 0.5, "similarity_boost": 0.75}}
    headers = {"xi-api-key": ELEVEN_LABS_API_KEY, "Content-Type": "application/json",
               "Accept": "audio/mpeg"}
    try:
        r = httpx.post(f"https://api.elevenlabs.io/v1/text-to-speech/{voice}",
                       json=payload, headers=headers, timeout=120.0)
    except httpx.HTTPError as e:
        raise TTSError(str(e))
    if r.status_code != 200:
        raise TTSError(f"elevenlabs {r.status_code}: {r.text[:300]}")
    return r.content
