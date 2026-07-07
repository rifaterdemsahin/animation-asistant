#!/usr/bin/env python3
"""Local CLI: generate per-act narration audio (ElevenLabs).

  python scripts/generate_audio.py --slug my-topic          # all acts
  python scripts/generate_audio.py --slug my-topic --act 1
"""
from __future__ import annotations
import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from shared.audio import generate_audio  # noqa: E402
from shared.elevenlabs import TTSError  # noqa: E402
from shared.openrouter import OpenRouterError  # noqa: E402


def main():
    ap = argparse.ArgumentParser(description="Generate narration audio")
    ap.add_argument("--slug", required=True)
    ap.add_argument("--act", choices=["1", "2", "3", "all"], default="all")
    args = ap.parse_args()

    acts = None if args.act == "all" else [f"act-{args.act}"]
    try:
        out = generate_audio(args.slug, acts=acts)
    except (TTSError, OpenRouterError) as e:
        print(f"ERROR: {e}", file=sys.stderr)
        sys.exit(1)
    for key, rel in out.items():
        print(f"{key}: {rel}")


if __name__ == "__main__":
    main()
