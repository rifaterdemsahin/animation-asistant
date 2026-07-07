#!/usr/bin/env python3
"""Standalone CLI: generate outline + per-act scripts for a project.

Mirrors the Go backend's generator for local/CLI use. Writes under ./other
(local storage fallback).

Usage:
  # create a project first (slug auto-derived from title)
  python scripts/generate_script.py create "Why sleep matters" --topic "..." --component-type explainer

  # generate outline
  python scripts/generate_script.py outline --slug why-sleep-matters

  # generate all 3 act scripts
  python scripts/generate_script.py script --slug why-sleep-matters

  # generate a single act
  python scripts/generate_script.py script --slug why-sleep-matters --act 1
"""
from __future__ import annotations
import argparse
import sys
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from shared import storage  # noqa: E402
from shared.acts import ACTS  # noqa: E402
from shared.scriptgen import generate_outline, generate_script  # noqa: E402
from shared.openrouter import OpenRouterError  # noqa: E402


def _slugify(title: str) -> str:
    out = "".join(c if c.isalnum() else "-" for c in title.lower()).strip("-")
    return out or "project"


def _unique_slug(title: str) -> str:
    base = _slugify(title)
    if not storage.exists(base):
        return base
    i = 2
    while storage.exists(f"{base}-{i}"):
        i += 1
    return f"{base}-{i}"


def cmd_create(args):
    slug = _unique_slug(args.title)
    now = datetime.now(timezone.utc).isoformat(timespec="seconds")
    project = {
        "slug": slug,
        "title": args.title,
        "topic": args.topic or "",
        "component_type": args.component_type or "explainer",
        "canva_link": "",
        "status": "created",
        "created_at": now,
        "updated_at": now,
        "acts": {a["key"]: {"role": a["role"], "slug": a["slug"],
                            "outline": "pending", "script": "pending",
                            "components": "pending", "audio": "pending"} for a in ACTS},
    }
    storage.write_project(slug, project)
    print(f"created: {slug}")


def cmd_outline(args):
    try:
        obj = generate_outline(args.slug)
    except OpenRouterError as e:
        print(f"ERROR: {e}", file=sys.stderr); sys.exit(1)
    print(f"outline generated for {args.slug}: {obj.get('title','')}")


def cmd_script(args):
    acts = None
    if args.act and args.act != "all":
        acts = [f"act-{args.act}"]
    try:
        results = generate_script(args.slug, acts=acts)
    except OpenRouterError as e:
        print(f"ERROR: {e}", file=sys.stderr); sys.exit(1)
    print(f"script generated for {args.slug}: {list(results.keys())}")


def main():
    ap = argparse.ArgumentParser(description="Animation Assistant local script generator")
    sub = ap.add_subparsers(dest="cmd", required=True)

    c = sub.add_parser("create", help="create a project")
    c.add_argument("title")
    c.add_argument("--topic", default="")
    c.add_argument("--component-type", dest="component_type", default="explainer")
    c.set_defaults(func=cmd_create)

    o = sub.add_parser("outline", help="generate the project outline")
    o.add_argument("--slug", required=True)
    o.set_defaults(func=cmd_outline)

    s = sub.add_parser("script", help="generate act script(s)")
    s.add_argument("--slug", required=True)
    s.add_argument("--act", choices=["1", "2", "3", "all"], default="all")
    s.set_defaults(func=cmd_script)

    args = ap.parse_args()
    args.func(args)


if __name__ == "__main__":
    main()
