# API Contract — /api/push/send-trial-insight

**Method:** GET (Vercel cron) or POST (manual / curl). Both handlers run the same logic.
**Auth:** `Authorization: Bearer <CRON_SECRET>` or `x-cron-secret`. Either must match `CRON_SECRET`. Returns 403 otherwise.
**Trigger:** Vercel cron — hourly at `:15` UTC (`vercel.json`). The trial-day filter inside the route is the rate limit, not the schedule.

## Request body

Empty body accepted (cron invocation).

## Response — 200

```json
{ "sent": 1, "skipped": 49, "errors": [] }
```

| Field | Meaning |
|---|---|
| `sent` | Number of users for whom at least one device delivery succeeded. |
| `skipped` | Subscribers not pushed on this run (already sent, wrong trial day, free tier, fewer than 2 analyses, etc.). |
| `errors` | Up to 5 per-user failure strings. Per-user errors are caught and do not abort the batch. |

## Error responses

| Status | Condition |
|--------|-----------|
| 403 | Missing or invalid cron secret |
| 500 | Subscription read from Supabase failed |

## Behaviour

For each `push_subscriptions` row (grouped by `user_id` so multi-device users are evaluated once):

1. Load `user_settings.{trial_started_at, trial_insight_push_sent_at}`.
2. **One-shot guard.** Skip if `trial_insight_push_sent_at` is non-null.
3. Skip if `trial_started_at` is null.
4. Compute trial day = `floor((now − trial_started_at) / 1 day) + 1`. Skip unless day is in `[3, 5]`.
5. Resolve tier via `getUserTier()`. Skip free tier.
6. Load up to 5 most recent `run_analysis` rows with non-null `feedback_text`. Skip if fewer than 2 have non-empty `feedback_text`.
7. Take the most recent row. Build the body from the first sentence of `feedback_text`, truncated to 100 chars on a word boundary with ellipsis if needed.
8. Build the payload:
   - `title` — `BRAND.push.trialInsight` (`"Kit noticed something."`).
   - `body` — first sentence of `feedback_text`.
   - `tag` — `trial-insight` (collapses duplicates on the platform side).
   - `data.url` — `/dashboard?screen=session&weekN=<n>&sessionDay=<day>`. `DashboardClient` captures these on mount and routes to `SessionScreen` once `plan` loads.
9. Dispatch to every device for this user (APNs for `platform='ios'`, Web Push otherwise).
10. On any successful delivery, stamp `trial_insight_push_sent_at = now()` so the user never re-receives.

## Notes

- **One-shot for life.** The `trial_insight_push_sent_at` stamp is never cleared. A user who trials, exits, and trials again (if that path ever exists) will not receive this nudge a second time. Acceptable trade-off for a conversion-window nudge.
- **Strava-independent.** `run_analysis` rows are populated by either the Strava analysis pipeline or the HealthKit analysis pipeline. On day one only HealthKit-derived analyses will exist; the trigger reads them the same way.
- **No `daily_push_enabled` gate.** That toggle (HOOK-01) is specifically for the morning training-day push. The trial-insight nudge is a separate one-shot moment — the natural opt-out is removing the push subscription entirely.
- **Schedule offset.** Runs at `:15` instead of `:30` so it doesn't stampede with `/api/push/send-daily`.
