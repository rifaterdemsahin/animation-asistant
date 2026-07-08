"""Outline + per-act script generation (mirror of server/script.go)."""
from __future__ import annotations
import json
from .acts import ACTS, ACT_BY_KEY
from . import storage, prompts
from .openrouter import chat_json, extract_json


def generate_outline(slug: str) -> dict:
    p = storage.read_project(slug)
    sys, usr = prompts.outline()
    msgs = [
        {"role": "system", "content": sys},
        {"role": "user",
         "content": prompts.render(usr, {"topic": p["topic"],
                                        "component_type": p.get("component_type", "explainer")})},
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
        sys, usr = prompts.script()
        msgs = [
            {"role": "system", "content": sys},
            {"role": "user",
             "content": prompts.render(usr, {"topic": p["topic"],
                                            "act_key": act["key"],
                                            "act_role": act["role"],
                                            "summary": summary,
                                            "purpose": act["purpose"]})},
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
