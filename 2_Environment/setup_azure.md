# Azure Key Vault Setup — Animation Assistant

## Key Vault: `dp-kv-deliverypilot`

All secrets for the Animation Assistant project are stored in the **dp-kv-deliverypilot** Key Vault. This vault is the single source of truth for API keys, connection strings, and credentials.

## Secrets Stored

| Secret Name | Env Variable | Purpose |
|------------|-------------|---------|
| `AdminPassword` | `ADMIN_PASSWORD` | Web app login |
| `OPENROUTER-API-KEY` | `OPENROUTER_API_KEY` | OpenRouter AI access (Gemini models). Comma-separated for rotation. |
| `AZURE-STORAGE-CONN-STR-AA` | `AZURE_STORAGE_CONNECTION_STRING` | Azure Blob Storage access |
| `ELEVEN-LABS-API-KEY` | `TTS_API_KEY` | ElevenLabs TTS API key |
| `FAL-KEY` | `FAL_KEY` | fal.ai music + SFX API key |

## Authentication

### Local Development (Azure CLI)

```bash
az login
az account show   # verify correct tenant/subscription

# Verify Key Vault access
az keyvault secret list --vault-name dp-kv-deliverypilot --query "[].name"
```

### Pull Secrets to `.env`

```bash
KV=dp-kv-deliverypilot
get(){ az keyvault secret show --vault-name "$KV" --name "$1" --query value -o tsv; }
echo "ADMIN_PASSWORD='$(get AdminPassword)'" > .env
echo "OPENROUTER_API_KEY='$(get OPENROUTER-API-KEY)'" >> .env
echo "AZURE_STORAGE_CONNECTION_STRING='$(get AZURE-STORAGE-CONN-STR-AA)'" >> .env
echo "TTS_API_KEY='$(get ELEVEN-LABS-API-KEY)'" >> .env
echo "FAL_KEY='$(get FAL-KEY)'" >> .env
```

> ⚠️ Always single-quote values in `.env` — Azure connection strings contain `;` and `=`.
> If `AdminPassword` contains `#`, replace with `!` to avoid fly secrets truncation.

## Deployed Environment (Fly.io)

```bash
fly secrets set \
  ADMIN_PASSWORD='<value>' \
  OPENROUTER_API_KEY='<value>' \
  AZURE_STORAGE_CONNECTION_STRING='<value>' \
  TTS_API_KEY='<value>' \
  FAL_KEY='<value>'
```

Alternatively, import from a secrets file:

```bash
# secrets.env — each line KEY=value, single-quoted
fly secrets import < secrets.env
```

## Service Principal for GitHub Actions

GitHub Actions needs a service principal to access Key Vault during CI/CD.

### Create Service Principal

```bash
az ad sp create-for-rbac \
  --name "animation-assistant-gha" \
  --role "Key Vault Secrets User" \
  --scopes "/subscriptions/<subscription-id>/resourceGroups/animation-asistant/providers/Microsoft.KeyVault/vaults/dp-kv-deliverypilot" \
  --sdk-auth
```

This outputs a JSON object. Add it as a **GitHub secret** named `AZURE_CREDENTIALS` in the repository settings.

### Grant Key Vault Access

```bash
az keyvault set-policy \
  --name dp-kv-deliverypilot \
  --spn <service-principal-client-id> \
  --secret-permissions get list
```

### Azure Storage Account

- **Storage account name:** `animationasistant`
- **Resource group:** `animation-asistant`
- **Containers:** `projects` (project data), `prompts` (editable prompt templates)
- **Portal deep-link:** [Azure Portal — animationasistant](https://portal.azure.com/#@/resource/subscriptions/<sub>/resourceGroups/animation-asistant/providers/Microsoft.Storage/storageAccounts/animationasistant/overview)

To rotate the storage key:

```bash
az storage account keys renew -g animation-asistant -n animationasistant --key key1
```

Then update the `AZURE-STORAGE-CONN-STR-AA` secret in Key Vault and redeploy secrets to fly.io.
