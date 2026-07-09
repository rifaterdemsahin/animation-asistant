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


def _act_script_text(slug: str, act: dict) -> str:
    try:
        b = storage.read(slug, f"{act['slug']}/script/act.md")
        if b.strip():
            return b.decode("utf-8")
    except FileNotFoundError:
        pass
    try:
        b = storage.read(slug, f"{act['slug']}/script/beats.json")
        if b.strip():
            return b.decode("utf-8")
    except FileNotFoundError:
        pass
    return "(no script yet)"


def _outline_summaries(slug: str) -> dict:
    try:
        data = json.loads(storage.read(slug, "outline.json"))
        if isinstance(data, dict) and "acts" in data:
            return {k: v.get("summary", "") if isinstance(v, dict) else ""
                    for k, v in data["acts"].items()}
    except (FileNotFoundError, json.JSONDecodeError):
        pass
    return {}


def generate_storyboard(slug: str) -> dict:
    p = storage.read_project(slug)
    context = _context(slug, p)
    sys, usr, act_tmpls = prompts.storyboard()
    msgs = [
        {"role": "system", "content": sys},
        {"role": "user", "content": prompts.render(usr, {"context": context})},
    ]
    obj = extract_json(chat_json(msgs))
    storage.write(slug, "storyboard/storyboard.json", json.dumps(obj, indent=2, ensure_ascii=False))

    outline_map = _outline_summaries(slug)
    for act in ACTS:
        ak = act["key"]
        summary = outline_map.get(ak, act["purpose"])
        act_script = _act_script_text(slug, act)
        prompt = prompts.render(act_tmpls[ak], {
            "topic": p["topic"],
            "question": p.get("question", ""),
            "answer": p.get("answer", ""),
            "why": p.get("why", ""),
            "act_key": ak,
            "act_title": act["title"],
            "act_role": act["role"],
            "act_summary": summary,
            "act_script": act_script,
        })
        try:
            png = generate_image(prompt)
            storage.write(slug, f"storyboard/storyboard-{ak}.png", png)
        except OpenRouterError:
            pass

    p["status"] = "storyboard"
    storage.write_project(slug, p)
    return obj
