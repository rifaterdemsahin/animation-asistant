# 14 — API: Canva Voiceover Endpoint (plain text)

> **Purpose:** Return the full 3-act voiceover script as clean plain text,
> ready to paste into Canva's AI voiceover / text-to-speech tool.

## Endpoint

```
GET /api/projects/{id}/script/voiceover
```

**No generation.** Reads existing `voiceover.txt` files only — zero cost, zero
LLM calls. If no script exists, returns 404 with a human-readable message.

## Response

**Status:** `200`
**Content-Type:** `text/plain; charset=utf-8`

```
Act 1: Problem
==============
In multi-agent AI systems, scale introduces a quiet but devastating bottleneck.
We begin our story in a structured four-panel comic strip...

Act 2: Solution
===============
In the central operations hub, our bright orange Coordinator agent receives
the massive outputs from the sub-agents...

Act 3: Lesson
=============
To solve this architectural bottleneck, we introduce a specialized intermediate
summarization agent, visualized as a dedicated purple processing unit...
```

### Rules

- **Plain text only** — no JSON, no HTML, no markdown
- Act headers use `Act N: Role` with underline separators (`====`)
- Blank line between acts
- Trailing newline at EOF
- If a voiceover.txt is empty/missing for an act, that act's section is omitted

### Error (404)

```
Content-Type: text/plain

No script found for project q11. Generate the script first.
```

## Usage

### One-liner (curl)

```bash
curl -b /tmp/cookies.txt http://localhost:8080/api/projects/q11/script/voiceover
```

### One-liner (save to file)

```bash
curl -b /tmp/cookies.txt http://localhost:8080/api/projects/q11/script/voiceover -o q11-voiceover.txt
```

### Browser bookmark

```
http://localhost:8080/api/projects/q11/script/voiceover
```

Opens as raw text in browser. Can be copied directly into Canva.

## Implementation

| File              | Change                                   |
|-------------------|------------------------------------------|
| `server/script.go` | New handler `serveVoiceover()` (GET)     |
| `server/app.go`    | Route `GET /api/projects/{slug}/script/voiceover` |
