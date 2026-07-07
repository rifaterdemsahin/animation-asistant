#!/usr/bin/env python3
"""Local CLI: assemble the 3-act storyboard (+ infographic png).

  python scripts/generate_storyboard.py --slug my-topic
"""
from __future__ import annotations
import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from shared.storyboard import generate_storyboard  # noqa: E402
from shared.openrouter import OpenRouterError  # noqa: E402


def main():
    ap = argparse.ArgumentParser(description="Generate the storyboard")
    ap.add_argument("--slug", required=True)
    args = ap.parse_args()
    try:
        sb = generate_storyboard(args.slug)
    except OpenRouterError as e:
        print(f"ERROR: {e}", file=sys.stderr)
        sys.exit(1)
    print("storyboard generated; acts:", list((sb.get("acts") or {}).keys()))


if __name__ == "__main__":
    main()
