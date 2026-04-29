# API Contract — /api/push/send-weekly-report

**Method:** POST  
**Auth:** `x-cron-secret` header must match `CRON_SECRET` env var. Returns 403 otherwise.  
**Trigger:** Vercel cron — every Sunday at 18:00 UTC (`vercel.json` cron config).

## Request body

Empty body accepted (cron invocation).

## Response — 200

```json
{ "sent": 12 }
```

`sent` = number of push notifications successfully dispatched.

## Error responses

| Status | Condition |
|--------|-----------|
| 403 | Missing or invalid `x-cron-secret` |

## Notes

- Fetches all rows from `push_subscriptions`.
- For each subscriber, calls `/api/weekly-report` internally (service key + `x-user-id` header) to generate or fetch the week's report.
- Sends Web Push notification via `lib/webpush.sendWebPush()`. Title from `BRAND.push.weeklyReport`.
- Stale subscriptions returning 410 Gone are deleted automatically.
- Errors per-user are caught and counted separately — one failure does not abort the batch.
- No-ops silently if no subscriptions exist.
