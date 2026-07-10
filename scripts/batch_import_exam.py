#!/usr/bin/env python3
"""Batch import exam questions Q9-Q58 as projects into the Animation Assistant."""

import json
import sys
import urllib.request
import urllib.error
import http.cookiejar
import os

BASE_URL = os.environ.get("BASE_URL", "http://localhost:8080")
JSON_PATH = os.path.join(os.path.dirname(__file__), "..", "3_Simulation", "pro-exam.json")

SCENARIO_TO_TYPE = {
    "Multi-Agent Research System": "multi-agent-research",
    "Code Generation with Claude Code": "code-generation",
    "Claude Code for Continuous Integration": "claude-ci",
    "Customer Support Resolution Agent": "customer-resolution-agent",
}


def login(password: str) -> http.cookiejar.CookieJar:
    cj = http.cookiejar.CookieJar()
    opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(cj))
    body = json.dumps({"password": password}).encode()
    req = urllib.request.Request(f"{BASE_URL}/api/login", data=body, method="POST")
    req.add_header("Content-Type", "application/json")
    try:
        with opener.open(req) as resp:
            resp.read()
    except urllib.error.HTTPError as e:
        print(f"Login failed: {e.code} {e.reason}")
        print(e.read().decode())
        sys.exit(1)
    return opener


def create_project(opener, title: str, topic: str, qtype: str, qid: str,
                   question: str, answer: str, why: str) -> dict | None:
    body = json.dumps({
        "title": title,
        "topic": topic,
        "type": qtype,
        "question_id": qid,
        "question": question,
        "answer": answer,
        "why": why,
    }).encode()
    req = urllib.request.Request(f"{BASE_URL}/api/projects", data=body, method="POST")
    req.add_header("Content-Type", "application/json")
    try:
        with opener.open(req) as resp:
            return json.loads(resp.read())
    except urllib.error.HTTPError as e:
        print(f"  ERROR {e.code}: {e.read().decode()}")
        return None


def main():
    with open(JSON_PATH) as f:
        data = json.load(f)

    admin_pass = os.environ.get("ADMIN_PASSWORD")
    if not admin_pass:
        admin_pass = input("Admin password: ")

    opener = login(admin_pass)
    print("Logged in.\n")

    created = 0
    skipped = 0
    errors = 0

    for q in data["questions"]:
        qid = q["id"]
        if qid < 9 or qid > 58:
            continue

        scenario = q["scenario"]
        qtype = SCENARIO_TO_TYPE.get(scenario)
        if qtype is None:
            print(f"Q{qid}: SKIP — unknown scenario: {scenario}")
            skipped += 1
            continue

        qnum = f"Q{qid:02d}"
        title = f"{qnum} {scenario}"

        answer_letter = q["answer"]
        answer_text = q["options"].get(answer_letter, "")
        full_answer = f"{answer_letter}: {answer_text}"

        rationale = q.get("answer_rationale", "")

        result = create_project(
            opener=opener,
            title=title,
            topic=scenario,
            qtype=qtype,
            qid=qnum,
            question=q["question"],
            answer=full_answer,
            why=rationale,
        )
        if result:
            print(f"Q{qid}: CREATED — {result.get('slug', '?')}")
            created += 1
        else:
            errors += 1

    print(f"\nDone: {created} created, {skipped} skipped, {errors} errors")


if __name__ == "__main__":
    main()
