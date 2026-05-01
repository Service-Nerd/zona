# API Contract — /api/weekly-report

**Method:** POST  
**Auth:** Bearer token (paid/trial). Internal cron path: `x-service-key` + `x-user-id` headers bypass auth check.  
**Gate:** `activity_intelligence` — returns 403 for free tier.

## Query params

| Param | Default | Notes |
|-------|---------|-------|
| `force` | `false` | Set `?force=true` to regenerate an existing report for this week |

## Request body

Empty body accepted.

## Response — 200

```json
{
  "report": {
    "id": "uuid",
    "user_id": "uuid",
    "week_n": 3,
    "headline": "Solid week.",
    "body": "Zone discipline was good. Load was within range.",
    "cta": "Keep the easy days easy.",
    "zone_discipline_pct": 84,
    "load_ratio": 1.1,
    "sessions_completed": 4,
    "sessions_planned": 5,
    "rule_engine_version": "1.0.0",
    "created_at": "2026-04-29T10:00:00Z"
  },
  "cached": false
}
```

`cached: true` when an existing report was returned without regeneration.

## Error responses

| Status | Condition |
|--------|-----------|
| 401 | No valid session |
| 403 | Free tier |
| 404 | No plan or no current week |

## Notes

- Returns existing report for the current week unless `?force=true`.
- Aggregates `session_completions` + `run_analysis` + load history for the current week.
- AI generates Headline/Body/CTA via claude-haiku (max 300 tokens). Silent fallback to rule-based strings.
- Internal cron path used by `/api/push/send-weekly-report`.
