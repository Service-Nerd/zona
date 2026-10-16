# API Contract — /api/strength/completion

**Item:** `STRENGTH-ENGINE-01` Phase 2 (Design Board `STRENGTH-APP-01` E). **Route:** `app/api/strength/completion/route.ts`.
**Auth:** Bearer token. **Gate:** `strengthGate` (`lib/strength-bridge/routeGate.ts`) — the same server-side release
gate as `/api/strength/plan`: 401 without a user, **404** without release access. **Tier:** PAID, admin-only until release.

## POST

```json
{ "date": "YYYY-MM-DD", "status": "done" | "skipped" | null }
```

`null` is **undo** (the row is deleted). **Done or skipped only**: the board ruled out RPE and per-set logging
until Phase 4 reads them. Body capped at 512 bytes. The date must be a real calendar date **on which the runner's
stored strength plan holds a session**; any other date is 404 and nothing is written.

**200** `{ date, status }`.

| Status | When | Written? |
|---|---|---|
| 401 / 404 | gate | no |
| 413 / 400 | body too large / not JSON | no |
| 422 | invalid date or status | no |
| 404 | no strength session on that date | no |
| 500 | plan read or write failed (`strength_save_failed`, `where: 'completion'`) | no |

## Storage

`strength_completions (user_id → auth.users ON DELETE CASCADE, session_date, status 'done'|'skipped', updated_at)`,
PK `(user_id, session_date)`, own-row RLS. Migration `supabase/migrations/20261017_strength_completions.sql`.
Read back by `GET /api/strength/plan` as `completions: { [date]: status }`.
