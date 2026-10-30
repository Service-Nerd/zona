# API Contract — /api/push/send-weekly-report

**Method:** GET (Vercel cron) or POST (manual)  
**Auth:** `CRON_SECRET`, read by `cronSecretFrom` (`lib/security/secrets.ts`): `Authorization: Bearer <secret>` (what Vercel cron sends) or `x-cron-secret`. Returns 403 otherwise.  
**Trigger:** Vercel cron — every Sunday at 18:00 UTC (`vercel.json` cron config).

> 🔴 **WEEKLY-REPORT-CRON-AUTH-01 (2026-10-30).** This contract said `x-cron-secret` and *"Vercel cron"* on adjacent lines,
> and the route matched the first: Vercel cron sends Bearer, so every Sunday call was refused. Measured: 0 weekly reports
> and 0 weekly pushes in 90 days. Held by `lib/security/cronAuth.test.ts`, which also fails any cron route that reads
> `x-cron-secret` without accepting Bearer.

## Request body

Empty body accepted (cron invocation).

## Response — 200

```json
{ "sent": 12, "declined": 3, "errors": [] }
```

`sent` = push notifications dispatched. `declined` = subscribers whose `/api/weekly-report` call did not return ok (no
plan, no runs, an error): counted so a Sunday that produces nothing is visible. `errors` = up to 5 thrown errors.

## Error responses

| Status | Condition |
|--------|-----------|
| 403 | Missing or invalid secret (neither header matches) |

## Notes

- Fetches all rows from `push_subscriptions`.
- For each subscriber, calls `/api/weekly-report?force=true` internally at `getInternalBaseUrl()` (service key + `x-user-id` header) to generate a FRESH read of the week. **`force` since COACH-READ-AUTO-01 (2026-10-30):** Coach now generates a read when a runner opens it mid-week, and without `force` the route would return that earlier, thinner read and Sunday would push its headline (SLT, Wood's condition).
- Sends Web Push notification via `lib/webpush.sendWebPush()`. Title from `BRAND.push.weeklyReport`.
- Stale subscriptions returning 410 Gone are deleted automatically.
- Errors per-user are caught and counted separately — one failure does not abort the batch.
- No-ops silently if no subscriptions exist.
