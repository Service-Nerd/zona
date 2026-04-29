# API Contract — /api/adjust-plan

**Method:** POST  
**Auth:** Bearer token (paid/trial).  
**Gate:** `dynamic_reshape_r20` — returns 403 for free tier.

## Request body

All fields optional. Signals determine which trigger fires.

```json
{
  "manual": true,
  "rpe": 8,
  "sessionType": "easy",
  "skipReason": "Life got busy",
  "sessionDay": "week_3_tue",
  "fromDay": "tue",
  "toDay": "thu"
}
```

| Field | Trigger | Notes |
|-------|---------|-------|
| `manual: true` | Manual reshape (T-manual) | Forces confirmation regardless of risk level |
| `rpe` + `sessionType` | T5 — RPE disconnect | `rpe ≥ 8` on `easy`/`long` fires coach note |
| `skipReason` + `sessionType` + `sessionDay` | T2 — Skip with reason | Reasons: `"Too tired"` / `"Life got busy"` / `"Bad weather"` / `"Injury / illness"` |
| `fromDay` + `toDay` | T1 — Session reorder | Day keys: `mon`–`sun` |
| _(empty body)_ | Auto triggers (T3-T4) | Runs full trigger stack; respects `dynamic_adjustments_enabled` opt-out |

`skipReason` and `fromDay/toDay` signals bypass the `dynamic_adjustments_enabled` opt-out (user-initiated).

## Response — 200 (adjustment found)

```json
{
  "adjustment": { "id": "uuid", "status": "pending", "trigger_type": "skip_with_reason", "summary": "...", "sessions_before": [...], "sessions_after": [...] },
  "requires_confirmation": true
}
```

## Response — 200 (no adjustment needed)

```json
{ "adjustment": null, "message": "No adjustment needed" }
```

## Response — 200 (opt-out)

```json
{ "skipped": true, "reason": "user_disabled" }
```

## Error responses

| Status | Condition |
|--------|-----------|
| 401 | No valid session |
| 403 | Free tier |
| 404 | No plan found |
| 500 | DB insert failed |

## Notes

- Returns existing pending adjustment if one already exists (deduplication).
- Auto-applied (low-risk) adjustments update the plan immediately and return `status: "auto_applied"`.
- Hard caps: max 2 adjustments/week, 3-week taper protection (bypassed for T1/T2).
- AI explanation via claude-haiku (max 150 tokens). Silent fallback to rule-based summary.
- Trigger priority: T1 skip → T1 reorder → guard check → T4 fatigue → T3 acute/chronic → zone drift → shadow load → EF decline → T5 RPE.
