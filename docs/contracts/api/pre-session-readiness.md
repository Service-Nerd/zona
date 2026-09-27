# `GET /api/pre-session-readiness`

**Written 2026-09-27** to close a `CONTRACT-COVERAGE-01` gap `audit-docs.sh` surfaced when
`LOG-OFFPLAN-01` renamed two fields in this route's `checkAdjustmentTriggers` call.

The only adjustment trigger that fires **before** a run rather than after. Called by
`TodayScreen` on mount. Returns a `ProposedAdjustment` when today's quality or long session
should be softened against the runner's 14-day recovery baseline, and `null` otherwise.

**Owner:** `CoachingPrinciples §59`. **Tier:** PAID — gated on `activity_intelligence`.

## Request

`GET`, bearer token. No body, no query parameters.

## Responses — 200 in every non-auth case, deliberately

**A `null` adjustment is the normal, healthy answer**, so this route never signals "nothing to
say" with an error status. `reason` names which gate ended the evaluation, in evaluation order:

| `reason` | Meaning |
|---|---|
| `tier` | Free user. **Silent by design** — the readiness signal is paid value and a free runner is never told it exists here |
| `no_plan` | No plan, or a plan with no weeks |
| `no_active_session` | `getSessionForDate()` returned null: before the plan starts, after it ends, a gap, or an empty day (ADR-016) |
| `session_type_not_eligible` | Today is not quality or long. §59 softens hard days only |
| `baseline_dormant` | Fewer than `READINESS` requires of the 14-day window. ⚠️ **Not an error** — a new runner has no baseline yet |
| `all_clear` | Baseline exists and today's RHR / HRV / sleep are within it |
| `no_trigger` | Readiness deviated, but `checkAdjustmentTriggers` did not return an adjustment |

```jsonc
{ "adjustment": null, "reason": "all_clear", "detail": { /* readiness detail */ } }
{ "adjustment": {/* ProposedAdjustment */}, "detail": {...}, "persisted": true }
```

- `persisted: false` — the adjustment was computed but the insert did not land. The runner still
  sees it this session; it is not durable.
- An **existing** pending adjustment is returned as-is rather than creating a duplicate, matching
  `/api/adjust-plan`.
- `401 { error: 'Unauthorized' }` — no bearer token, or no user-scoped client.

## What this route does NOT do — LOG-OFFPLAN-01 (2026-09-27)

🔴 **It never exercises the load triggers, and that is deliberate.** It passes
`linkedKm: 0`, `offPlanKm: 0` and `priorWeeksKm: []` into `checkAdjustmentTriggers`, so the
acute:chronic ratio and shadow load cannot fire here. This route answers *"is the runner
recovered enough for today?"*, not *"how much have they run?"* — the second question is
`/api/adjust-plan`'s and runs on a different cadence.

⚠️ **Those two fields replaced a single `actualKm: 0`.** The field was **removed rather than
redefined** so the compiler would name every call site (`weeklyActualLoad.ts` is the owner of
the split). If a future change gives this route real load figures, that is a coaching decision
about whether §59 may stack with §2 — not a plumbing change.

## Security — SEC-08

🔴 **Per-request user-scoped (JWT) client, never memoised.** This was a module-scoped
`_supabase ??= ...`. Memoising is harmless for the service role, which has no identity, and is a
**security hazard** for a per-user JWT client: the first caller's token is captured in module
scope and reused for every request on that warm instance, **serving one runner another runner's
data**. The memo is gone, not repointed.

`plans`, `health_daily_samples` and `plan_adjustments` are policy-covered for the operations
here; `rlsCoverage.test.ts` enforces that on every build.
