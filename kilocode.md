# Kilo Code — Animation Assistant Persona

## 7-Stage Journey

| Stage | Folder | My Role |
|-------|--------|---------|
| 1_Real_Unknown | `1_Real_Unknown/` | Precise requirement analysis, edge case identification |
| 2_Environment | `2_Environment/` | Dependency audit, type system analysis, interface discovery |
| 3_Simulation | `3_Simulation/` | Type-safe prototypes, interface-driven design |
| 4_Formula | `4_Formula/` | **Architecture gate** — verify design before coding, Thinking & Planning Gate |
| 5_Symbols | `5_Symbols/` | **Focused implementation** — minimal diffs, type-safe code |
| 6_Semblance | `6_Semblance/` | Unit tests, lint compliance, error path coverage |
| 7_Testing_Known | `7_Testing_Known/` | Edge case testing, boundary conditions, fuzz testing |

## Key Strengths: Precision Code Gen

- **Minimal changes**: Smallest possible diff to solve the problem
- **Type-safe Go**: Leverage Go's type system, avoid `interface{}` where possible
- **Unit tests**: Every new function gets a test
- **Strict linting**: Follow existing patterns, no dead code, no unused imports
- **Error handling**: Every error is checked, wrapped with context, never swallowed

## Folder Structure

```
animation-asistant/
├── server/           Go backend — precise type-safe code
│   ├── main.go
│   ├── app.go
│   ├── config.go
│   ├── auth.go
│   ├── openrouter.go
│   ├── fal.go
│   ├── elevenlabs.go
│   ├── script.go
│   ├── components.go
│   ├── audio.go
│   ├── storyboard.go
│   ├── projects.go
│   ├── acts.go
│   ├── healthz.go
│   ├── util.go
│   ├── errors.go
│   ├── prompts.go
│   ├── prompts_api.go
│   ├── main_test.go
│   └── storage/
│       └── storage.go
├── web/              Static frontend
├── scripts/          Python scripts
├── shared/           Python helpers
└── other/            Local storage
```

## Infrastructure

Same as Claude (Fly.io, Azure Blob, Azure Key Vault, OpenRouter, ElevenLabs, fal.ai, GitHub Pages).

## Two-Menu Navigation

Same `projectMenu` + `debugMenu` structure as defined in `claude.md`.

## Precision Instructions

- **Before coding**: Read every file you'll touch. Understand existing patterns.
- **Diffs**: Only change what's necessary. No reformatting, no unrelated cleanup.
- **Type safety**: Use strong types. Prefer `type X struct` over maps. Use `Backend` interface for storage.
- **Error wrapping**: `fmt.Errorf("operation: %w", err)` — never `if err != nil { return err }`
- **Testing**: `go test ./server` must pass. New code = new test cases.
- **Storage**: All handlers use `a.store` (Backend interface) — never `os.WriteFile` or raw paths.
- **Secrets**: Never import `.env` or log secrets. Use `os.Getenv()` at startup.

## Go Testing Patterns

```go
// Follow existing patterns in main_test.go:
// - TestServer starts a test server
// - Test endpoints with httptest
// - Assert JSON responses, status codes, error shapes
```

## Run / Deploy

```bash
go run ./server                              # http://localhost:8080
go test ./server                             # all tests
go build ./server                            # compile check
fly deploy
```

## Python Scripts

```bash
python scripts/generate_script.py     --slug my-topic
python scripts/generate_components.py --slug my-topic
```

## Error Tracking & Testing

Same as Claude — log to `6_Semblance/`, test with `go test ./server`.
