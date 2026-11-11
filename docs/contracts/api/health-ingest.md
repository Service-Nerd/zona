# Contract — POST /api/health/ingest

**Route:** `app/api/health/ingest/route.ts`. Bearer-authenticated (`getUserFromRequest`). One of the sanctioned writers of
`strava_activities` (INV-DATA-008). Three request shapes, chosen by `source`:

| `source` | Does | Notes |
|---|---|---|
| *(absent)* — a HealthKit workout | Consolidates or upserts the run, then auto-matches and analyses | See ADR-011, `consolidateIncomingHealthKitRow`, `hrArrivalStamp` (HR-LATE-STAMP-01) |
| `'manual'` | Upserts a hand-logged run (`manual_uuid`) | `adaptManualRun` |
| `'report_distance'` | **UNMEASURED-DISTANCE-01.** Fills in a distance the device did not record | Below |

### Request headers

| Header | Required | Meaning |
|---|---|---|
| `Authorization: Bearer <jwt>` | yes | Any authenticated user. The ROW lands for everyone; the ANALYSIS is tier-gated below (`HK-FREE-INGEST-LINE-01`) |
| `X-Ingest-Path: native` | no | **HK-NATIVE-BG-INGEST-01.** Set only by `HealthObserverPlugin`'s native ingest. Changes **no behaviour** — it is read solely to record a `health_native_ingest` ops event, so the native path is distinguishable from the web sweep (which `health_sync_swept` already measures end to end). ⚠️ Absent or any other value means the web path and records nothing extra, so the two measurements cannot double-count. |

> ⚠️ **THERE ARE TWO PRODUCERS OF THE HealthKit REQUEST BODY** since 2026-11-05: `lib/health/clientSync.ts` (full payload, with HR) and `HealthObserverPlugin.shellPayload` in **Swift** (shell only, no HR — HR is deferred to `retryPendingHrRows`, per `HK-HR-LOCKED-DROPS-RUN-01`). The compiler sees neither side of that seam; `lib/health/nativeIngestContract.test.ts` compares the Swift source against the `HealthKitWorkoutPayload` interface in both directions. **Changing that interface means changing the Swift.**
>
> 🔑 Two producers are safe only because this route **upserts on `(user_id, apple_health_uuid)`**: the native shell row and the web path's later full-HR row converge on one row. Do not change that `onConflict`.

## `source: 'report_distance'`

```typescript
// request
{ source: 'report_distance'; appleHealthUuid: string; distanceMeters: number }
// 200
{ status: 'ok'; reported_distance_m: number }
```

| Status | When |
|---|---|
| 401 | no signed-in user |
| 422 | missing `appleHealthUuid`, or `distanceMeters` outside `REPORTED_DISTANCE_M` (100 – 200,000 m) |
| 404 | no run with that uuid **for this user** (another runner's run is not reachable) |
| 409 | **the device measured a distance** (`distance_m > 0`): fill-only, never an override |
| 500 | read or write failed; recorded as `health_ingest_failed` with `stage: 'report_distance_read' / '_write'` |

**Writes only** `reported_distance_m` (rounded metres) and `reported_at` on the runner's own row. `distance_m` is never
touched (ADR-011: the device's value is the system of record). **Read only through** `lib/health/runDistance.ts`, which
returns measured, else reported (flagged), else null. Counts for volume, load and display; **never** for a fitness estimate
(Coaching Board 2026-10-22). Tests: `lib/health/reportDistance.test.ts`.

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

## Why a stored run produced no read (ACT-RUNREAD-REACH-01, 2026-11-11)

The row landing and the run being **read** are different outcomes, and this route owns the seam
between them. `autoMatchAndAnalyse` is called **only when `canAnalyse`** is true
(HK-FREE-INGEST-LINE-01: the row is free, the coaching is paid), so a free runner's run never
reaches the matcher at all.

Every failure on that path now records a `run_unmatched` ops event naming **which** wall it hit:

| reason | where | means |
|---|---|---|
| `tier_gated` | **this route**, in the `else` of `if (canAnalyse)` | free tier: the row lands, the read does not |
| `no_plan` | `autoMatchAndAnalyse` | the runner had no plan when the run arrived |
| `plan_read_failed` | `autoMatchAndAnalyse` | the plan READ failed, so whether they had one is unknown |
| `outside_plan_weeks` | `autoMatchAndAnalyse` | the run date is not inside the 7-day window of the week it resolved to |
| `week_has_no_sessions` | `autoMatchAndAnalyse` | that week carries no session at all, after overrides |
| `below_threshold` | `autoMatchAndAnalyse` | a session was there and nothing reached the auto-link score |

⚠️ **`plan_read_failed` is separate from `no_plan` on purpose.** `readPlanJson` returns
`{ plan: null, error }` for a genuine database failure as well as for a runner who has not
generated a plan, and `no_plan` is the largest bucket by far: folding the two together would pad
it with our own outages, unrecoverably.

⚠️ **`week_has_no_sessions` and `below_threshold` both split on whether the run is actually inside
the resolved week.** `getWeekIndexForDate` pins a run from outside the plan to the nearest past
week, so without the split a post-plan run lands under a reason that blames the plan's shape for
a run that was never in the plan.

⚠️ **ONE ROW PER INGEST ATTEMPT, NOT PER RUN.** `clientSync` re-posts recent workouts on every
sweep, so `detail.activity_id` is what makes these dedupable and
`v_activation_funnel.unmatched_runs` counts **DISTINCT** ids. A plain `count(*)` would report
sweeps.

⚠️ **`tier_gated` is recorded HERE and nowhere else**, because the gate wraps the whole call. A
reason that lives outside the function it describes is the kind that goes uncounted, which is why
it is declared in `RUN_UNMATCHED_REASONS` alongside the other four rather than inline.

⚠️ **A non-run records nothing.** A walk or a ride is not a run that failed to be read, and
counting it would bury the four reasons that matter.

`detail`: `{ reason, source, activity_id, activity_date, week_n?, candidates?, within_week?, message?, tier? }` — the
**date**, never the time. Surfaced per runner by `v_activation_funnel.last_unmatched_reason`.
Tests: `lib/coaching/runUnmatchedReason.test.ts` (behavioural, through the real matcher).
