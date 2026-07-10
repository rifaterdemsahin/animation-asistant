# Fly.io Deployment — Animation Assistant

## App: `animation-assistant`

**Live URL:** https://animation-assistant.fly.dev/  
**Region:** `iad` (Ashburn, VA)  
**Primary Region:** `iad`

## Architecture

The Fly.io deployment runs a **single machine** with a **multi-stage Docker image**:

1. **Stage 1 (builder):** `golang:1.26` — compiles the Go backend
2. **Stage 2 (runtime):** `python:3.12-slim` — runs the Go binary + provides Python for scripts

The Go binary serves both the static web frontend and the REST API on port 8080.

## Configuration (`fly.toml`)

```toml
app = "animation-assistant"
primary_region = "iad"

[http_service]
  internal_port = 8080
  force_https = true
  auto_stop_machines = true
  auto_start_machines = true
  min_machines_running = 0

[[vm]]
  memory = "512mb"
  cpu_kind = "shared"
  cpus = 1
```

- Machines auto-stop when idle and auto-start on request (zero-to-N scale).
- 512 MB RAM is sufficient for the Go server + Python runtime.
- HTTPS enforced by Fly.io edge proxy.

## Dockerfile

```dockerfile
FROM golang:1.26 AS build
WORKDIR /src
COPY go.mod ./
RUN go mod download
COPY . .
ARG BUILD_COMMIT=unknown
RUN CGO_ENABLED=0 go build -ldflags="-X main.buildCommit=${BUILD_COMMIT}" -o /out/app ./server

FROM python:3.12-slim
WORKDIR /app
COPY --from=build /out/app /app/app
COPY web /app/web
COPY scripts /app/scripts
COPY shared /app/shared
COPY requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r requirements.txt
RUN mkdir -p /app/other
ENV OTHER_DIR=/app/other
EXPOSE 8080
CMD ["/app/app"]
```

The `BUILD_COMMIT` arg embeds the git SHA into the binary (displayed in the footer).

## Secrets Management

Secrets are set via `fly secrets` (never in the Docker image):

```bash
fly secrets set \
  ADMIN_PASSWORD='<value>' \
  OPENROUTER_API_KEY='<value>' \
  OPENROUTER_MODEL='google/gemini-3.5-flash' \
  STORYBOARD_IMAGE_MODEL='google/gemini-3.1-flash-image' \
  AZURE_STORAGE_CONNECTION_STRING='<value>' \
  AZURE_CONTAINER='projects' \
  AZURE_PROMPTS_CONTAINER='prompts' \
  TTS_API_KEY='<value>' \
  TTS_VOICE='George' \
  FAL_KEY='<value>'
```

### Critical Gotcha

`fly secrets import` treats `#` as a comment delimiter. If any secret value contains `#`, it will be truncated. Always use `fly secrets set KEY='value'` (with single quotes) for values containing `#`, or replace `#` with `!` in the secret.

## Deploy

```bash
fly deploy --build-arg BUILD_COMMIT=$(git rev-parse --short HEAD)
```

The `--build-arg` passes the short commit SHA so the app footer shows a clickable commit link.

## Monitoring

- **Logs:** `fly logs`
- **SSH:** `fly ssh console` (debug the running machine)
- **Health:** `GET /healthz` (reports backend status: storage type, OpenRouter key presence, Azure connectivity)

## Rollback

```bash
fly deploy --image <previous-image-id>
```

No StatefulSet — data persists in Azure Blob Storage, not on the Fly machine.
