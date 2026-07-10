#!/usr/bin/env python3
"""Final cleanup: delete remaining bad/garbage projects (q1-q9, q43)."""

import json, urllib.request, urllib.error, http.cookiejar, os, time

BASE_URL = "http://localhost:8080"
PASSWORD = os.environ.get("ADMIN_PASSWORD", "Welcome.June.SH.9#")

def login():
    cj = http.cookiejar.CookieJar()
    opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(cj))
    body = json.dumps({"password": PASSWORD}).encode()
    req = urllib.request.Request(f"{BASE_URL}/api/login", data=body, method="POST")
    req.add_header("Content-Type", "application/json")
    with opener.open(req): pass
    return opener

def get_projects(opener):
    req = urllib.request.Request(f"{BASE_URL}/api/projects")
    with opener.open(req) as resp:
        return json.loads(resp.read())["projects"]

def delete_project(opener, slug):
    req = urllib.request.Request(f"{BASE_URL}/api/projects/{slug}", method="DELETE")
    try:
        with opener.open(req) as resp:
            return True
    except urllib.error.HTTPError as e:
        print(f"  Delete {slug}: ERROR {e.code}")
        return False

def main():
    opener = login()
    projects = get_projects(opener)

    # Find garbage projects: lowercase qid (q1-q9, q43) with no answer data
    garbage_slugs = []
    for p in projects:
        qid = p.get("question_id", "")
        if not qid.lower().startswith("q"):
            continue
        # Bad projects: lowercase qid + no answer data
        if not p.get("answer", "").strip():
            garbage_slugs.append(p["slug"])

    print(f"Found {len(garbage_slugs)} garbage projects to delete:")
    for slug in garbage_slugs:
        print(f"  {slug}")
    print()

    deleted = 0
    for slug in garbage_slugs:
        if delete_project(opener, slug):
            print(f"  DELETED: {slug}")
            deleted += 1
        time.sleep(0.15)

    print(f"\nDeleted: {deleted}/{len(garbage_slugs)}")

    # Show final clean state
    projects = get_projects(opener)
    q_good = sorted(
        [p for p in projects if p.get("question_id", "").startswith("Q")],
        key=lambda p: int(p["question_id"].replace("Q", "").lstrip("0"))
    )
    print(f"\nFinal clean state: {len(q_good)} exam projects")
    for p in q_good:
        print(f"  {p['question_id']}: \"{p['title']}\"  ({p['slug']})")

if __name__ == "__main__":
    main()
