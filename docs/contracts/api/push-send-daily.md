# API Contract — /api/push/send-daily

**Method:** POST
**Auth:** `Authorization: Bearer <CRON_SECRET>` (the header Vercel cron sends) **or** `x-cron-secret`. Either must match `CRON_SECRET`. Returns 403 otherwise.
**Trigger:** Vercel cron — hourly at `:30` UTC (`vercel.json` cron config). The route filters per-user by local hour, so only subscribers whose stored `timezone` puts them in the 6 AM local hour get a push on any given run.

## Request body

Empty body accepted (cron invocation).

## Response — 200

```json
{ "sent": 3, "skipped": 47, "errors": [] }
```

| Field | Meaning |
|---|---|
| `sent` | Number of users for whom at least one device delivery succeeded. |
| `skipped` | Users not pushed this run (wrong local hour, opted out, already sent today, opened Today within 30 min, no plan, rest day, free tier). |
| `errors` | Up to 5 per-user failure strings. Per-user errors are caught and do not abort the batch. |

## Error responses

| Status | Condition |
|--------|-----------|
| 403 | Missing or invalid cron secret |
| 500 | Subscription read from Supabase failed |

## Behaviour

For each `push_subscriptions` row (grouped by `user_id` so multi-device users are evaluated once):

1. Load `user_settings.{timezone, daily_push_enabled, daily_push_last_sent_on, last_today_open_at}`. Skip if missing or `daily_push_enabled = false`.
2. Compute the user's local hour from `timezone` via `Intl.DateTimeFormat`. Skip if local hour ≠ 6.
3. Skip if `daily_push_last_sent_on` already equals today's local date (idempotency backstop).
4. Skip if `last_today_open_at` is within the last 30 minutes (runner is already in the app).
5. Resolve tier via `getUserTier()`. Skip free tier.
6. Load plan + session overrides. Skip if no plan or no current week.
7. Resolve today's effective session via `resolveEffectiveSessions`. Skip if rest, cross-train, or strength.
8. Build the payload via `lib/coaching/voiceLines.ts → buildDailyPushTitle / buildDailyPushBody`:
   - `title` — e.g. `"Today: easy 45m."` Prefix comes from `BRAND.push.dailyTraining`.
   - `body` — voice line for the session type (from `getSessionVoiceLine`).
   - `tag` — `daily-push-<YYYY-MM-DD>` so platforms collapse duplicates.
   - `data.url` — `/dashboard?screen=today`.
9. Dispatch to every device for this user: APNs for `platform='ios'`, Web Push otherwise.
10. On any successful device delivery, stamp `daily_push_last_sent_on = <local date>`.

## Notes

- **Strava-independent.** No run data is read on this path — source is the plan + session catalogue + voice lines.
- **Voice lines** live in `lib/coaching/voiceLines.ts` (extracted from `DashboardClient.tsx` as part of HOOK-01).
- **Timezone capture** is automatic — `DashboardClient` writes `user_settings.timezone` from `Intl.DateTimeFormat().resolvedOptions().timeZone` on first load when the stored value is still the default `'UTC'`.
- **Heartbeat suppression** depends on `POST /api/me/today-heartbeat`, which `DashboardClient` calls when the Today screen mounts.
