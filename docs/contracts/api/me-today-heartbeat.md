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
| 500 | `user_settings` update failed |

## Behaviour

Writes `user_settings.last_today_open_at = now()` for the authenticated user. Used by `/api/push/send-daily` to suppress the morning push when the runner has already opened the app within the last 30 minutes.

## Notes

- Idempotent — repeated calls just refresh the timestamp.
- No body, no rate limiting. The dashboard only fires this when the Today screen mounts (or when `screen` transitions to `today`), so traffic is naturally bounded.
- Failure is silent on the client — at worst the cron sends a push the runner doesn't need.
