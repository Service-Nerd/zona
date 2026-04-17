# Contract — Plan Fetch (GitHub Gist)

**Authority**: This document defines the contract for fetching the training plan JSON. There is no API route — the fetch happens directly in `DashboardClient` on mount.

---

## Fetch Details

```
URL:     https://gist.githubusercontent.com/Service-Nerd/efec07a87f65494f0e078a1ccb136100/raw/rts_plan.json
Method:  GET
Cache:   cache: 'no-store'  ← required, non-negotiable
Auth:    None (public Gist)
```

## Response

On success: a `Plan` JSON object matching the schema in `docs/canonical/plan-schema.md`.

On failure: `DashboardClient` must surface a visible error state — not a console-only log.

## Rules

- `cache: 'no-store'` is mandatory. Removing it causes stale plan data across sessions.
- The Gist URL is the only authoritative plan source for the current architecture. Future: Supabase plans table.
- The fetched JSON must be validated against the `Plan` interface before use. If validation fails, surface an error state.
- The plan is fetched client-side in `DashboardClient`. No server-side plan API route exists.
