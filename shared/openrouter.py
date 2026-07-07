"""Minimal OpenRouter client + JSON extraction (mirror of server/openrouter.go)."""
from __future__ import annotations
import json
import re
import httpx
from .config import OPENROUTER_API_KEY, OPENROUTER_MODEL, OPENROUTER_BASE


class OpenRouterError(Exception):
    pass


def chat_json(messages, model=None, timeout=120.0) -> str:
    if not OPENROUTER_API_KEY:
        raise OpenRouterError("OPENROUTER_API_KEY not set")
    payload = {"model": model or OPENROUTER_MODEL, "messages": messages, "temperature": 0.7}
    headers = {"Authorization": f"Bearer {OPENROUTER_API_KEY}",
               "Content-Type": "application/json", "X-Title": "Animation Assistant"}
    try:
        r = httpx.post(f"{OPENROUTER_BASE}/chat/completions", json=payload,
                       headers=headers, timeout=timeout)
    except httpx.HTTPError as e:
        raise OpenRouterError(str(e))
    if r.status_code != 200:
        raise OpenRouterError(f"openrouter {r.status_code}: {r.text[:400]}")
    data = r.json()
    choices = data.get("choices") or []
    if not choices:
        raise OpenRouterError("openrouter: no choices in response")
    return choices[0]["message"]["content"]


def extract_json(text: str) -> dict:
    text = (text or "").strip()
    m = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", text, re.S)
    if m:
        text = m.group(1)
    start, end = text.find("{"), text.rfind("}")
    if start < 0 or end < 0 or end < start:
        raise OpenRouterError("no JSON object found in response")
    try:
        return json.loads(text[start:end + 1])
    except json.JSONDecodeError as e:
        raise OpenRouterError(f"invalid JSON: {e}")
