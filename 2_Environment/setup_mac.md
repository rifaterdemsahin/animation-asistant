# macOS Setup — Animation Assistant

## Prerequisites

| Tool | Version | Install |
|------|---------|---------|
| Go | 1.26 | `brew install go` |
| Python | 3.12 | `brew install python@3.12` |
| Azure CLI | Latest | `brew install azure-cli` |
| flyctl | Latest | `brew install flyctl` |
| Docker | Latest | [Docker Desktop for Mac](https://docs.docker.com/desktop/setup/install/mac-install/) |

## 1. Clone the Repository

```bash
git clone https://github.com/rifaterdemsahin/animation-asistant.git
cd animation-asistant
```

## 2. Set Up Go

```bash
go version    # should show go 1.26.x
go mod download
```

Test compilation:

```bash
go build ./server/...
```

## 3. Set Up Python

```bash
python3.12 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

## 4. Authenticate Azure CLI

```bash
az login
az account show   # verify you're in the right tenant
```

Pull secrets from Key Vault into `.env`:

```bash
KV=dp-kv-deliverypilot
get(){ az keyvault secret show --vault-name "$KV" --name "$1" --query value -o tsv; }
echo "ADMIN_PASSWORD='$(get AdminPassword)'" > .env
echo "OPENROUTER_API_KEY='$(get OPENROUTER-API-KEY)'" >> .env
echo "AZURE_STORAGE_CONNECTION_STRING='$(get AZURE-STORAGE-CONN-STR-AA)'" >> .env
echo "TTS_API_KEY='$(get ELEVEN-LABS-API-KEY)'" >> .env
echo "FAL_KEY='$(get FAL-KEY)'" >> .env
```

> ⚠️ If any value contains `#`, replace it with `!` — fly secrets treats `#` as comment delimiter.

## 5. Run Locally

```bash
go run ./server
```

Open in Chrome:

```bash
open -a "Google Chrome" "http://localhost:8080"
```

Login at `/pages/login.html` with the `ADMIN_PASSWORD` from `.env`.

## 6. Deploy to Fly.io

```bash
fly auth whoami        # verify authenticated
fly deploy
```

## 7. Python Scripts (Local AI Agent Generation)

```bash
source .venv/bin/activate
python scripts/generate_script.py create "My Topic" --topic "..."
python scripts/generate_script.py outline --slug my-topic
python scripts/generate_script.py script  --slug my-topic
python scripts/generate_components.py --slug my-topic
python scripts/generate_audio.py      --slug my-topic
python scripts/generate_storyboard.py --slug my-topic
```

Python scripts write to `./other/` (local storage fallback). For Azure storage, set `AZURE_STORAGE_CONNECTION_STRING` in `.env`.
