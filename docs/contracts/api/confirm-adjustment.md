# API Contract — /api/confirm-adjustment

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

The returned plan has the adjustment's `sessions_after` applied to the relevant week.

## Error responses

| Status | Condition |
|--------|-----------|
| 401 | No valid session |
| 403 | Free tier |
| 404 | Adjustment not found (or belongs to another user) |
| 409 | Adjustment status is not `pending` |
| 422 | `adjustment_id` missing |

## Notes

- Sets `plan_adjustments.status = 'confirmed'` and `confirmed_at = now()`.
- Saves updated plan via `savePlanForUser` (archives previous plan to `plan_archive`).
- Both DB operations run in parallel.
