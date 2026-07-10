# 12 — Checking Projects for Missing Scripts

## Formula (two-tier)

### Tier 1 — Status check (fast, from project.json)

```
∀ project ∈ Projects:
  hasScriptStatus(project) ⟺
    project.acts["act-1"].script == "done"   ∧
    project.acts["act-2"].script == "done"   ∧
    project.acts["act-3"].script == "done"
```

### Tier 2 — Script object check (authoritative, from storage files)

The **script object** is the actual generated content stored per act:

```
<slug>/
  <act-slug>/script/
    act.md          ← markdown script (narration + beats)
    beats.json      ← structured beats array
    voiceover.txt   ← narration text for TTS
    versions.json   ← version manifest
    v01-act.md, v01-beats.json, v01-voiceover.txt  ← versioned copies
```

The canonical check reads the script object files directly:

```
∀ project ∈ Projects, ∀ act ∈ {act-1, act-2, act-3}:
  hasActScript(project, act) ⟺
    exists( <slug>/<act-slug>/script/act.md )          ∧
    exists( <slug>/<act-slug>/script/beats.json )      ∧
    exists( <slug>/<act-slug>/script/voiceover.txt )   ∧
    size( <slug>/<act-slug>/script/act.md ) > 0

  hasScripts(project) ⟺ ∀ act: hasActScript(project, act)
```

## Script Object Structure

The generated script output is a JSON object with two fields, converted to
files by the Go handler at `server/script.go:153-176`:

```json
{
  "narration": "1-3 paragraphs of professional voiceover narration text",
  "beats": [
    {"id": "beat-1", "text": "one concrete, highly visualizable story beat"},
    {"id": "beat-2", "text": "next concrete story beat"}
  ]
}
```

| File | Content | Format |
|------|---------|--------|
| `act.md` | Markdown combining narration + beats | `# Act N — Role\n## Narration\n...\n## Beats\n- **beat-1**: ...` |
| `beats.json` | Raw JSON from AI (narration + beats array) | Pretty-printed JSON |
| `voiceover.txt` | Narration text only (for TTS pipeline) | Plain text |
| `versions.json` | Version manifest: `[{"id":N, "act":"act-N", "markdown":"vNN-act.md", ...}]` | JSON array |

## API

### List all projects with script object status

```bash
# Login
curl -c cookies.txt http://localhost:8080/api/login \
  -H 'Content-Type: application/json' \
  -d '{"password":"<ADMIN_PASSWORD>"}'

# Check status (Tier 1 — fast)
curl -b cookies.txt http://localhost:8080/api/projects | \
  jq '[.projects[] | {
    id: .project_id,
    title,
    status,
    a1: .acts["act-1"].script,
    a2: .acts["act-2"].script,
    a3: .acts["act-3"].script
  } | select(.a1 != "done" or .a2 != "done" or .a3 != "done")]'

# Check actual script object (Tier 2 — authoritative)
curl -b cookies.txt http://localhost:8080/api/projects/q1/script | \
  jq '{has_script: (.acts | length > 0), act_keys: (.acts | keys),
       has_voiceover: (.voiceover | length > 0),
       has_versions: (.versions | length > 0)}'

# Tier 2 for all projects: check if script files have content
for id in $(curl -s -b cookies.txt http://localhost:8080/api/projects | \
  jq -r '.projects[].project_id'); do
  scripts=$(curl -s -b cookies.txt "http://localhost:8080/api/projects/$id/script")
  has=$(echo "$scripts" | jq '.acts | length')
  [ "$has" -gt 0 ] && echo "$id: SCRIPTS EXIST ($has acts)" || echo "$id: MISSING"
done
```

## Code Path

### Tier 1 (status field)
1. `GET /api/projects` → `App.listProjects()` at `server/projects.go:373`
2. Reads `project.json` → `Acts` map → `ActStatus.Script` = `"pending"` | `"done"`
3. Set to `"done"` at `server/script.go:208` after successful generation + file writes

### Tier 2 (script object files)
1. `GET /api/projects/{slug}/script` → `App.getScript()` at `server/script.go:281`
2. Reads `<slug>/<act-slug>/script/act.md` from storage backend
3. Reads `<slug>/<act-slug>/script/voiceover.txt`
4. Reads `<slug>/<act-slug>/script/versions.json` → version history
5. Returns `{acts: {act-1: "...markdown..."}, voiceover: {act-1: "..."}, versions: {act-1: [...]}}`

## Results (snapshot 2026-07-10)

| Total projects | Have scripts (all 3 acts done) | Missing scripts |
|---|---|---|
| 53 | 3 (q6, q7, q8) | 50 |

Script object verification for projects with `script: "done"`:

| ID | act-1 file | act-2 file | act-3 file | voiceover files | versions |
|----|-----------|-----------|-----------|----------------|----------|
| q6 | ✓ 1.5KB | ✓ 1.6KB | ✓ 1.4KB | ✓ (3) | ✓ (v01 × 3) |
| q7 | ✓ 1.5KB | ✓ 1.6KB | ✓ 1.4KB | ✓ (3) | ✓ (v01 × 3) |
| q8 | ✓ 1.5KB | ✓ 1.6KB | ✓ 1.4KB | ✓ (3) | ✓ (v01 × 3) |
| q1 | ✗ | ✗ | ✗ | ✗ | ✗ |

Projects missing scripts:

| Project ID | Type | Status |
|---|---|---|
| q1 | multi-agent-research | inprogress |
| q09–q15 | multi-agent-research | backlog |
| q16–q30 | code-generation | backlog |
| q31–q45 | customer-resolution-agent | backlog |
| q46–q58 | claude-ci | backlog |

Note: q1 is `inprogress` but has **no** script objects — all 3 acts have
neither the status flag nor any script files in storage.

## Generating Scripts

```bash
# Via Media Manager UI
open -a "Google Chrome" "http://localhost:8080/pages/media-manager.html?project=q1"

# Via API (triggers full script pipeline: generation + storyboard context)
curl -b cookies.txt -X POST http://localhost:8080/api/projects/q1/script
```

The generation pipeline includes storyboard context via `generateAct()` at
`server/script.go:217-257` — storyboard image prompts from completed
storyboard runs are prepended to the user prompt so narration matches
visuals. See [07-pipeline.md](07-pipeline.md) for the full flow.
