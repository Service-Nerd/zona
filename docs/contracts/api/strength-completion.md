# API Contract — /api/strength/completion

**Item:** `STRENGTH-ENGINE-01` Phase 2 (Design Board `STRENGTH-APP-01` E). **Route:** `app/api/strength/completion/route.ts`.
**Auth:** Bearer token. **Gate:** `strengthGate` (`lib/strength-bridge/routeGate.ts`) — the same server-side release
gate as `/api/strength/plan`: 401 without a user, **404** without release access. **Tier:** PAID, admin-only until release.

## POST

```json
{ "date": "YYYY-MM-DD", "status": "done" | "skipped" | null, "started_at"?: "ISO", "ended_at"?: "ISO" }
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

## Session times (STRENGTH-GUIDED-SESSION-01, 2026-10-29)

A guided session sends `started_at` and `ended_at` with `done`. Times that cannot be a session (one without the
other, `ended_at` before `started_at`, over four hours apart, or sent with `skipped`) are **dropped and the completion
is still saved**: a refusal would strand the runner on the end page over a clock detail they cannot see (code review
2026-10-29). A `done` without times sends no time columns. **200** echoes the times when they were kept.
Columns added by `supabase/migrations/20261029_strength_session_times_and_reps.sql` (a check keeps them paired). Before
it is applied the write fails with PGRST204 / 42703: the route records `strength_save_failed` (`where:
'completion_times_column'`) and saves the completion without its times. Gate: `lib/api/strengthCompletionRoute.test.ts`.
