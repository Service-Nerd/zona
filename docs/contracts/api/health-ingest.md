# Contract — POST /api/health/ingest

**Route:** `app/api/health/ingest/route.ts`. Bearer-authenticated (`getUserFromRequest`). One of the sanctioned writers of
`strava_activities` (INV-DATA-008). Three request shapes, chosen by `source`:

| `source` | Does | Notes |
|---|---|---|
| *(absent)* — a HealthKit workout | Consolidates or upserts the run, then auto-matches and analyses | See ADR-011, `consolidateIncomingHealthKitRow`, `hrArrivalStamp` (HR-LATE-STAMP-01) |
| `'manual'` | Upserts a hand-logged run (`manual_uuid`) | `adaptManualRun` |
| `'report_distance'` | **UNMEASURED-DISTANCE-01.** Fills in a distance the device did not record | Below |

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
