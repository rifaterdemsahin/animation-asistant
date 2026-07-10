# Storage & Database

## Decision: Azure Blob Storage (No Relational DB)

This project uses **Azure Blob Storage** instead of a relational database. There is no PostgreSQL, MySQL, or Supabase — the data model is entirely blob/JSON based.

## Rationale

- All project data is hierarchical (project → act → files) and fits a blob store naturally
- No relational queries needed — all access is by project ID + path
- JSON manifests (`project.json`, `components.json`, `versions.json`) are read/written atomically
- Audio/image assets are large binaries best stored as blobs

## Storage Layout

### projects/ container
```
projects/
├── <slug>/
│   ├── project.json
│   ├── outline.json
│   ├── act-1-problem/
│   │   ├── script/act.md, beats.json, voiceover.txt, versions.json, vNN-*
│   │   ├── components/components.json, <slug>-<type>-NN.png
│   │   └── audio/narration.mp3, music.mp3, sfx-*.mp3
│   ├── act-2-solution/ (same structure)
│   ├── act-3-lesson/   (same structure)
│   └── storyboard/storyboard.json, storyboard.png, versions.json
```

### prompts/ container
```
prompts/
├── <projectId>/
│   └── <timestamp>-<act>-<step>.json
```

## Local Dev Fallback

When `AZURE_STORAGE_CONNECTION_STRING` is not set, data is stored in `./other/` with the same directory structure.
