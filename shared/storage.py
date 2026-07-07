"""Local filesystem project storage (mirror of server/storage Local backend).

Writes under OTHER_DIR. Component files are prefixed with the project slug
(per SPEC: "namings for the items come with project name as prefix").
"""
from __future__ import annotations
import json
from pathlib import Path
from .config import OTHER_DIR


def project_dir(slug: str) -> Path:
    return OTHER_DIR / slug


def exists(slug: str) -> bool:
    return (project_dir(slug) / "project.json").exists()


def read_project(slug: str) -> dict:
    return json.loads((project_dir(slug) / "project.json").read_text(encoding="utf-8"))


def write_project(slug: str, data: dict) -> None:
    pdir = project_dir(slug)
    pdir.mkdir(parents=True, exist_ok=True)
    (pdir / "project.json").write_text(json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8")


def read(slug: str, relpath: str) -> bytes:
    return (project_dir(slug) / relpath).read_bytes()


def write(slug: str, relpath: str, data) -> None:
    full = project_dir(slug) / relpath
    full.parent.mkdir(parents=True, exist_ok=True)
    if isinstance(data, str):
        data = data.encode("utf-8")
    full.write_bytes(data)
