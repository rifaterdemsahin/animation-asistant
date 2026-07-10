#!/usr/bin/env python3
"""Batch-generate scripts for q22-q58 (skips missing q43)."""
import subprocess, json, sys, time

COOKIE = "/tmp/cookies.txt"
BASE = "http://localhost:8080"
LOGIN_PW = "Welcome.June.SH.9#"

def login():
    r = subprocess.run(["curl", "-s", "-c", COOKIE, "-X", "POST", f"{BASE}/api/login",
        "-H", "Content-Type: application/json", "-d", f'{{"password":"{LOGIN_PW}"}}'],
        capture_output=True, text=True)
    return r.returncode == 0

def generate(pid):
    r = subprocess.run(["curl", "-s", "-b", COOKIE, "-X", "POST",
        f"{BASE}/api/projects/{pid}/script/generate",
        "-H", "Content-Type: application/json", "-d", "{}"],
        capture_output=True, text=True, timeout=120)
    try:
        d = json.loads(r.stdout)
        if d.get("ok"):
            return True, d.get("phases", {})
        return False, d.get("message", r.stdout[:100])
    except:
        return False, r.stdout[:100]

login()
ids = [f"q{n}" for n in range(22, 59) if n != 43]  # q43 missing

done, failed = 0, 0
start = time.time()
for i, pid in enumerate(ids):
    ok, info = generate(pid)
    if ok:
        done += 1
        elapsed = time.time() - start
        rate = elapsed / (i + 1)
        remaining = rate * (len(ids) - i - 1)
        print(f"[{i+1}/{len(ids)}] {pid} OK  | {done} done, {int(remaining)}s remaining")
    else:
        failed += 1
        print(f"[{i+1}/{len(ids)}] {pid} FAIL: {info}")

total = time.time() - start
print(f"\nDone: {done}, Failed: {failed}, Time: {int(total)}s")
