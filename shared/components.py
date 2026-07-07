"""Typed component image generation (mirror of server/components.go)."""
from __future__ import annotations
import json
from .acts import ACTS, ACT_BY_KEY
from . import storage
from .openrouter import generate_image, OpenRouterError

DEFAULT_TYPES = ["background", "lower-third", "speech-bubble", "infographic"]

STYLE = {
    "background": "wide 16:9 background scene illustration, clean flat vector style, no text",
    "lower-third": "lower-third banner overlay graphic with space for a short caption, flat vector, minimal",
    "speech-bubble": "speech bubble graphic with space for a short quote, flat vector, clean",
    "infographic": "clean infographic with simple data visualization using icons and numbers, flat vector",
    "character": "single character or mascot illustration, flat vector, centered, plain background",
    "icon": "simple minimal flat icon on a plain background",
    "title-card": "full-screen title card graphic with space for a heading, bold flat vector",
    "transition": "abstract motion-transition graphic, flat vector",
}


def _load_beats(slug: str, act: dict):
    try:
        obj = json.loads(storage.read(slug, f"{act['slug']}/script/beats.json"))
    except FileNotFoundError:
        return []
    return obj.get("beats") or []


def _beat_at(beats, i):
    if i < len(beats) and isinstance(beats[i], dict):
        return beats[i].get("text") or ""
    if beats and isinstance(beats[0], dict):
        return beats[0].get("text") or ""
    return ""


def _beat_id(beats, i):
    if i < len(beats) and isinstance(beats[i], dict):
        return beats[i].get("id") or ""
    if beats and isinstance(beats[0], dict):
        return beats[0].get("id") or ""
    return ""


def generate_components(slug: str, acts=None, types=None) -> dict:
    p = storage.read_project(slug)
    keys = acts or [a["key"] for a in ACTS]
    types = types or DEFAULT_TYPES
    manifest = {}
    for key in keys:
        act = ACT_BY_KEY[key]
        beats = _load_beats(slug, act)
        items = []
        for i, t in enumerate(types):
            style = STYLE.get(t, t)
            beat = _beat_at(beats, i) or p["topic"]
            prompt = (f"{style}. Illustrate this idea: {beat}. "
                      f"Topic: {p['topic']}. Flat vector, clean, consistent style.")
            img = generate_image(prompt)
            fname = f"{slug}-{t}-{i + 1:02d}.png"
            rel = f"{act['slug']}/components/{fname}"
            storage.write(slug, rel, img)
            items.append({"id": f"{slug}-{t}-{i + 1:02d}", "type": t,
                          "prompt": prompt, "file": rel, "script_ref": _beat_id(beats, i)})
        storage.write(slug, f"{act['slug']}/components/components.json",
                      json.dumps(items, indent=2, ensure_ascii=False))
        manifest[key] = items
        p["acts"][key]["components"] = "done"
    p["status"] = "components"
    storage.write_project(slug, p)
    return manifest
