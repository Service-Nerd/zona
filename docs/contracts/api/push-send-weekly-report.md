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

## Duration ceiling and the outbound hop (AI-ROUTE-HTTP-HOP-CEILING-01, 2026-11-10)

`export const maxDuration = 300`, and every outbound `fetch` to an AI route carries
`signal: AbortSignal.timeout(AI_LIMITS.HOP_TIMEOUT_MS)` (30 s).

🔴 **Why this route needed both.** `OPS-FN-DURATION-01` set `maxDuration` on every route in
`callAnthropic`'s **import** closure. That population is right for the routes that CALL the model
and wrong for the ones that **WAIT** on one over HTTP, and **the two sets do not overlap** — this
route reaches `/api/analyse-run` through a URL string, which no import graph can see. ⚠️ **The
fix made the exposure worse before it fixed it:** the downstream may now hold for up to
`CALL_TIMEOUT_MS` (240 s) where the platform used to cut it off, so the caller with no declared
ceiling is what dies instead.

⚠️ **The literal `300` is duplicated from `AI_LIMITS.ROUTE_MAX_DURATION_SECONDS` because Vercel
cannot read a constant from a route config.** `lib/ai/aiRouteHopCeiling.test.ts` is the link: it
derives the population from the import closure plus a brace-matched `fetch` reader, and fails if
any hop has no signal, any waiting route has no ceiling, or the literal and the constant disagree.

🔻 **AND THIS ROUTE'S SHAPE IS THE REASON THE HOP TIMEOUT IS 30 s RATHER THAN 240 s.** It loops
**sequentially** over every push subscription, awaiting the hop each time — measured 2026-11-10:
**31 subscriptions, 26 users.** So one hop hanging does not cost one report; it ends the cron, and
every subsequent subscriber gets no Sunday push, which nothing watches. ⚠️ **A timeout bounds the
damage from one bad hop; it does not fix the shape.** The total is `subscriptions × hop`: at 31 ×
a typical 5 s that is already ~155 s of a 300 s ceiling, and **at roughly 60 subscribers the cron
exceeds its ceiling on typical latencies alone.** Batching or a fan-out is a separate decision,
with that number attached rather than arriving as a surprise at 60 installs.
