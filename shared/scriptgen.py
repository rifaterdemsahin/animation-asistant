"""Outline + per-act script generation (mirror of server/script.go)."""
from __future__ import annotations
import json
from .acts import ACTS, ACT_BY_KEY
from . import storage
from .openrouter import chat_json, extract_json


def generate_outline(slug: str) -> dict:
    p = storage.read_project(slug)
    msgs = [
        {"role": "system",
         "content": "You design short animated explainer video outlines using a STRICT 3-act structure: "
                    "Act 1 = Problem, Act 2 = Solution, Act 3 = Lesson. Return JSON only, no markdown."},
        {"role": "user",
         "content": (f"Topic: {p['topic']}\nComponent type: {p.get('component_type','explainer')}\n\n"
                     'Produce JSON: {"title":"short title","logline":"one sentence",'
                     '"acts":{"act-1":{"summary":"..."},"act-2":{"summary":"..."},"act-3":{"summary":"..."}}}. '
                     "Each summary 1-2 sentences. JSON only.")},
    ]
    obj = extract_json(chat_json(msgs))
    storage.write(slug, "outline.json", json.dumps(obj, indent=2, ensure_ascii=False))
    for key in p["acts"]:
        p["acts"][key]["outline"] = "done"
    p["status"] = "outline"
    storage.write_project(slug, p)
    return obj


def outline_map(slug: str) -> dict:
    try:
        obj = json.loads(storage.read(slug, "outline.json"))
        amap = obj.get("acts", {})
        return {k: (v.get("summary", "") if isinstance(v, dict) else "") for k, v in amap.items()}
    except FileNotFoundError:
        return {}


def generate_script(slug: str, acts=None) -> dict:
    p = storage.read_project(slug)
    omap = outline_map(slug)
    keys = acts or [a["key"] for a in ACTS]
    results = {}
    for key in keys:
        act = ACT_BY_KEY[key]
        summary = omap.get(key) or act["purpose"]
        msgs = [
            {"role": "system",
             "content": "You are a scriptwriter for short animated explainer videos. "
                        "Write ONE act and return STRICT JSON only, no markdown."},
            {"role": "user",
             "content": (f"Topic: {p['topic']}\nAct: {act['key']} ({act['role']})\n"
                         f"Outline summary for this act: {summary}\n\n"
                         'Write only this act. Return JSON: {"narration":"1-3 paragraphs",'
                         '"beats":[{"id":"beat-1","text":"one concrete, visualizable beat"}]}. '
                         f"3-6 beats, focused on the role ({act['role']}). JSON only.")},
        ]
        obj = extract_json(chat_json(msgs))
        md = to_markdown(act, obj)
        storage.write(slug, f"{act['slug']}/script/act.md", md)
        storage.write(slug, f"{act['slug']}/script/beats.json",
                      json.dumps(obj, indent=2, ensure_ascii=False))
        p["acts"][key]["script"] = "done"
        results[key] = obj
    p["status"] = "script"
    storage.write_project(slug, p)
    return results


def to_markdown(act: dict, obj: dict) -> str:
    narration = (obj.get("narration") or "").strip()
    beats = obj.get("beats") or []
    lines = [f"# {act['title']}", "", f"**Role:** {act['role']}", "", "## Narration", "", narration, "", "## Beats", ""]
    for b in beats:
        if isinstance(b, dict):
            lines.append(f"- **{b.get('id','')}**: {(b.get('text','') or '').strip()}")
    return "\n".join(lines) + "\n"
