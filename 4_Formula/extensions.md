# Required Extensions & Tools

## VS Code Extensions

| Extension | Purpose |
|-----------|---------|
| Go | Language support, debugging, linting for `server/` |
| Python | Language support, debugging for `scripts/` and `shared/` |
| Mermaid Markdown Preview | Visualize architecture diagrams in markdown |

## CLI Tools

| Tool | Purpose | Required For |
|------|---------|-------------|
| go | Compile and run Go backend | `go run ./server` |
| python3 | Run Python generation scripts | `scripts/*.py`, `shared/` |
| az | Azure CLI — pull secrets from Key Vault | `az keyvault secret show` |
| flyctl | Deploy to fly.io | `fly deploy`, `fly secrets` |
| docker | Container build (used by flyctl) | `fly deploy` |
