# API Contract — /api/daily-coach-note

**Method:** GET  
**Auth:** Supabase session required. Returns 401 if unauthenticated.  
**Gate:** `activity_intelligence` (PAID_ONLY_ONGOING). Returns 403 for free users. Client-side gate skips the fetch entirely for free users.

## Query parameters

| Param | Required | Description |
|-------|----------|-------------|
| `date` | No | User's local date `YYYY-MM-DD`. Defaults to UTC date if absent. |
| `force` | No | `true` to regenerate even if a cached note exists for this date. |

## Response — 200

```json
{ "note": "Hard day tomorrow. Keep today genuinely easy." }
```

## Error responses

| Status | Condition |
|--------|-----------|
| 401 | Missing or invalid session |
| 403 | Free tier user |
| 404 | No plan found for user |

## Caching behaviour

- One row per `(user_id, note_date)` in the `daily_coach_notes` table.
- On a cache hit (and `force` not set), returns the cached note immediately — no AI call.
- On a cache miss or `force=true`, generates via Claude (claude-haiku), upserts the row, returns the note.
- Silent fallback: if AI generation fails, returns `null` note rather than erroring. Client handles `null` gracefully (no note shown).

## Notes

- `date` should be the user's local calendar date, not UTC — pass `new Date().toLocaleDateString('en-CA')` from the client.
- Strength sessions are excluded from coaching context (feature not fully built).
- Prompt source: `lib/coaching/prompts/dailyCoachNote.ts`.
