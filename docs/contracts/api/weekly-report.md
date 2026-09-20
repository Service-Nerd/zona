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
| **429** | **Per-user AI rate limit exceeded (SEC-15, 2026-09-20).** Interactive callers only — the internal cron path (`x-service-key` + `x-user-id`) is deliberately NOT limited, because rate-limiting it would silently stop a runner's scheduled report. ⚠️ Not a hard cap: `checkAiRateLimit` FAILS OPEN on an RPC error or unreachable DB, by design. |

## Notes

- Returns existing report for the current week unless `?force=true`.
- Keyed by the current week's canonical `week.n` (ADR-013), not array position — so `session_completions` / `run_analysis` reads land on the maintenance plan's rows (26+), never the archived race plan's rows at the same array index.
- Aggregates `session_completions` + `run_analysis` + load history for the current week.
- AI generates Headline/Body/CTA via claude-haiku (max 300 tokens). Silent fallback to rule-based strings.
- Internal cron path used by `/api/push/send-weekly-report`.

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
**`lib/ai/callAnthropic.ts`**, the single owner, as surface **`weekly-report`**.

- **Behaviour is unchanged.** Same URL, same headers, same body, same silent
  fallback (ADR-006 — the deterministic path always succeeds, AI is enrichment).
- **Every call is now recorded**: `ai_call` with real token counts and an
  estimated cost, or `ai_call_failed` with the reason, status and a truncated
  body. Read them at `GET /api/ops/ai-spend`.
- **A 2xx whose body is not JSON is now a failure**, not an empty answer. This
  route previously could not tell those apart.
- `noRawAnthropicCalls.test.ts` fails the build if this file names
  `api.anthropic.com` again. Full contract: `docs/contracts/api/ops-ai-spend.md`.
