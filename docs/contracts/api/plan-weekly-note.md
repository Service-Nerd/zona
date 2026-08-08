# API Contract — /api/plan-weekly-note

**Method:** POST  
**Auth:** Supabase session required. Returns 401 if unauthenticated.  
**Gate:** `activity_intelligence` (PAID/TRIAL). Returns 403 for free users.

## Request body

```json
{
  "week_n": 7
}
```

| Field | Required | Description |
|-------|----------|-------------|
| `week_n` | Yes | Canonical `week.n` key (ADR-013), not array position. Equals the 1-indexed position on race plans, but continues at 26+ on a standalone maintenance plan whose array restarts at 0. Must be a positive integer. |

## Response — 200

```json
{
  "headline": "Quality and long run this week. Hard stuff first.",
  "items": [
    "Run the quality session when fresh — not back-to-back with another hard day.",
    "The long run should be Zone 2 only."
  ],
  "cached": false
}
```

| Field | Type | Description |
|-------|------|-------------|
| `headline` | `string` | One sentence naming the week's job |
| `items` | `string[]` | 0–2 short coaching cues — priority session and/or pacing/recovery |
| `cached` | `boolean` | `true` if returned from the `plan_weekly_notes` cache, `false` if freshly generated |

## Error responses

| Status | Condition |
|--------|-----------|
| 401 | Missing or invalid session |
| 403 | Free tier user |
| 404 | Plan not found OR no week in the plan carries `week.n === week_n` |
| 422 | Missing or non-positive `week_n` |
| 503 | AI generation failed OR response unparseable (ephemeral — no row written; client falls back to rule-engine voice silently per ADR-006) |

## Idempotency

Keyed on `(user_id, week_n)` via the `plan_weekly_notes` primary key. Subsequent calls for the same week return the cached row without re-generating.

## Cache invalidation

Cached rows are deleted en bloc on **every plan save** via `lib/plan.ts → savePlanForUser`. This covers all writes through one path:

- Plan regeneration
- R20 reshape (auto and user-initiated)
- Confirmed plan adjustments
- Reverted adjustments
- Zone recalibration

The next Plan-screen view regenerates lazily against the new session shape. Prevents the failure mode where a cached note narrates sessions that no longer exist after a regen.

## Continuity (AI-DEPTH-04/10)

The route fetches the most recent prior week's note (`WHERE week_n < req.week_n ORDER BY week_n DESC LIMIT 1`) and passes it to the prompt as a `previousWeeklyNote` block. The prompt instructs the model to reference last week's framing at most once, only when this week tracks against it (improvement, repeat-issue, deload-then-reintroduce-volume).

Null on week 1, or after cache invalidation cleared the row.

## Data used by the route

- `plans` — current plan; resolves the week via `findWeekByN(plan.weeks, week_n)` (by `week.n`, never `plan.weeks[week_n - 1]` — out of bounds on a maintenance plan) for session shape, `meta.race_date` / `meta.race_name` / `meta.race_distance` for race countdown
- `user_settings` — `first_name` for the single-mention voice rule
- `plan_weekly_notes` — most recent prior week's note for continuity

## AI model

`ANTHROPIC_MODEL` (Haiku) — short input, short output, single-shot composition. Cost-bounded per (user × week). Swap to `ANTHROPIC_MODEL_DEEP` (Sonnet) in `app/api/plan-weekly-note/route.ts` if quality is weak — one-line change.

## Prompt source

`lib/coaching/prompts/planWeeklyNote.ts → buildPlanWeeklyNotePrompt()`. Parsed by `parsePlanWeeklyNoteResponse()` in the same file (structured `HEADLINE: …` / `ITEM: …` text → object).
