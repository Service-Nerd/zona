# API Contract — /api/analyse-run

**Method:** POST  
**Auth:** Bearer token (paid/trial). Internal webhook path: `x-service-key` + `x-user-id` headers bypass auth check.  
**Gate:** `activity_intelligence` — returns 403 for free tier.

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
| **429** | **Per-user AI rate limit exceeded (SEC-15, 2026-09-20).** Interactive callers only — the internal post-run ingest path is NOT limited, because a finished run must still analyse. ⚠️ Rate limit only, no body-size cap: this route reads a body, so `guardAiRequest`'s byte arm would also apply, but it is deliberately out of scope until real payload sizes are measured. ⚠️ Fails open by design. |

## Notes

- Upserts to `run_analysis` table (conflict key: `user_id, strava_activity_id`).
- AI feedback via claude-haiku (max 200 tokens). Silent fallback — row is written regardless of AI result.
- Internal webhook path (called by Strava webhook handler): sets `tier = 'trial'` for enrichment and fires a push notification.
- Scoring weights: HR 50%, distance 25%, pace 15%, EF 10%. See `lib/coaching/constants.ts`.

## Sibling route — POST `/api/analyse-run/manual`

Coaching row for a session completed without a linked device activity. Writes `run_analysis` with `source='manual'` (DELETE+INSERT idempotent per session — partial unique index `run_analysis_manual_uniq`).

**Body:** `{ week_n, session_day, session_type, rpe?, fatigue_tag?, distance_km?, duration_s?, avg_hr? }`. Requires at least one of: `rpe`, `fatigue_tag`, or (`distance_km` + `duration_s`).

**Tier behaviour (DS-06):**
- **FREE** — verdict + one-line note from RPE/fatigue (`deriveManualVerdict` / `manualFeedbackText`); numeric scores null.
- **PAID/trial with metrics** — additionally runs `scoreSession` on the entered distance/pace + a coarse avg-HR-vs-band read (`hr_target` ceiling fallback), writing `distance_score` / `pace_score` / `hr_discipline_score` / `total_score` + a metric-anchored verdict. `hr_in_zone_pct` stays null (a single avg HR is not a stream). Gated on `activity_intelligence`.

The run itself is stored separately as a `source='manual'` row in `strava_activities` via the `/api/health/ingest` manual branch (see ADR-011 §4b) — that row is what counts in history / cohorts / load.

## Data scoping — PLAN-WEEK-COLLISION-01 (2026-09-18)

Every read this route makes against a **week-keyed** table
(`session_completions`, `run_analysis`, `session_overrides`,
`session_metric_overrides`, `session_reflections`) filters
`superseded_at IS NULL`, so it sees the LIVE plan only.

`week_n` is a within-plan coordinate: a new race plan restarts `week.n` at 1 and
would otherwise resolve against the previous plan's rows. No request or response
shape changes — this is a scoping guarantee, and the route's output for a runner
on their first plan is byte-identical to before.

⚠️ Reads that resolve a **RUN** rather than a week (`apple_health_uuid`,
`strava_activity_id`) are deliberately NOT filtered: `run_analysis` is
`UNIQUE (user_id, apple_health_uuid)`, so hiding a superseded row would make the
caller believe none exists and the follow-up insert would violate the constraint.

Enforced by `lib/plan/supersedeCoverage.test.ts`.

## The Anthropic call — OPS-AI-OWNER-01 (2026-09-20)

This route no longer calls Anthropic directly. It goes through
**`lib/ai/callAnthropic.ts`**, the single owner, as surface **`analyse-run`**.

- **Behaviour is unchanged.** Same URL, same headers, same body, same silent
  fallback (ADR-006 — the deterministic path always succeeds, AI is enrichment).
- **Every call is now recorded**: `ai_call` with real token counts and an
  estimated cost, or `ai_call_failed` with the reason, status and a truncated
  body. Read them at `GET /api/ops/ai-spend`.
- **A 2xx whose body is not JSON is now a failure**, not an empty answer. This
  route previously could not tell those apart.
- `noRawAnthropicCalls.test.ts` fails the build if this file names
  `api.anthropic.com` again. Full contract: `docs/contracts/api/ops-ai-spend.md`.

## Display units reach the limiter (UNITS-DURATION-01, 2026-09-23)

`inferLimiter` takes a **required** `units`, because its `reasoning` string is interpolated
verbatim into the `sessionFeedback` prompt — which makes it a display surface under ADR-015's
amendment: a number handed to the model becomes user-facing the moment the model repeats it.
No request or response shape changed.

- The `getUserDisplayPrefs` read was **already in this route**, just *after* the `inferLimiter`
  call. It is now hoisted above it.
- ⚠️ **Three figures, two KINDS, three owners.** `paceFade` is a RATE (`formatPaceDelta`), the two
  halves are PACES (`formatPace`), the shortfall is a DISTANCE (`formatDistance`). A blanket
  `/km`→`/mi` rename would have relabelled the rate without converting it — `15s/km` becoming
  `15s/mi`, which is not any rate at all.
- ⚠️ `units` is **required, not defaulted**: a rate restated in the wrong unit is silently wrong
  rather than obviously wrong.

## EMAIL-WAVE-3 — the First-read email fires from here

**After the upsert, and only then.** When `isFirstAnalysis` is true, the upsert
succeeded, and this is not a `scores_only` re-score, the route calls
`sendFirstReadEmail` (`lib/email/firstRead.ts`).

| Guard | Why |
|---|---|
| **After the upsert** | Built from `analysisRow`, never a re-query: a read-back would race the write, and the numbers in the email must be the numbers stored |
| **`!upsertRes.error`** | An email saying *"here is your first run, read"* about a row that did not persist taps through to nothing |
| **`!scores_only`** | A re-score has no coach note to read |
| **The stamp, not the count** | `isFirstAnalysis` is computed from `count === 0` **before** the upsert, so a retried or re-scored analysis can present as "first" more than once. `user_settings.first_read_email_sent_at` is what makes it once |
| **Stamped only on `sent`** | A suppressed runner who later resubscribes must still receive their first read |

⚠️ **The email never fails the analysis.** The whole call is wrapped and logged; a
runner waiting on their run does not wait on an inbox.

🔴 **`isFirstAnalysis` now has TWO consumers** — the AI prompt (its original job)
and this trigger. Changing its definition changes who gets an email, which is not
obvious from where it is computed.

Full email contract: `docs/contracts/api/email.md`.
