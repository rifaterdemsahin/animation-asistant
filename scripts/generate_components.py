#!/usr/bin/env python3
"""Local CLI: generate typed components for a project.

  python scripts/generate_components.py --slug my-topic                 # all acts, default types
  python scripts/generate_components.py --slug my-topic --act 1
  python scripts/generate_components.py --slug my-topic --types background,infographic
"""
from __future__ import annotations
import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from shared.components import generate_components  # noqa: E402
from shared.openrouter import OpenRouterError  # noqa: E402


def main():
    ap = argparse.ArgumentParser(description="Generate typed component images")
    ap.add_argument("--slug", required=True)
    ap.add_argument("--act", choices=["1", "2", "3", "all"], default="all")
    ap.add_argument("--types", default="", help="comma-separated, e.g. background,infographic")
    args = ap.parse_args()

    acts = None if args.act == "all" else [f"act-{args.act}"]
    types = [t.strip() for t in args.types.split(",") if t.strip()] or None
    try:
        manifest = generate_components(args.slug, acts=acts, types=types)
    except OpenRouterError as e:
        print(f"ERROR: {e}", file=sys.stderr)
        sys.exit(1)
    for key, items in manifest.items():
        print(f"{key}: {len(items)} components ({', '.join(c['type'] for c in items)})")


if __name__ == "__main__":
    main()
