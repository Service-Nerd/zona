# API Contract — /api/analyse-run

**Method:** POST  
**Auth:** Bearer token (paid/trial). Internal webhook path: `x-service-key` + `x-user-id` headers bypass auth check.  
**Gate:** `strava_intelligence` — returns 403 for free tier.

## Request body

```json
{
  "strava_activity_id": 12345678,
  "week_n": 3,
  "session_day": "week_3_tue"
}
```

All three fields required. Returns 422 if any are missing.

## Response — 200

```json
{
  "analysis": {
    "user_id": "uuid",
    "week_n": 3,
    "session_day": "week_3_tue",
    "strava_activity_id": 12345678,
    "hr_discipline_score": 82,
    "distance_score": 90,
    "pace_score": 75,
    "ef_score": 60,
    "total_score": 81,
    "verdict": "nailed",
    "feedback_text": "Kept it under control.",
    "hr_in_zone_pct": 88,
    "hr_above_ceiling_pct": 4,
    "hr_below_floor_pct": 8,
    "ef_value": 0.0182,
    "ef_baseline": 0.0178,
    "ef_trend_pct": 2.2,
    "planned_load_km": 10,
    "actual_load_km": 9.8,
    "rule_engine_version": "1.0.0"
  },
  "score": { "hrDisciplineScore": 82, "distanceScore": 90, "paceScore": 75, "efScore": 60, "totalScore": 81, "verdict": "nailed" }
}
```

## Error responses

| Status | Condition |
|--------|-----------|
| 401 | No valid session |
| 403 | Free tier |
| 404 | Activity or plan not found |
| 422 | Missing required fields |

## Notes

- Upserts to `run_analysis` table (conflict key: `user_id, strava_activity_id`).
- AI feedback via claude-haiku (max 200 tokens). Silent fallback — row is written regardless of AI result.
- Internal webhook path (called by Strava webhook handler): sets `tier = 'trial'` for enrichment and fires a push notification.
- Scoring weights: HR 50%, distance 25%, pace 15%, EF 10%. See `lib/coaching/constants.ts`.
