"""Fixed three-act structure (mirror of server/acts.go)."""
from __future__ import annotations

ACTS = [
    {"key": "act-1", "slug": "act-1-problem", "role": "problem",
     "title": "Act 1 — Problem",
     "purpose": "Set up the world and the problem/pain the audience feels."},
    {"key": "act-2", "slug": "act-2-solution", "role": "solution",
     "title": "Act 2 — Solution",
     "purpose": "Introduce the solution; show how the problem is resolved."},
    {"key": "act-3", "slug": "act-3-lesson", "role": "lesson",
     "title": "Act 3 — Lesson",
     "purpose": "The takeaway / moral / insight the audience leaves with."},
]
ACT_BY_KEY = {a["key"]: a for a in ACTS}
