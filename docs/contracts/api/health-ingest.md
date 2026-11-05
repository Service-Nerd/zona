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
