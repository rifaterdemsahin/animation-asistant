# 7_Test — Test Reports

> **Status:** v1 — page-by-page error scan of the running app
> **App:** https://animation-assistant.fly.dev/  ·  Local: http://localhost:8080

This directory holds test/verification reports for the Animation Assistant.
Each report documents a specific pass of checks against the live codebase and
the running server.

## Document Index

| # | Document | Covers |
|---|----------|--------|
| 1 | [Page Error Scan](01-page-error-scan.md) | Headless-Chrome sweep of every page (console, network, interactions, project matrix) |

## Quick Reference

```
7_Test/
├── README.md                 # This index
└── 01-page-error-scan.md     # Full-surface error scan of all 14 pages
```

## How to reproduce

The reports are reproducible from a running local server:

```bash
go run ./server                                            # http://localhost:8080
curl -c cookies.txt -X POST http://localhost:8080/api/login \
  -H 'Content-Type: application/json' \
  -d '{"password":"<ADMIN_PASSWORD>"}'
# then drive the pages with a headless browser (see 01-page-error-scan.md)
```
