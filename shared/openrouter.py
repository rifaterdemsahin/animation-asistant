"""OpenRouter client: multi-key rotation, text + image generation.

Mirror of server/openrouter.go. Used by local Python scripts.
"""
from __future__ import annotations
import base64
import json
import re
import threading
import httpx
from .config import (OPENROUTER_KEYS, OPENROUTER_TEXT_MODEL,
                     OPENROUTER_IMAGE_MODEL, OPENROUTER_BASE)


class OpenRouterError(Exception):
    pass


_lock = threading.Lock()
_idx = 0


def _next_key() -> str:
    global _idx
    with _lock:
        if not OPENROUTER_KEYS:
            return ""
        k = OPENROUTER_KEYS[_idx % len(OPENROUTER_KEYS)]
        _idx += 1
        return k


def _call(payload: dict, timeout: float = 180.0) -> dict:
    if not OPENROUTER_KEYS:
        raise OpenRouterError("OPENROUTER_API_KEY not set (token may be expired/missing)")
    last = None
    for _ in range(len(OPENROUTER_KEYS)):
        key = _next_key()
        headers = {"Authorization": f"Bearer {key}", "Content-Type": "application/json",
                   "X-Title": "Animation Assistant"}
        try:
            r = httpx.post(f"{OPENROUTER_BASE}/chat/completions", json=payload,
                           headers=headers, timeout=timeout)
        except httpx.HTTPError as e:
            last = OpenRouterError(str(e)); continue
        if r.status_code in (401, 402, 429):
            last = OpenRouterError(f"openrouter token rejected (HTTP {r.status_code}) — "
                                   "likely expired or over its usage limit; rotating key")
            continue
        if r.status_code != 200:
            raise OpenRouterError(f"openrouter {r.status_code}: {r.text[:400]}")
        return r.json()
    raise last


def _content(obj: dict):
    choices = obj.get("choices") or []
    if not choices:
        return "", {}
    msg = choices[0].get("message", {}) or {}
    return msg.get("content") or "", msg


def chat_json(messages, model=None) -> str:
    payload = {"model": model or OPENROUTER_TEXT_MODEL, "messages": messages, "temperature": 0.7}
    content, _ = _content(_call(payload))
    return content


def generate_image(prompt: str, model=None) -> bytes:
    payload = {"model": model or OPENROUTER_IMAGE_MODEL,
               "messages": [{"role": "user", "content": prompt}]}
    obj = _call(payload)
    _, msg = _content(obj)
    imgs = msg.get("images") or []
    if imgs:
        url = (imgs[0].get("image_url") or {}).get("url", "")
        if url:
            return _decode_image(url)
    content = msg.get("content") or ""
    m = re.search(r"https?://[^ )\"\']+", content)
    if m:
        r = httpx.get(m.group(0), timeout=120.0)
        if r.status_code != 200:
            raise OpenRouterError(f"image download {r.status_code}")
        return r.content
    raise OpenRouterError("image model returned no image data")


def _decode_image(url: str) -> bytes:
    if url.startswith("data:"):
        b64 = url.split(";base64,", 1)[-1]
        return base64.b64decode(b64)
    r = httpx.get(url, timeout=120.0)
    if r.status_code != 200:
        raise OpenRouterError(f"image download {r.status_code}")
    return r.content


def extract_json(text: str) -> dict:
    text = (text or "").strip()
    m = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", text, re.S)
    if m:
        text = m.group(1)
    s, e = text.find("{"), text.rfind("}")
    if s < 0 or e < 0 or e < s:
        raise OpenRouterError("no JSON object found in response")
    try:
        return json.loads(text[s:e + 1])
    except json.JSONDecodeError as ex:
        raise OpenRouterError(f"invalid JSON: {ex}")
