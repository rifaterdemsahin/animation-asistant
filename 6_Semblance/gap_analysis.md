# Gap Analysis

## Known Gaps

| Gap | Impact | Priority |
|-----|--------|----------|
| **No video rendering** | Cannot compose components + audio into a single MP4 per act. Canva handles final post-production, but an automated render pipeline would streamline the workflow. | Medium |
| **No Canva deep-link integration** | Users must manually download assets and upload to Canva. Direct push to Canva via API would eliminate friction. | Low |
| **No full-text search** | No way to search across project titles, topics, scripts. Requires browsing each project individually. | Low |
| **No multi-tenant support** | Single-user tool. Auth is a shared password — no user accounts, roles, or permissions. | Low |
| **No per-call retry/backoff** | Generation failure aborts the batch mid-way. Acts are independent so partial progress is kept, but handler returns 500. | Medium |
| **No mobile-responsive layout** | UI is desktop-focused. Not optimized for mobile/tablet. | Low |
| **No UI tests** | Go unit tests exist but no Playwright/browser tests for frontend. | Medium |
