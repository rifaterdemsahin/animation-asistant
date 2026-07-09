# 06 — Storage

## Backend Interface

The storage layer is abstracted behind a `Backend` interface (`server/storage/storage.go:21-31`):

```go
type Backend interface {
    Name() string                                                  // "local:<path>" or "azure:<container>"
    ReadProject(slug string) ([]byte, error)                      // <slug>/project.json
    WriteProject(slug string, data []byte) error                  // <slug>/project.json
    ListProjects() ([]string, error)                              // all project slugs
    Read(slug, relpath string) ([]byte, error)                    // <slug>/<relpath>
    Write(slug, relpath string, data []byte) error                // <slug>/<relpath>
    Delete(slug string) error                                     // delete entire project
    Exists(slug string) bool                                      // does slug/project.json exist?
    List(slug, prefix string) ([]string, error)                   // files under <slug>/<prefix>
}
```

## Implementation Selection

```go
func New(otherDir, connString, container string) (Backend, error) {
    _ = os.MkdirAll(otherDir, 0o755)
    if connString == "" {
        return &Local{root: otherDir}, nil        // Local filesystem
    }
    // Azure Blob client
    client, _ := azblob.NewClientFromConnectionString(connString, nil)
    client.CreateContainer(ctx, container, nil)   // auto-create, ignore AlreadyExists
    return &Azure{client: client, container: container}, nil
}
```

| Condition | Backend | Name |
|-----------|---------|------|
| `AZURE_STORAGE_CONNECTION_STRING` not set | `Local` (filesystem) | `local:./other` |
| `AZURE_STORAGE_CONNECTION_STRING` set | `Azure` (azblob SDK) | `azure:projects` |

## Local Backend

- Root directory: `OTHER_DIR` env var (default: `other/`)
- Project data: `other/<slug>/`
- File operations: standard `os.ReadFile`, `os.WriteFile`, `os.RemoveAll`
- Auto-creates directories on write via `os.MkdirAll`
- `ListProjects()` reads directory entries, filters by `project.json` existence
- `List()` uses `filepath.WalkDir` with prefix filtering

```
other/
├── .gitkeep
├── _prompts/                      # Editable prompt templates (local dev)
│   ├── outline.json
│   ├── script.json
│   ├── components.json
│   ├── audio.json
│   └── storyboard.json
├── <project-slug>/                # Project data
└── <project-slug>/                # ...
```

## Azure Backend

- Container: `AZURE_CONTAINER` env var (default: `"projects"`)
- Blob naming: `<slug>/<relpath>` — paths match the local filesystem layout
- Auto-creates container if it doesn't exist (ignores `AlreadyExists`)
- Uses `azblob` SDK: `UploadBuffer` for writes, `DownloadStream` for reads
- `Delete(slug)`: lists all blobs with prefix `<slug>/`, deletes each (iterative pager)
- `ListProjects()`: lists all blobs, filters those ending in `/project.json`, deduplicates
- `Exists(slug)`: attempts to read `<slug>/project.json`

```
Azure Blob Container: "projects"
├── <project-slug>/project.json
├── <project-slug>/outline.json
├── <project-slug>/prompts/<timestamp>-<act>-<step>.json
├── <project-slug>/act-1-problem/script/act.md
├── <project-slug>/act-1-problem/script/beats.json
├── <project-slug>/act-1-problem/components/components.json
├── <project-slug>/act-1-problem/components/<slug>-background-01.png
├── <project-slug>/act-1-problem/audio/narration.mp3
└── ...

Azure Blob Container: "prompts"
├── outline.json
├── script.json
├── components.json
├── audio.json
└── storyboard.json
```

## Prompt Store

Separate storage for editable prompt templates (`server/prompts.go`):

```go
type PromptStore interface {
    Name() string
    List() ([]PromptItem, error)
    Get(id string) (PromptItem, error)
    Set(id string, content string) error
    Reset(id string) error    // restore compiled default
}
```

- **Azure:** uses `AZURE_PROMPTS_CONTAINER` (default: `"prompts"`)
- **Local:** uses `OTHER_DIR/_prompts/` (default: `other/_prompts/`)
- **Fallback:** in-memory seeded with compiled Go defaults (edits don't persist)
- Auto-seeded on first write: if a prompt doesn't exist in the store, the compiled default is written

## Security

- Path traversal protection: `serveRaw()` rejects paths containing `..`
- No raw file access to `project.json` via storage endpoints — project CRUD goes through dedicated handlers
- Binary assets (images, audio) served through `GET /api/projects/{slug}/raw/` with auth
- Storage keys: `AZURE_STORAGE_CONNECTION_STRING` is an env var, never in source
- Key rotation: use `az storage account keys renew` via Azure CLI
