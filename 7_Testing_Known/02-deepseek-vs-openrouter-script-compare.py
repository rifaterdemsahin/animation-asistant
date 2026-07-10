#!/usr/bin/env python3
"""
02 — DeepSeek vs OpenRouter Script Generation Comparison

Tests script generation for one project using both DeepSeek and OpenRouter APIs
with the same prompt templates used by the Go backend. Compares output quality,
format compliance, latency, and cost.

Usage:
    export DEEPSEEK_API_KEY="sk-..."  # required
    # OPENROUTER_API_KEY is read from .env
    python 7_Test/02-deepseek-vs-openrouter-script-compare.py <project_id>

Example:
    python 7_Test/02-deepseek-vs-openrouter-script-compare.py q1
"""

import json
import os
import sys
import time
import textwrap
from pathlib import Path

import requests

# --- Config ---
PROJECT_ROOT = Path(__file__).resolve().parent.parent
API_BASE = "http://localhost:8080"
COOKIE_FILE = "/tmp/compare_cookies.txt"

OPENROUTER_BASE = "https://openrouter.ai/api/v1"
OPENROUTER_TEXT_MODEL = "google/gemini-2.5-flash"

DEEPSEEK_BASE = "https://api.deepseek.com"
DEEPSEEK_MODEL = "deepseek-chat"

ACTS = {
    "act-1": {"role": "problem", "purpose": "Set up the world and the problem/pain the audience feels."},
    "act-2": {"role": "solution", "purpose": "Introduce the solution; show how the problem is resolved."},
    "act-3": {"role": "lesson", "purpose": "The takeaway / moral / insight the audience leaves with."},
}

# --- Auth ---
def load_env(key):
    """Read a key=value (with optional quoting) from .env."""
    env_file = PROJECT_ROOT / ".env"
    if not env_file.exists():
        return os.environ.get(key, "")
    for line in env_file.read_text().splitlines():
        line = line.strip()
        if line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        if k.strip() == key:
            v = v.strip().strip("'").strip('"')
            return v
    return os.environ.get(key, "")


def login():
    pw = load_env("ADMIN_PASSWORD")
    r = requests.post(f"{API_BASE}/api/login", json={"password": pw})
    r.raise_for_status()
    cookies = r.cookies
    with open(COOKIE_FILE, "w") as f:
        for c in cookies:
            f.write(f"{c.name}\t{c.value}\n")
    return cookies


def api_get(path):
    with open(COOKIE_FILE) as f:
        cookie_str = "; ".join(f"{l.split()[0]}={l.split()[1]}" for l in f.read().strip().splitlines() if l)
    r = requests.get(f"{API_BASE}{path}", headers={"Cookie": cookie_str})
    r.raise_for_status()
    return r.json()


# --- Prompt Templates (mirrors server/prompts.go defaultPromptValues) ---

OUTLINE_SYSTEM = (
    "You design short animated explainer video outlines using a STRICT 3-act "
    "structure: Act 1 = Problem, Act 2 = Solution, Act 3 = Lesson. "
    "You return JSON only, no markdown."
)

OUTLINE_USER = textwrap.dedent("""\
    Topic: {topic}
    Component type: {component_type}

    Produce a JSON object with this exact shape:
    {{"title":"short title","logline":"one sentence","acts":{{"act-1":{{"summary":"..."}},"act-2":{{"summary":"..."}},"act-3":{{"summary":"..."}}}}}}
    Each act summary must be 1-2 sentences fitting the act's role. JSON only.""")

SCRIPT_SYSTEM = (
    "You are an expert scriptwriter and storyboard visualizer for animated "
    "explainer videos. You write ONE act and return STRICT JSON only, no markdown. "
    "When storyboard image prompts are provided in the prompt context, your "
    "narration MUST describe what the audience sees in those images — match the "
    "visual style, layout, and elements precisely. Maintain a professional, "
    "engaging, and educational tone suitable for animated learning content."
)

SCRIPT_USER = textwrap.dedent("""\
    {storyboard_prompts}
    ---
    ### ACT: {act_key} — {act_role}

    **Purpose:** {purpose}

    **Outline Summary:** {summary}

    ---

    ### TASK
    Write ONLY this act. Use the storyboard images above as visual reference — your narration must describe what the audience sees.

    ### OUTPUT FORMAT — JSON ONLY
    Return a single JSON object with this exact shape:
    {{
      "narration": "1-3 paragraphs of professional voiceover",
      "beats": [
        {{"id": "beat-1", "text": "one concrete, highly visualizable story beat"}},
        {{"id": "beat-2", "text": "next concrete story beat"}}
      ]
    }}

    ### RULES
    - 3 to 6 beats per act.
    - Each beat must be concrete and easy for an illustrator or animator to visualize.
    - Stay focused on this act's role: {purpose}
    - When storyboard images exist above, your beats and narration must reference visual elements from those images.
    - Do NOT write other acts.
    - JSON ONLY. No markdown, no explanations outside the JSON.""")


# --- API callers ---

def call_openrouter(messages, key, model=OPENROUTER_TEXT_MODEL):
    """Calls OpenRouter chat/completions. Returns (parsed_json, latency_ms, tokens)."""
    start = time.time()
    r = requests.post(
        f"{OPENROUTER_BASE}/chat/completions",
        headers={
            "Authorization": f"Bearer {key}",
            "Content-Type": "application/json",
            "X-Title": "animation-assistant-compare",
        },
        json={"model": model, "messages": messages, "temperature": 0.7},
        timeout=180,
    )
    latency_ms = int((time.time() - start) * 1000)
    r.raise_for_status()
    data = r.json()
    content = data["choices"][0]["message"]["content"]
    usage = data.get("usage", {})
    tokens = {
        "input": usage.get("prompt_tokens", 0),
        "output": usage.get("completion_tokens", 0),
    }
    return content, latency_ms, tokens


def call_deepseek(messages, key, model=DEEPSEEK_MODEL):
    """Calls DeepSeek chat/completions. Returns (parsed_json, latency_ms, tokens)."""
    start = time.time()
    r = requests.post(
        f"{DEEPSEEK_BASE}/chat/completions",
        headers={
            "Authorization": f"Bearer {key}",
            "Content-Type": "application/json",
        },
        json={"model": model, "messages": messages, "temperature": 0.7},
        timeout=180,
    )
    latency_ms = int((time.time() - start) * 1000)
    r.raise_for_status()
    data = r.json()
    content = data["choices"][0]["message"]["content"]
    usage = data.get("usage", {})
    tokens = {
        "input": usage.get("prompt_tokens", 0),
        "output": usage.get("completion_tokens", 0),
    }
    return content, latency_ms, tokens


def extract_json(raw):
    """Extract JSON from model output (may have markdown fences)."""
    raw = raw.strip()
    if raw.startswith("```"):
        lines = raw.splitlines()
        for i, line in enumerate(lines):
            if line.startswith("```") and i > 0:
                raw = "\n".join(lines[1:i])
                break
        else:
            if raw.startswith("```json"):
                raw = raw[7:]
            elif raw.startswith("```"):
                raw = raw[3:]
            if raw.endswith("```"):
                raw = raw[:-3]
    return json.loads(raw.strip())


# --- Cost calculation ---
# OpenRouter Gemini Flash: $0.15/$0.60 per 1M input/output tokens
# DeepSeek: $0.27/$1.10 per 1M input/output tokens (deepseek-chat)

def cost_openrouter(tokens):
    return (tokens["input"] * 0.15 + tokens["output"] * 0.60) / 1_000_000


def cost_deepseek(tokens):
    return (tokens["input"] * 0.27 + tokens["output"] * 1.10) / 1_000_000


# --- Main ---

def run_outline(project, or_key, ds_key):
    """Generate outline via both APIs, compare."""
    topic = project.get("topic", "") or project.get("question", "")
    comp_type = project.get("component_type", "explainer")

    user = OUTLINE_USER.format(topic=topic, component_type=comp_type)
    msgs = [
        {"role": "system", "content": OUTLINE_SYSTEM},
        {"role": "user", "content": user},
    ]

    print(f"  Outline prompt: {len(OUTLINE_SYSTEM) + len(user)} chars")
    print()

    # OpenRouter
    print("  Calling OpenRouter (gemini-2.5-flash)...")
    try:
        or_raw, or_lat, or_tok = call_openrouter(msgs, or_key)
        or_outline = extract_json(or_raw)
        print(f"    ✓ {or_lat}ms  in:{or_tok['input']}  out:{or_tok['output']}  cost:${cost_openrouter(or_tok):.6f}")
    except Exception as e:
        print(f"    ✗ OpenRouter error: {e}")
        or_outline, or_lat, or_tok = None, 0, {}
        or_raw = str(e)

    # DeepSeek
    print("  Calling DeepSeek (deepseek-chat)...")
    try:
        ds_raw, ds_lat, ds_tok = call_deepseek(msgs, ds_key)
        ds_outline = extract_json(ds_raw)
        print(f"    ✓ {ds_lat}ms  in:{ds_tok['input']}  out:{ds_tok['output']}  cost:${cost_deepseek(ds_tok):.6f}")
    except Exception as e:
        print(f"    ✗ DeepSeek error: {e}")
        ds_outline, ds_lat, ds_tok = None, 0, {}
        ds_raw = str(e)

    return {
        "openrouter": {"parsed": or_outline, "raw": or_raw, "latency_ms": or_lat, "tokens": or_tok},
        "deepseek": {"parsed": ds_outline, "raw": ds_raw, "latency_ms": ds_lat, "tokens": ds_tok},
    }


def run_script_act(act_key, act_info, outline_summary, or_key, ds_key):
    """Generate one act's script via both APIs, compare."""
    user = SCRIPT_USER.format(
        storyboard_prompts="",
        act_key=act_key,
        act_role=act_info["role"],
        purpose=act_info["purpose"],
        summary=outline_summary or act_info["purpose"],
    )
    msgs = [
        {"role": "system", "content": SCRIPT_SYSTEM},
        {"role": "user", "content": user},
    ]

    result = {}

    # OpenRouter
    try:
        or_raw, or_lat, or_tok = call_openrouter(msgs, or_key)
        or_script = extract_json(or_raw)
        result["openrouter"] = {"parsed": or_script, "raw": or_raw, "latency_ms": or_lat, "tokens": or_tok}
        print(f"      OR:  {or_lat}ms  in:{or_tok['input']}  out:{or_tok['output']}  "
              f"beats:{len(or_script.get('beats',[]))}  narration:{len(or_script.get('narration',''))}ch")
    except Exception as e:
        result["openrouter"] = {"error": str(e)}
        print(f"      OR:  ERROR — {e}")

    # DeepSeek
    try:
        ds_raw, ds_lat, ds_tok = call_deepseek(msgs, ds_key)
        ds_script = extract_json(ds_raw)
        result["deepseek"] = {"parsed": ds_script, "raw": ds_raw, "latency_ms": ds_lat, "tokens": ds_tok}
        print(f"      DS:  {ds_lat}ms  in:{ds_tok['input']}  out:{ds_tok['output']}  "
              f"beats:{len(ds_script.get('beats',[]))}  narration:{len(ds_script.get('narration',''))}ch")
    except Exception as e:
        result["deepseek"] = {"error": str(e)}
        print(f"      DS:  ERROR — {e}")

    return result


def compare_outputs(or_parsed, ds_parsed):
    """Return a qualitative comparison."""
    diffs = []

    if or_parsed is None and ds_parsed is None:
        return ["Both APIs failed."]
    if or_parsed is None:
        return ["OpenRouter failed, DeepSeek succeeded."]
    if ds_parsed is None:
        return ["DeepSeek failed, OpenRouter succeeded."]

    # Check JSON structure
    for field in ["narration", "beats"]:
        or_has = field in or_parsed
        ds_has = field in ds_parsed
        if or_has and ds_has:
            diffs.append(f"  ✓ Both have '{field}' field")
        elif not or_has and not ds_has:
            diffs.append(f"  ✗ Both MISSING '{field}' field")
        elif not or_has:
            diffs.append(f"  ⚠ OpenRouter MISSING '{field}', DeepSeek has it")
        else:
            diffs.append(f"  ⚠ DeepSeek MISSING '{field}', OpenRouter has it")

    # Narration length
    or_narr_len = len(or_parsed.get("narration", ""))
    ds_narr_len = len(ds_parsed.get("narration", ""))
    diffs.append(f"  Narration length: OR={or_narr_len}ch  DS={ds_narr_len}ch")

    # Beat count
    or_beats = len(or_parsed.get("beats", []))
    ds_beats = len(ds_parsed.get("beats", []))
    diffs.append(f"  Beat count:       OR={or_beats}  DS={ds_beats}")

    # Beat structure
    or_beat_ok = all("id" in b and "text" in b for b in or_parsed.get("beats", []))
    ds_beat_ok = all("id" in b and "text" in b for b in ds_parsed.get("beats", []))
    diffs.append(f"  Beat structure:   OR={'✓ valid' if or_beat_ok else '✗ INVALID'}  DS={'✓ valid' if ds_beat_ok else '✗ INVALID'}")

    # Beat ID format
    if or_beats > 0:
        or_ids = [b.get("id", "") for b in or_parsed.get("beats", [])]
        ds_ids = [b.get("id", "") for b in ds_parsed.get("beats", [])]
        or_fmt = all(i.startswith("beat-") for i in or_ids)
        ds_fmt = all(i.startswith("beat-") for i in ds_ids)
        diffs.append(f"  Beat ID format:   OR={'✓ beat-N' if or_fmt else '✗ wrong format'}  DS={'✓ beat-N' if ds_fmt else '✗ wrong format'}")

    return diffs


def main():
    if len(sys.argv) < 2:
        print("Usage: python 7_Test/02-deepseek-vs-openrouter-script-compare.py <project_id>")
        print("Example: python 7_Test/02-deepseek-vs-openrouter-script-compare.py q1")
        sys.exit(1)

    project_id = sys.argv[1]

    # Keys
    or_key = load_env("OPENROUTER_API_KEY")
    ds_key = os.environ.get("DEEPSEEK_API_KEY", "")

    if not or_key:
        print("ERROR: OPENROUTER_API_KEY not found in .env")
        sys.exit(1)
    if not ds_key:
        print("ERROR: DEEPSEEK_API_KEY not set in environment. Export it first:")
        print("  export DEEPSEEK_API_KEY='sk-...'")
        sys.exit(1)

    # Auth
    print(f"Logging in to {API_BASE}...")
    login()
    print("✓ Authenticated\n")

    # Fetch project
    print(f"Fetching project {project_id}...")
    project = api_get(f"/api/projects/{project_id}")
    title = project.get("title", project_id)
    print(f"  Title: {title}")
    print(f"  Topic: {project.get('topic') or project.get('question', '(empty)')}")
    print(f"  Status: {project.get('status')}")
    print()

    # === Phase 1: Outline ===
    print("=" * 70)
    print("PHASE 1: OUTLINE GENERATION COMPARISON")
    print("=" * 70)
    outline_results = run_outline(project, or_key, ds_key)

    or_out = outline_results["openrouter"]["parsed"]
    ds_out = outline_results["deepseek"]["parsed"]

    print("\n  --- Outline Comparison ---")
    if or_out and ds_out:
        or_title = or_out.get("title", "?")
        ds_title = ds_out.get("title", "?")
        print(f"  Title:  OR='{or_title}'  DS='{ds_title}'")
        for act_key in ["act-1", "act-2", "act-3"]:
            or_sum = (or_out.get("acts", {}).get(act_key, {}).get("summary", "?"))
            ds_sum = (ds_out.get("acts", {}).get(act_key, {}).get("summary", "?"))
            print(f"  {act_key}: OR='{or_sum[:80]}...'  DS='{ds_sum[:80]}...'")
    else:
        print("  Cannot compare — one or both APIs failed.")

    # Use whichever outline succeeded (prefer OR, fallback DS)
    outline = or_out or ds_out or {}

    # === Phase 2: Script per act ===
    print(f"\n{'=' * 70}")
    print("PHASE 2: SCRIPT GENERATION COMPARISON (per act)")
    print("=" * 70)

    all_results = {}
    total_or_cost = 0
    total_ds_cost = 0
    total_or_lat = 0
    total_ds_lat = 0

    for act_key, act_info in ACTS.items():
        summary = ""
        if outline:
            summary = outline.get("acts", {}).get(act_key, {}).get("summary", "")
        print(f"\n  ▶ {act_key} ({act_info['role']})")
        print(f"    Summary: {summary or '(using purpose as fallback)'}")

        result = run_script_act(act_key, act_info, summary, or_key, ds_key)
        all_results[act_key] = result

        # Accumulate stats
        if "tokens" in result.get("openrouter", {}):
            total_or_cost += cost_openrouter(result["openrouter"]["tokens"])
            total_or_lat += result["openrouter"]["latency_ms"]
        if "tokens" in result.get("deepseek", {}):
            total_ds_cost += cost_deepseek(result["deepseek"]["tokens"])
            total_ds_lat += result["deepseek"]["latency_ms"]

        # Compare this act
        print(f"\n    --- {act_key} Comparison ---")
        or_p = result.get("openrouter", {}).get("parsed")
        ds_p = result.get("deepseek", {}).get("parsed")
        for line in compare_outputs(or_p, ds_p):
            print(line)

        # Show narration preview
        if or_p and ds_p and or_p.get("narration") and ds_p.get("narration"):
            print(f"\n    --- Narration Preview ---")
            print(f"    OR:  {or_p['narration'][:120]}...")
            print(f"    DS:  {ds_p['narration'][:120]}...")

    # === Summary ===
    print(f"\n{'=' * 70}")
    print("SUMMARY")
    print("=" * 70)

    or_fail = sum(1 for r in all_results.values() if "error" in r.get("openrouter", {}))
    ds_fail = sum(1 for r in all_results.values() if "error" in r.get("deepseek", {}))
    or_ok = 3 - or_fail
    ds_ok = 3 - ds_fail

    print(f"\n  Success rate:")
    print(f"    OpenRouter: {or_ok}/3 acts succeeded")
    print(f"    DeepSeek:   {ds_ok}/3 acts succeeded")

    print(f"\n  Total latency:")
    print(f"    OpenRouter: {total_or_lat}ms")
    print(f"    DeepSeek:   {total_ds_lat}ms")

    print(f"\n  Estimated cost (3 acts):")
    print(f"    OpenRouter: ${total_or_cost:.6f}")
    print(f"    DeepSeek:   ${total_ds_cost:.6f}")

    if ds_ok > 0 and or_ok > 0:
        print(f"\n  ⚡ DeepSeek is {total_or_cost / total_ds_cost:.1f}× {'cheaper' if total_ds_cost < total_or_cost else 'more expensive'} than OpenRouter")
        print(f"  ⚡ DeepSeek is {total_or_lat / total_ds_lat:.1f}× {'faster' if total_ds_lat < total_or_lat else 'slower'} than OpenRouter")

    # Save results
    output_dir = PROJECT_ROOT / "7_Test" / "output"
    output_dir.mkdir(exist_ok=True)
    report_file = output_dir / f"compare-{project_id}.json"
    with open(report_file, "w") as f:
        json.dump({
            "project_id": project_id,
            "outline": {
                "openrouter": {k: str(v) for k, v in outline_results["openrouter"].items() if k != "parsed"},
                "deepseek": {k: str(v) for k, v in outline_results["deepseek"].items() if k != "parsed"},
            },
            "scripts": {k: {
                "or": {kk: str(vv) if kk != "parsed" else vv for kk, vv in v.get("openrouter", {}).items()},
                "ds": {kk: str(vv) if kk != "parsed" else vv for kk, vv in v.get("deepseek", {}).items()},
            } for k, v in all_results.items()},
        }, f, indent=2, default=str)

    print(f"\n  Full report saved: {report_file}")
    print()


if __name__ == "__main__":
    main()
