# `GET /api/pre-session-readiness`

**Written 2026-09-27** to close a `CONTRACT-COVERAGE-01` gap `audit-docs.sh` surfaced when
`LOG-OFFPLAN-01` renamed two fields in this route's `checkAdjustmentTriggers` call.

The only adjustment trigger that fires **before** a run rather than after. Called by
`TodayScreen` on mount. Returns a `ProposedAdjustment` when today's quality or long session
should be softened against the runner's 14-day recovery baseline, and `null` otherwise.

**Owner:** `CoachingPrinciples §59`. **Tier:** PAID — gated on `activity_intelligence`.

## Request

`GET`, bearer token. **`?date=YYYY-MM-DD`** (READINESS-WRONG-DAY-01, 2026-10-17): the runner's LOCAL date. The
dashboard sends it; without it the route falls back to the server's UTC date, which read runners a day off.

## Responses — 200 in every non-auth case but one

**A `null` adjustment is the normal, healthy answer**, so this route never signals "nothing to
say" with an error status. `reason` names which gate ended the evaluation, in evaluation order:

| `reason` | Meaning |
|---|---|
| `tier` | Free user. **Silent by design** — the readiness signal is paid value and a free runner is never told it exists here |
| `no_plan` | No plan, or a plan with no weeks |
| `overrides_unavailable` | The runner's moves (`session_overrides`) could not be read. READINESS-OVERRIDES-01: today's session includes their moves, so a failed read eases nothing rather than act on a session it cannot place |
| `no_active_session` | `getSessionsForDate()` (with the runner's live overrides) returned no session: before the plan starts, after it ends, a gap, or an empty day (ADR-016) |
| `strength_only` | **STRENGTH-RECOVERY-01 (2026-10-18).** No run to ease today, but an easeable strength session (`strengthSessionOn`, not mobility) and recovery is off. Returns `{ adjustment: null, detail, signals: { isElevatedRHR, isLowHRV, isShortSleep, isPoorSleepQuality }, warranted: true }`. No row is written; the runner's answer goes to `/api/strength/ease`. Without a lift the day keeps its old reason (`no_active_session` / `session_type_not_eligible`) |
| `session_type_not_eligible` | Today is not quality or long. §59 softens hard days only. On a day holding two sessions the quality or long one is the target, else the first; a §126 double is two easy runs, so it lands here |
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
- `500 { adjustment: null, reason: 'engine_error' }` — `checkAdjustmentTriggers` threw. Recorded as a
  `readiness_failed` ops event, because the only caller swallows this route's failures.

**`warranted` (2026-10-18):** every response after the reading is computed says whether recovery is off
(`all_clear` → `false`; `strength_only`, `no_trigger` and the adjustment paths → `true`), so Today can offer the
lift beside or without a run row. `detail.sleepBaseline` (window mean) feeds the card's *"You usually get 7h 30."*,
display only: sleep fires on an absolute threshold.

## The stored change — READINESS-WRONG-DAY-01 (2026-10-17)

- 🔴 **Until this date the route handed the engine ONE session and the engine's 7-entry guard threw**, so
  every softening crashed (0 readiness changes ever reached a runner). It now passes the whole week
  (`orderedWeekSessions`) and `buildReadinessAdjustment` changes **only** the session on
  `trigger_detail.sessionDay` (the key the session is stored under; `displayDay` is where it shows).
- `sessions_before` / `sessions_after` are **seven entries, Mon → Sun**, as for every other trigger;
  `confirm-adjustment` / `revert-adjustment` write back only the days that differ.
- **The eased session carries `eased_for: 'recovery'` in `sessions_after`** (READINESS-SURFACE-01), so the
  "Eased for recovery" mark reaches the plan only when the runner confirms and leaves with a revert (which
  writes `sessions_before`, unstamped). `SessionSchema` keeps the field; `lib/ui/easedMark.test.ts` asserts it.
- `trigger_detail.sessionDate` stamps the day. A pending readiness change from an earlier date is closed as
  `reverted` on the next run (it never applied), so a stale card cannot surface.

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


## Plan read — PLANS-SINGLE-NOT-MAYBE-01 (2026-10-16)

The `plans` row is read through `readPlanJson` (`lib/planRead.ts`), the one owner of that query. It uses
`.maybeSingle()`, so a runner with **no plan is `null` with no error**, not the PostgREST 406 that made up 89
of 94 Supabase warnings in a day. **A database error is now logged and the route carries on as it does with no plan**, because the plan is optional here. It used to be silent.

## Session classification — QUALITY-TYPE-NO-OWNER-01 (2026-10-24)

`isQualityOrLong` now reads `isQualityType` from `lib/plan/sessionRole.ts` instead of a hand-written list. The answer
is identical for every label this route sees (it reads a `coachingSessionType` label, which already names the long run
`'long'`). No shape change.
