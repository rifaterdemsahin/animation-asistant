"""Editable prompt templates for the local Python generators.

Mirror of server/prompts.go. Templates live as JSON files under
OTHER_DIR/_prompts/<id>.json (the same files the Go server writes to the Azure
"prompts" container when run with a connection string). When a file is absent
or unparseable, the compiled defaults below are used, so local scripts always
work. Keep these defaults in sync with server/prompts.go (defaultPromptValues).
"""
from __future__ import annotations
import json
from pathlib import Path
from .config import OTHER_DIR

PROMPTS_DIR = Path(OTHER_DIR) / "_prompts"

# --- defaults (verbatim from server/prompts.go::defaultPromptValues) ---

_DEFAULTS = {
    "outline": {
        "system": "You design short animated explainer video outlines using a STRICT 3-act structure: Act 1 = Problem, Act 2 = Solution, Act 3 = Lesson. You return JSON only, no markdown.",
        "user": ("Topic: {{topic}}\nComponent type: {{component_type}}\n\n"
                 'Produce a JSON object with this exact shape:\n'
                 '{"title":"short title","logline":"one sentence","acts":{"act-1":{"summary":"..."},"act-2":{"summary":"..."},"act-3":{"summary":"..."}}}\n'
                 "Each act summary must be 1-2 sentences fitting the act's role. JSON only."),
    },
    "script": {
        "system": "You are a scriptwriter for short animated explainer videos. You write ONE act and return STRICT JSON only, no markdown.",
        "user": ("Topic: {{topic}}\nAct: {{act_key}} ({{act_role}})\n"
                 "Outline summary for this act: {{summary}}\n\n"
                 "Write only this act. Return JSON with this exact shape:\n"
                 '{"narration":"1-3 paragraphs of voiceover","beats":[{"id":"beat-1","text":"one concrete, visualizable story beat"}]}\n'
                 "Rules: stay focused on the act role ({{purpose}}); 3 to 6 beats; each beat must be concrete and easy to illustrate. JSON only."),
    },
    "components": {
        "default_types": ["background", "lower-third", "speech-bubble", "infographic"],
        "styles": {
            "background": "wide 16:9 background scene illustration, clean flat vector style, no text",
            "lower-third": "lower-third banner overlay graphic with space for a short caption, flat vector, minimal",
            "speech-bubble": "speech bubble graphic with space for a short quote, flat vector, clean",
            "infographic": "clean infographic with simple data visualization using icons and numbers, flat vector",
            "character": "single character or mascot illustration, flat vector, centered, plain background",
            "icon": "simple minimal flat icon on a plain background",
            "title-card": "full-screen title card graphic with space for a heading, bold flat vector",
            "transition": "abstract motion-transition graphic, flat vector",
        },
        "image_prompt": "{{style}}. Illustrate this idea: {{beat}}. Topic: {{topic}}. Flat vector, clean, consistent style.",
    },
    "audio": {
        "music_prompt": "{{genre}} {{mood}} background music for a {{act_role}} act in an explainer video about: {{topic}}. 30 seconds, seamless loop.",
        "default_genre": "cinematic",
        "default_mood": "inspiring and uplifting",
        "sfx_prompt": "{{desc}}. Short, clean, game-quality sound effect.",
        "sfx_types": [
            {"name": "whoosh", "desc": "a quick whoosh transition sound effect"},
            {"name": "ding", "desc": "a bright notification ding sound effect"},
            {"name": "reveal", "desc": "a dramatic reveal sound effect"},
        ],
    },
    "storyboard": {
        "system": "You assemble a 3-act storyboard for an explainer video. Return STRICT JSON only, no markdown.",
        "user": ("Build a scene-by-scene storyboard from this project material:\n\n{{context}}\n\n"
                 'Return JSON: {"acts":{"act-1":{"scenes":[{"scene_id":"s1","beat_ref":"beat-1","component_ids":[],"duration":4,"description":"..."}]},"act-2":{"scenes":[]},"act-3":{"scenes":[]}}}\n'
                 "Each scene may reference an existing component_id. Durations are seconds (2-8). JSON only."),
        "image_prompt": ("A 4-frame storyboard infographic for a 3-act explainer video about: {{topic}}. "
                         "Arrange four horizontal frames in a 2x2 grid. "
                         "Frame 1 (top-left): Problem setup — show the pain point visually. "
                         "Frame 2 (top-right): Solution approach — introduce the key idea. "
                         "Frame 3 (bottom-left): Implementation — show how it works step by step. "
                         "Frame 4 (bottom-right): Lesson/takeaway — the insight the audience leaves with. "
                         "Each frame has a short label below it. Clean flat vector style, "
                         "modern explainer video aesthetic, consistent colors, no text inside frames."),
    },
}


def load(prompt_id: str) -> dict:
    """Return the prompt dict for id, reading the editable file when present."""
    f = PROMPTS_DIR / f"{prompt_id}.json"
    if f.exists():
        try:
            return json.loads(f.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, OSError):
            pass
    return json.loads(json.dumps(_DEFAULTS[prompt_id]))  # deep copy


def render(tmpl: str, vars: dict) -> str:
    s = tmpl
    for k, v in vars.items():
        s = s.replace("{{" + k + "}}", v)
    return s


def outline():
    p = load("outline")
    return p.get("system", ""), p.get("user", "")


def script():
    p = load("script")
    return p.get("system", ""), p.get("user", "")


def components():
    p = load("components")
    return (p.get("styles", {}) or {},
            p.get("default_types", []) or [],
            p.get("image_prompt", ""))


def music():
    p = load("audio")
    return (p.get("music_prompt", ""),
            p.get("default_genre", "cinematic"),
            p.get("default_mood", "inspiring and uplifting"))


def sfx():
    p = load("audio")
    return p.get("sfx_prompt", ""), p.get("sfx_types", []) or []


def storyboard():
    p = load("storyboard")
    return p.get("system", ""), p.get("user", ""), p.get("image_prompt", "")


def seed() -> None:
    """Write default JSON files for any missing prompt (local convenience)."""
    PROMPTS_DIR.mkdir(parents=True, exist_ok=True)
    for pid, val in _DEFAULTS.items():
        f = PROMPTS_DIR / f"{pid}.json"
        if not f.exists():
            f.write_text(json.dumps(val, indent=2, ensure_ascii=False), encoding="utf-8")
