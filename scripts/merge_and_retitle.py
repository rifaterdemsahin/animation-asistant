#!/usr/bin/env python3
"""Delete duplicate projects (lowercase qid, no answer) and update titles."""

import json, urllib.request, urllib.error, http.cookiejar, os, time

BASE_URL = "http://localhost:8080"
PASSWORD = os.environ.get("ADMIN_PASSWORD", "Welcome.June.SH.9#")


def login(password: str):
    cj = http.cookiejar.CookieJar()
    opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(cj))
    body = json.dumps({"password": password}).encode()
    req = urllib.request.Request(f"{BASE_URL}/api/login", data=body, method="POST")
    req.add_header("Content-Type", "application/json")
    with opener.open(req): pass
    return opener


def get_projects(opener):
    req = urllib.request.Request(f"{BASE_URL}/api/projects")
    with opener.open(req) as resp:
        return json.loads(resp.read())["projects"]


def delete_project(opener, slug: str) -> bool:
    req = urllib.request.Request(f"{BASE_URL}/api/projects/{slug}", method="DELETE")
    try:
        with opener.open(req) as resp:
            return resp.status == 200
    except urllib.error.HTTPError as e:
        print(f"  Delete {slug}: ERROR {e.code}")
        return False


def update_project(opener, slug: str, fields: dict) -> bool:
    body = json.dumps(fields).encode()
    req = urllib.request.Request(f"{BASE_URL}/api/projects/{slug}", data=body, method="PUT")
    req.add_header("Content-Type", "application/json")
    try:
        with opener.open(req) as resp:
            return resp.status == 200
    except urllib.error.HTTPError as e:
        print(f"  Update {slug}: ERROR {e.code} {e.read().decode()}")
        return False


def main():
    opener = login(PASSWORD)
    projects = get_projects(opener)

    # --- STEP 1: Find and delete bad duplicates ---
    # Good = has answer data (my batch import)
    # Bad = lowercase qid, no answer data (old imports)
    bad_slugs = []
    for p in projects:
        qid = p.get("question_id", "").lower()
        if not qid.startswith("q"):
            continue
        # Bad: lowercase question_id AND empty answer (no data)
        if p.get("question_id") != p.get("question_id", "").upper() or not p.get("answer", "").strip():
            # Check if there's a better duplicate
            qnum = qid.replace("q", "")
            # Good ones have QXX (uppercase)
            good = [x for x in projects if x.get("question_id", "").upper() == f"Q{qnum.upper()}" and x["slug"] != p["slug"]]
            if good:
                bad_slugs.append(p["slug"])

    print(f"Deleting {len(bad_slugs)} duplicate projects with incomplete data...")
    deleted = 0
    for slug in bad_slugs:
        if delete_project(opener, slug):
            print(f"  DELETED: {slug}")
            deleted += 1
        time.sleep(0.15)

    print(f"\nDeleted: {deleted}/{len(bad_slugs)}")

    # --- STEP 2: Generate user-friendly titles ---
    # Reload projects after deletions
    projects = get_projects(opener)
    q_projects = sorted(
        [p for p in projects if p.get("question_id", "").startswith("Q")],
        key=lambda p: int(p["question_id"].replace("Q", "").lstrip("0"))
    )

    # Title mapping: extract key concept from question + answer
    # Generate a concise 4-7 word title based on the Q&A
    title_map = {}
    for p in q_projects:
        qid = p["question_id"]
        question = p.get("question", "")
        answer = p.get("answer", "")
        qtype = p.get("type", "")

        # Derive a short title from the question's core topic
        # Strategy: use the answer's key takeaway + question topic
        title_map[qid] = derive_title(question, answer, qtype, qid)

    # --- STEP 3: Update projects ---
    print("\nUpdating titles...")
    updated = 0
    for p in q_projects:
        qid = p["question_id"]
        new_title = title_map.get(qid)
        if new_title and new_title != p["title"]:
            if update_project(opener, p["slug"], {"title": new_title}):
                print(f"  {qid}: \"{p['title']}\" → \"{new_title}\"")
                updated += 1
        time.sleep(0.15)

    print(f"\nUpdated: {updated} titles")


TITLES = {
    # Multi-Agent Research System
    "Q09": "Task Decomposition Gaps Limit Coverage",
    "Q10": "Lost-in-the-Middle: Primacy & Recency",
    "Q11": "Intermediate Summarization for Token Budget",
    "Q12": "Scoped Tools Balance Speed vs Boundaries",
    "Q13": "Flagging Source Conflicts for Coordinator",
    "Q14": "Replace Broad Tools with Scoped Ones",
    "Q15": "Distinct Tool Names Prevent Routing Errors",
    # Code Generation
    "Q16": "Path-Specific Rules for Selective Context",
    "Q17": "Plan Mode Before Large Refactors",
    "Q18": "Fork Context + Allowed Tools for Skills",
    "Q19": "Project-Level vs User-Level CLAUDE.md",
    "Q20": ".claude/rules/ for Modular Instructions",
    "Q21": "Forked Context for Exploratory Skills",
    "Q22": "Skills for Task-Specific Workflows",
    "Q23": "Plan Mode for Ambiguous Requirements",
    "Q24": "Forked Context Prevents Context Pollution",
    "Q25": "Per-User Skills for Personal Preferences",
    "Q26": "Path-Specific YAML Rules by Directory",
    "Q27": "User-Level MCP Server Configuration",
    "Q28": "Few-Shot Examples Define Output Format",
    "Q29": "Slash Commands in .claude/commands/",
    "Q30": "Explore + Plan Modes for Complex Tasks",
    # Customer Support
    "Q31": "Few-Shot Examples for Ambiguous Scenarios",
    "Q32": "Decompose Multi-Intent to Sequential Tools",
    "Q33": "Composite Tools Reduce API Round-Trips",
    "Q34": "Preserve Transactional Facts in Summaries",
    "Q35": "PostToolUse Hooks Clean MCP Data",
    "Q36": "Tool Descriptions Prevent Hallucination",
    "Q37": "Tool Descriptions with Input Examples",
    "Q38": "Explicit Escalation Criteria Raise FCR",
    "Q39": "Preprocessing Layer Separates Concerns",
    "Q40": "Adversarial Examples Correct Model Bias",
    "Q41": "Self-Critique Step Validates Resolution",
    "Q42": "Programmatic Prerequisites Enforce Tool Order",
    "Q44": "Scope Tools to Avoid Cross-Use Leakage",
    "Q45": "Ambiguous Lookups Need Disambiguation",
    # Claude CI
    "Q46": "Dual-Model Review for Self-Bias",
    "Q47": "Explicit Criteria for Review Precision",
    "Q48": "Split Large PRs into Focused Passes",
    "Q49": "Few-Shot Examples for Review Format",
    "Q50": "Batch Processing for Cost Efficiency",
    "Q51": "Headless Mode for CI Automation",
    "Q52": "Sync vs Async Tool Modes in CI",
    "Q53": "Pre-Commit vs Post-Commit Review Strategy",
    "Q54": "Require Reasoning for Reviewer Trust",
    "Q55": "Explicit Severity Criteria in Prompts",
    "Q56": "Include Existing Tests as Context",
    "Q57": "Sync for Style, Async for Deep Analysis",
    "Q58": "Differential Review with Prior Findings",
}


def derive_title(question: str, answer: str, qtype: str, qid: str) -> str:
    if qid in TITLES:
        return TITLES[qid]
    return derive_fallback(question, qtype)


def derive_fallback(question: str, qtype: str) -> str:
    """Simple fallback: first sentence or key phrase."""
    # Take first 60 chars and make it a title
    short = question[:70].rstrip(".,?!;: ")
    if len(short) > 60:
        # Try to break at natural point
        for sep in [", ", " — ", ". ", ": "]:
            idx = short.find(sep)
            if 15 < idx < 60:
                short = short[:idx]
                break
    return short


if __name__ == "__main__":
    main()
