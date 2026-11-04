# API Contract — /api/me/today-heartbeat

**Method:** POST
**Auth:** Supabase session cookie (`getUserFromRequest`). Returns 401 otherwise.
**Caller:** `DashboardClient` — fires fire-and-forget whenever the active screen becomes `today` (HOOK-01).

## Request body

Empty.

## Response — 200

```json
{ "ok": true }
```

## Error responses

| Status | Condition |
|--------|-----------|
| 401 | No authenticated user |
| 500 | `user_settings` update failed — now also covers the profile back-fill, which is no longer fire-and-forget |

## Behaviour

Writes `user_settings.last_today_open_at = now()` for the authenticated user. Used by `/api/push/send-daily` to suppress the morning push when the runner has already opened the app within the last 30 minutes.

### Profile back-fill (PROFILE-NAME-WRITE-01, 2026-11-04)

In the same statement, the route fills `first_name` / `last_name` / `email` from the caller's own auth
metadata **when, and only when, those columns are empty**. The runner's own Profile edit therefore always
wins, and a deliberate blank-out is never re-filled behind them.

| Column | Source | Written when |
|---|---|---|
| `first_name` | `user_metadata.full_name` → `full_name` → `name`, first whitespace-separated token | `first_name` AND `last_name` are both empty |
| `last_name` | the remainder of that name, joined | same condition, and only if the name has more than one token |
| `email` | `user.email`, else `user_metadata.email` | `email` is empty |
| `updated_at` | `now()` | only when one of the above is written |

**Why here and not in the client.** It used to be two `void supabase.from('user_settings').upsert(...)`
calls in `DashboardClient` — the `{ error }` discarded, so a failure was unobservable. **Measured
2026-11-04: of 46 users whose auth metadata carries a `full_name`, 44 had an empty `first_name`; only 3
rows of 52 have ever held one.** The runner cannot see this, because the client also sets the name in
React state — the greeting reads correctly off metadata while the table stays null. What breaks is every
**server** surface, which can only read the table: the daily push, the trial emails and the coach prompts.

A client write can also be skipped by an early return above it, and on native the cookie client's
`auth.uid()` is NULL, so RLS declines it — both silent. This route is authed and carries the Bearer token
through `createUserScopedClient`, which is the same reason it already existed in that shape.

## Notes

- Idempotent — repeated calls just refresh the timestamp.
- No body, no rate limiting. The dashboard only fires this when the Today screen mounts (or when `screen` transitions to `today`), so traffic is naturally bounded.
- Failure is silent on the client — at worst the cron sends a push the runner doesn't need.
