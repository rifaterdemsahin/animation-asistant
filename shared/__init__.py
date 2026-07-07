"""Shared helpers for the local Python generation scripts.

NOTE: The Go backend (server/) is the canonical generator used by the web UI.
These Python helpers mirror that logic for standalone CLI use / local testing,
writing to the same local on-disk layout under other/. See risks.md for the
duplication trade-off.
"""
