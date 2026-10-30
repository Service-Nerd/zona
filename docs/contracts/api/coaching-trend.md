# API Contract — /api/coaching/trend

**Method:** GET
**Auth:** Supabase session required. Returns 401 if unauthenticated.
**Gate:** `activity_intelligence` (PAID_ONLY_ONGOING). Returns 403 for free users.

Multi-month trend backend (AI-DEPTH-03). Returns a series of same-effort runs over time at a given anchor distance. Powers POST-RUN-REFRAME-01 Tier A reframe enrichment (inline call) and is wired as a standalone surface for future Coach-screen trend cards.

## Query parameters

| Param | Required | Description |
|---|---|---|
| `session_type` | Yes | e.g. `'easy'`, `'long'`, `'tempo'` |
| `distance_km` | Yes | Anchor distance — cohort matches ±15% |
| `window_months` | No | Lookback window. Clamped to `[1, 24]`. Defaults to `TREND_SERIES.DEFAULT_WINDOW_MONTHS` (6). |

## Response — 200 (trend available)

```json
{
  "trend": {
    "sessionType": "long",
    "distanceKm": 20.5,
    "windowMonths": 6,
    "buckets": [
      { "monthStart": "2026-02-01T00:00:00.000Z", "monthKey": "2026-02", "shortLabel": "Feb", "cohortSize": 3, "avgHr": 168, "avgPaceSecPerKm": 360 },
      { "monthStart": "2026-05-01T00:00:00.000Z", "monthKey": "2026-05", "shortLabel": "May", "cohortSize": 4, "avgHr": 151, "avgPaceSecPerKm": 355 }
    ],
    "hrDeltaBpm": -17,
    "paceDeltaSec": -5,
    "hrIsTrending": true,
    "paceIsTrending": true
  },
  "readiness": { "runs": 7, "needRuns": 6, "months": 2, "needMonths": 2 },
  "easyCostMoment": false
}
```

`easyCostMoment` (COACH-SEEN-MOMENTS-01, §131, 2026-10-30) is always present: `true` only when the series shows the
heart rate fallen past `MIN_HR_DELTA_BPM` with pace confirming (`paceContext === 'confirms'`) AND the same series built
without the last 7 days of runs did not (`easyCostFellThisWeek`, `lib/coaching/moments.ts`). No stored state, so it is
true for the week the drop first crosses the floor and can return if the trend falls back and crosses again.

`readiness` (COACH-TREND-PENDING-01, 2026-10-30) is always present: how close the runner is to a series, counted by
`trendReadiness` from the SAME cohort as the series (`trendCohort` in `lib/coaching/runHistory.ts`), so a card's "4 of 6"
can never count different runs from the series it waits for.

## Response — 200 (no trend)

```json
{ "trend": null, "readiness": { "runs": 4, "needRuns": 6, "months": 1, "needMonths": 2 }, "easyCostMoment": false }
```

`null` is returned when threshold gates aren't met:

- Fewer than `TREND_SERIES.MIN_TOTAL_RUNS` matching runs in the window
- Fewer than `TREND_SERIES.MIN_BUCKETS` months with at least `MIN_RUNS_PER_BUCKET` runs each

⚠️ **Corrected 2026-10-30.** This list used to include *"all deltas below `MIN_HR_DELTA_BPM` AND `MIN_PACE_DELTA_SEC`"*.
The code never did that: a series that clears the run and month gates is returned with `hrIsTrending: false`, and the
caller decides. Coach renders it as the **steady** state (numbers, "steady", the noise floor stated).

## Error responses

| Status | Condition |
|---|---|
| 401 | Missing or invalid session |
| 403 | Free tier user |
| 422 | `session_type` missing or `distance_km` not a positive number |

## Notes

- Data source: `strava_activities` via `fetchRunHistory()` — source-mixed (HealthKit + Strava).
- Buckets are calendar months keyed by `YYYY-MM`. Empty months are omitted from the series, not zero-filled.
- Threshold constants live in `lib/coaching/constants.ts → TREND_SERIES`.
- Build function: `lib/coaching/runHistory.ts → buildHrTrendSeries()` — pure, easily testable from already-fetched history.
- The POST-RUN-REFRAME-01 route calls `buildHrTrendSeries()` inline (same query path as the cohort) rather than hitting this endpoint, to avoid a second round-trip.

## Consumer rules — the sparkline (TREND-SPARKLINE-01, 2026-09-12)

`buckets` is the **whole series**, and consumers should treat it as such. The
Coach screen previously read `buckets[0]` and `buckets[buckets.length - 1]` and
discarded the middle, which is why its trend card could state a change and not
show its shape.

- `lib/coaching/trendSparkline.ts → buildTrendSparkline()` is the single owner of
  the geometry. Do not plot `buckets` directly.
- **Buckets are sparse by construction.** `buildHrTrendSeries` skips any month
  below `TREND_SERIES.MIN_RUNS_PER_BUCKET`, so consecutive array entries are
  frequently NOT consecutive months. Position the x axis from `monthKey`, never
  from array index.
- **`avgHr` can be null** for a bucket whose runs carried no plausible heart
  rate (`RUN_HR_PLAUSIBLE`, 90–220 bpm). Drop those points; never interpolate.

## The Anthropic call — OPS-AI-OWNER-01 (2026-09-20)

This route no longer calls Anthropic directly. It goes through
**`lib/ai/callAnthropic.ts`**, the single owner, as surface **`trend`**.

- **Behaviour is unchanged.** Same URL, same headers, same body, same silent
  fallback (ADR-006 — the deterministic path always succeeds, AI is enrichment).
- **Every call is now recorded**: `ai_call` with real token counts and an
  estimated cost, or `ai_call_failed` with the reason, status and a truncated
  body. Read them at `GET /api/ops/ai-spend`.
- **A 2xx whose body is not JSON is now a failure**, not an empty answer. This
  route previously could not tell those apart.
- `noRawAnthropicCalls.test.ts` fails the build if this file names
  `api.anthropic.com` again. Full contract: `docs/contracts/api/ops-ai-spend.md`.
