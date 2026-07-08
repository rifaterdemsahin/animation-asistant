"""Storyboard assembly (mirror of server/storyboard.go)."""
from __future__ import annotations
import json
from .acts import ACTS
from . import storage, prompts
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
    sys, usr, img_tmpl = prompts.storyboard()
    msgs = [
        {"role": "system", "content": sys},
        {"role": "user", "content": prompts.render(usr, {"context": context})},
    ]
    obj = extract_json(chat_json(msgs))
    storage.write(slug, "storyboard/storyboard.json", json.dumps(obj, indent=2, ensure_ascii=False))
    prompt = prompts.render(img_tmpl, {
        "topic": p["topic"],
        "question": p.get("question", ""),
        "answer": p.get("answer", ""),
        "why": p.get("why", ""),
    })
    try:
        png = generate_image(prompt)
        storage.write(slug, "storyboard/storyboard.png", png)
    except OpenRouterError:
        pass
    p["status"] = "storyboard"
    storage.write_project(slug, p)
    return obj
