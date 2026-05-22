# API Contract — /api/post-run-reframe

**Method:** POST
**Auth:** Supabase session required. Returns 401 if unauthenticated.
**Gate:** `post_run_reframe` (PAID_ONLY_ONGOING). Returns 403 for free users. Client gates the textarea on `hasPaidAccess` so free users never hit the route.

## Request body

| Field | Required | Type | Description |
|---|---|---|---|
| `week_n` | Yes | number | Plan week index (1-based, matches `session_completions.week_n`). |
| `session_day` | Yes | string | Session day key, e.g. `'tuesday'`. Matches `session_completions.session_day`. |
| `user_note` | Yes | string | The runner's reflection text. Trimmed and capped at `REFRAME_TIER.USER_NOTE_MAX_CHARS` (2000). |

## Response — 200 (reframe generated)

```json
{
  "reframe": "You're not failing, even though it feels like it. ...",
  "tier": "A",
  "fallback": false
}
```

## Response — 200 (risk-gate silenced)

The reframe was suppressed because a risk signal fired (overload, fatigue accumulation, severe HR drift). The UI surfaces the warning instead of a reframe card.

```json
{
  "reframe": null,
  "tier": "A",
  "silenced": true,
  "silencedReason": "session_flagged",
  "silencedMessage": "This run flagged overload. Listen to the body before anything else.",
  "fallback": false
}
```

**`silencedReason` values:** `'session_flagged' | 'repeated_overload' | 'fatigue_accumulation' | 'severe_hr_drift'`. Logic in `lib/coaching/reframeRiskGate.ts`.

## Response — 200 (silent AI fallback)

```json
{ "reframe": null, "tier": "B", "fallback": true }
```

The AI call failed or the output was rejected (cheerleader word, empty). Client returns the user to the input state with no banner.

## Error responses

| Status | Condition |
|---|---|
| 401 | Missing or invalid session |
| 403 | Free tier user — feature gated by `post_run_reframe` |
| 404 | Plan or session not found |
| 422 | `week_n`, `session_day`, or `user_note` missing or empty after trim |

## Data tier ladder

The route detects which tier of evidence is available via `detectReframeTier()` and assembles the matching context block before calling Sonnet:

| Tier | Trigger | Evidence injected |
|---|---|---|
| A | ≥`TIER_A_MIN_ACTIVITIES` runs in last `TIER_A_WINDOW_DAYS` | Cohort summary (R25), HR stream drift, multi-month trend, previous similar session |
| B | ≥`TIER_B_MIN_COMPLETIONS` completions in last `TIER_B_WINDOW_DAYS` (no activity feed) | Plan completion, recent RPE pattern, previous similar session |
| C | Below Tier B thresholds | Phase position, total sessions logged |

Thresholds in `lib/coaching/constants.ts → REFRAME_TIER`.

## Persistence

One row per `(user_id, week_n, session_day)` in the `session_reflections` table.

- Successful reframe: `reframe_text` set, `reframe_silenced=false`, `reframe_data_tier` recorded, `reframe_model` + `reframe_prompt_version` for regression tracking.
- Silenced: `reframe_text=null`, `reframe_silenced=true`, `reframe_silenced_reason` recorded. `note_text` persists either way — the runner's words are sacred.
- AI fallback: nothing persisted. Client retries by submitting again.

On re-mount, `ReflectionInput` hydrates from this row — re-entering the session surface shows the prior reframe (or silenced warning), not a blank input.

## Notes

- Model: `ANTHROPIC_MODEL_DEEP` (Sonnet). Reframe-with-cohort reasoning is closer to plan-shaped reasoning than to single-shot feedback.
- Cheerleader-word rejection: response is nullified if it matches `/\b(amazing|crushing|smash|beast mode|you've got this|crushed|don't give up)\b/i`.
- Risk gate decides BEFORE the LLM call — silenced responses cost no Sonnet tokens.
- Prompt source: `lib/coaching/prompts/sessionReframe.ts`.
- Voice spec: `docs/canonical/brand.md` § Reframe Voice. Regression suite: `docs/canonical/reframe-golden-cases.md`.
- Doctrine: `docs/canonical/CoachingPrinciples.md` §60.
