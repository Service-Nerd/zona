# API Contract — /api/revert-adjustment

**Method:** POST  
**Auth:** Bearer token (paid/trial).  
**Gate:** `dynamic_reshape_r20` — returns 403 for free tier.

## Request body

```json
{ "adjustment_id": "uuid" }
```

Required. Returns 422 if missing.

## Response — 200

```json
{ "plan": { /* full updated Plan object */ } }
```

The returned plan has the adjustment's `sessions_before` snapshot restored to the relevant week.

## Error responses

| Status | Condition |
|--------|-----------|
| 401 | No valid session |
| 403 | Free tier |
| 404 | Adjustment not found (or belongs to another user) |
| 409 | Adjustment already has status `reverted` |
| 422 | `adjustment_id` missing |

## Notes

- Sets `plan_adjustments.status = 'reverted'` and `reverted_at = now()`.
- Saves updated plan via `savePlanForUser` (archives current plan to `plan_archive` before overwrite).
- Both DB operations run in parallel.
- Works for any adjustment status except `reverted`.
