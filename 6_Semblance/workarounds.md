# Active Workarounds

## `other/` Local Storage Fallback

When `AZURE_STORAGE_CONNECTION_STRING` is not set (dev environment), data is stored in `./other/` with the same directory structure as Azure Blob. This allows development without Azure connectivity.

- **Location:** `./other/` (gitignored)
- **Trigger:** Automatic — selected when connection string env var is absent
- **Limitation:** Not accessible from deployed fly.io instance (which uses Azure)

## `compare_pro_vs_flash/` Model Comparison

Side-by-side image comparison for storyboard model evaluation:
- Pro (`google/gemini-3-pro-image`) vs Flash (`google/gemini-3.1-flash-image`)
- 3 acts × 2 models = 6 images
- Used to validate that Flash is sufficient quality for storyboard generation at ~55% cost savings

## Multi-Key OpenRouter Rotation

Up to 5 comma-separated API keys in `OPENROUTER_API_KEY`. Client rotates on 401/402/429. Workaround for token expiration and usage limits without manual intervention.
