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
  }
}
```

## Response — 200 (no trend)

```json
{ "trend": null }
```

`null` is returned when threshold gates aren't met:

- Fewer than `TREND_SERIES.MIN_TOTAL_RUNS` matching runs in the window
- Fewer than `TREND_SERIES.MIN_BUCKETS` months with at least `MIN_RUNS_PER_BUCKET` runs each
- All deltas below `MIN_HR_DELTA_BPM` AND `MIN_PACE_DELTA_SEC` (caller should not cite a trend that's noise)

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
