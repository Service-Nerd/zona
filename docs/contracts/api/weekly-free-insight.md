# API Contract — /api/coaching/weekly-free-insight

**Method:** GET
**Auth:** Supabase session cookie (`getUserFromRequest`). Returns 401 otherwise.
**Tier:** **FREE only.** Returns 400 for `trial` / `paid` (those tiers have the full weekly report path; the Coach tab does not call this route for them).

## Request

No body. No query params at v1.

## Response — 200

One of four discriminated shapes (the `state` field is the discriminator):

```json
{ "state": "insight",      "headline": "Honest week.", "body": "…", "cached": true }
{ "state": "risk_gated",   "message": "…" }
{ "state": "insufficient", "loggedCount": 1 }
{ "state": "unavailable" }
```

| State | Meaning | UI |
|---|---|---|
| `insight` | Cached or fresh Haiku output for this ISO-Monday week. | Render the insight card with `CoachByline` + AIMark (model output). |
| `risk_gated` | The reframe risk gate fired (overload / fatigue signal). AI is silenced; `message` is the rule-engine warning line. | Render an amber-rail warning card. **No AIMark** — output is not from the model. |
| `insufficient` | Fewer than 2 RPE-bearing `session_completions` rows in the last 7 days. | Render the "log a session to unlock your weekly Kit note" empty-state. |
| `unavailable` | Model call failed or returned malformed JSON. | Fall back to the existing dimmed Kit identity card (no behaviour). Never cached. |

## Error responses

| Status | Condition |
|--------|-----------|
| 400 | Tier is `trial` or `paid`. Route is free-only by design. |
| 401 | No authenticated user. |

## Behaviour

1. Resolve tier via `getUserTier`. Reject non-`free`.
2. Compute the ISO-Monday week start in the user's local timezone (`user_settings.timezone`, defaults to UTC). Used as the cache key.
3. Cache hit on `(user_id, week_start_date)` in `free_insights` → return the cached row as `state='insight'`. Re-renders never re-bill Haiku.
4. Pull the last 7 days of `session_completions`. Filter to `status='complete' AND rpe IS NOT NULL`. If fewer than 2 rows → return `state='insufficient'`.
5. Run the reframe risk gate (`lib/coaching/reframeRiskGate.ts → assessReframeRiskGate`) over the recent `coaching_flag` + `fatigue_tag` history. HR drift fields are passed as null (free tier has no HR stream). If the gate silences → return `state='risk_gated'` with the rule-engine message.
6. Resolve each completion's planned session type + distance from the user's plan JSON. Best-effort — unresolved slots pass through with `sessionType='unknown'`.
7. Call Anthropic Haiku (`ANTHROPIC_MODEL`) with the prompt from `lib/coaching/prompts/freeInsight.ts`. Expect JSON `{headline, body}`.
8. Parse, strip code fences, reject cheerleader vocabulary, upsert into `free_insights`, return `state='insight'`.
9. Any model failure (HTTP non-2xx, JSON parse failure, missing headline/body, banned vocabulary) → return `state='unavailable'` without caching. The next pageview will retry.

## Notes

- **Strava-independent.** No `run_analysis`, no streams, no HR data. The whole signal is manual RPE + fatigue tags from `session_completions`.
- **One Haiku call per user per ISO week.** The cache key is the user's local Monday — the next visit on Mon 00:00+ local fires a fresh generation; visits within the same week always hit cache.
- **No cron.** Surface is pull-on-view. The Coach tab fetches in `CoachTeaser`.
- **Free-tier exception.** This is the only AI route that fires for free users. Every other AI route (`/api/daily-coach-note`, `/api/analyse-run`, `/api/post-run-reframe`, etc.) is paid/trial only.
- **Tier table.** `free_insights` has `(user_id, week_start_date, headline, body, ai_model, created_at)` with composite PK and RLS. Migration: `20260525_free_insights.sql`.
