# Supabase — Animation Assistant

## Status: Not Currently Used

Supabase is **not integrated** in the Animation Assistant project. There is no Supabase client, database connection, or configuration in any part of the codebase (Go backend, Python scripts, or web frontend).

## Why Not?

The project uses **Azure Blob Storage** as its primary data store (project data, generated assets, prompt audit trail) and **Azure Key Vault** for secrets management. No relational database or real-time backend is needed — all project state is stored as JSON files in blob storage.

## Future Possibilities

If the project later needs:
- **User accounts / multi-tenant auth** — Supabase Auth could replace the current single-admin cookie auth
- **Real-time collaboration** — Supabase Realtime could sync project state across browsers
- **Relational queries** — Supabase PostgreSQL could store structured metadata (project list, token usage, generation stats) with blob storage remaining for large assets

For now, these needs are not in scope. See the [Backlog in SPEC.md](../4_Formula/SPEC.md#15-backlog-) for planned features.
