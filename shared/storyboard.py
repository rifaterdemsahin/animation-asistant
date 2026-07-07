"""Storyboard assembly (mirror of server/storyboard.go)."""
from __future__ import annotations
import json
from .acts import ACTS
from . import storage
from .openrouter import chat_json, extract_json, generate_image, OpenRouterError


def _context(slug: str, p: dict) -> str:
    lines = [f"Title: {p['title']}", f"Topic: {p['topic']}", ""]
    try:
        lines += ["OUTLINE:", storage.read(slug, "outline.json").decode("utf-8"), ""]
    except FileNotFoundError:
        pass
    for act in ACTS:
        lines.append(f"== {act['title']} ({act['role']}) ==")
        try:
            lines.append("SCRIPT: " + storage.read(slug, f"{act['slug']}/script/beats.json").decode("utf-8"))
        except FileNotFoundError:
            pass
        try:
            comps = json.loads(storage.read(slug, f"{act['slug']}/components/components.json"))
            ids = ", ".join(c.get("id", "") for c in comps)
            lines.append("COMPONENTS: " + ids)
        except FileNotFoundError:
            pass
        lines.append("")
    return "\n".join(lines)


def generate_storyboard(slug: str) -> dict:
    p = storage.read_project(slug)
    context = _context(slug, p)
    msgs = [
        {"role": "system",
         "content": "You assemble a 3-act storyboard for an explainer video. Return STRICT JSON only, no markdown."},
        {"role": "user",
         "content": (f"Build a scene-by-scene storyboard from this project material:\n\n{context}\n\n"
                     'Return JSON: {"acts":{"act-1":{"scenes":[{"scene_id":"s1","beat_ref":"beat-1",'
                     '"component_ids":[],"duration":4,"description":"..."}]},"act-2":{"scenes":[]},'
                     '"act-3":{"scenes":[]}}}. Each scene may reference an existing component_id. '
                     "Durations are seconds (2-8). JSON only.")},
    ]
    obj = extract_json(chat_json(msgs))
    storage.write(slug, "storyboard/storyboard.json", json.dumps(obj, indent=2, ensure_ascii=False))
    prompt = (f"an infographic storyboard overview for a 3-act explainer video about: {p['topic']}. "
              "Three labeled sections: Problem, Solution, Lesson. Clean flat vector, modern.")
    try:
        png = generate_image(prompt)
        storage.write(slug, "storyboard/storyboard.png", png)
    except OpenRouterError:
        pass
    p["status"] = "storyboard"
    storage.write_project(slug, p)
    return obj
