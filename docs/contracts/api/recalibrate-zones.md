# API Contract — /api/recalibrate-zones

**Method:** POST  
**Auth:** Bearer token (paid/trial).  
**Gate:** `dynamic_reshape_r20` — returns 403 for free tier.

## Request body

```json
{
  "benchmark": {
    "type": "race",
    "distance_km": 10,
    "time": "00:48:30",
    "benchmark_date": "2026-10-04"
  }
}
```

`benchmark` fields all required (`type`, `distance_km`, `time`). Returns 422 if any are missing.

`type` values: `"race"` | `"tt_30min"`. ⚠️ **This line said `"time_trial"` until 2026-10-16**, and the in-plan 5K time trial (`DashboardClient.handleRecalConfirm`) sent exactly that — a value `BenchmarkInput` and `PlanSchema` do not have, so every in-plan recalibration stored a benchmark the canonical schema rejects. It now sends `"race"`: a timed 5K is a race-shaped benchmark. Nothing reads `.type`.

`benchmark_date` (optional, ISO `YYYY-MM-DD`): when it was run. §42's staleness discount reads it; absent means fresh. Update Paces collects it since `BENCHMARK-INPUT-01` (2026-10-16).

**Plausibility (§55 Amendment 1, `BENCHMARK-IMPOSSIBLE-01`):** the benchmark passes `assertPlausibleBenchmark` **before the plan is read** — the same gate plan generation runs. A raw VDOT above `BENCHMARK_VDOT_MAX` (85; world records 85.3–85.6) or a future `benchmark_date` returns 422 `{ error, field, value, range }`, where `error` is the runner-facing sentence (e.g. *"Bit quick for a human. Enter your finish time."*) and `field` is `benchmark_time` / `benchmark_tt_distance` / `benchmark_date`.

## Response — 200

```json
{
  "plan": { /* full updated Plan object with recalibrated zones */ },
  "weeks_updated": 8
}
```

`weeks_updated` = number of weeks from the current week to end of plan.

## Error responses

| Status | Condition |
|--------|-----------|
| 401 | No valid session |
| 403 | Free tier |
| 404 | No plan found — the runner genuinely has no plan. ⚠️ **Until 2026-09-25 this also fired for runners who DID have one** (`RECALIBRATE-ZONES-COOKIE-CLIENT-01`): the route authenticates off the Bearer token but read the plan with the cookie client, and on native the cookie session is absent, so the read hit RLS with no session and returned nothing. It now uses the service client and passes the gist/legacy fallback, so an un-migrated `plans` row self-heals rather than 404ing. |
| 422 | Invalid or missing benchmark fields · or a benchmark that is not humanly possible / dated in the future (§55 Am. 1) |
| 500 | Unexpected server error |

## Notes

- Recalculates VDOT from the new benchmark, then re-prices every session from the current week onwards.
- Uses `applyRecalibration()` from `lib/plan/ruleEngine.ts`.
- Saves updated plan via `savePlanForUser` (archives previous plan to `plan_archive`).
- Does not affect completed weeks.

## What a recalibration writes — §125, `RECAL-PACE-TWO-WRITER-01` (2026-10-09)

The authoritative list is `GENERATION_CONFIG.RECALIBRATION_SCOPE`, enforced at the write by
`lib/plan/recalibrationScope.ts → writeScoped`, which **throws outside production** on an
undeclared field. This section is the prose mirror; the constant is the contract.

| Target | Fields written |
|---|---|
| any re-priced session | `pace_target` |
| quality / tempo / intervals | `pace_target`, `distance_km` *(declared; clause 3 deferred, see below)* |
| each `derived_set` step | `pace` |
| `plan.meta` | `vdot`, `vdot_training_anchor`, `benchmark`, `vdot_discount_applied_pct` |
| a race session past the §120 Am. 2 line (`race_opening_pace` set) | `race_opening_pace`, and the opening sentence in `coach_notes` *(RACE-DAY-PACE-WITHHELD-01, 2026-10-27; §80 Am. 2)* |

🔴 **IT NO LONGER WRITES `hr_target`, AND THIS LINE USED TO SAY IT DID.** The old writer put
`zones.qualityHR` on every quality, tempo and intervals session, so a VO2max row kept
`zone: "Zone 4–5"` and was handed **threshold** HR — measured at **45 sessions across 36 plans, at
every recalibration magnitude including a no-op.** HR zones derive from max and resting HR (§14),
neither of which a *benchmark* moves, so the correct write is no write. `applyHrToPlan` remains the
owner of applying HR to a plan.

**Three guarantees callers may rely on:**

1. **The work-minute dose is never written.** A structured session's `duration_mins` comes from its
   rep structure (§8 Am., §40b Am. 2), and clause 1 of §125 protects it (Willy, binding).
2. **Re-derivation only, never re-selection.** No variant changes and no session is substituted, so
   `catalogue_id` and every step LENGTH are stable across a recalibration.
3. **A no-op is a no-op.** Re-pricing scales the stored band rather than recomputing it, so
   recalibrating to the benchmark the runner already holds returns a **byte-identical** `weeks`.

⚠️ **The race opening is rewritten from the NEW VDOT and never made faster than goal pace.** Only a race
session that already carries `race_opening_pace` is touched (a plan inside the line opens at goal pace and keeps it).
The goal-pace withholding decision itself (`meta.goal_pace_reach`) is **not** re-decided by a recalibration: the
sessions keep what was prescribed, which is `RECAL-GOAL-REACH-01`, open.

⚠️ **A step is re-priced only when it reads what its anchor meant at the OLD fitness.** Anything
else was set by a writer this route does not own — §22's goal substitution is the live case — and is
left alone, so a goal-paced rep is never silently re-aimed at the runner's new threshold.

🔻 **Clause 3 of §125 — re-deriving `distance_km` — is RULED AND NOT YET BUILT.** It introduces
10–13 `INV-PLAN-DELIVERED-RAMP` breaches per 36 plans in the ±4–8% band that is the common case.
The field stays in `RECALIBRATION_SCOPE` because that is the ruled destination; nothing writes it
today. Filed as `RECAL-DISTANCE-CLAUSE3-01`.

**Gated by** `INV-PLAN-STEP-PACE-FROM-GUIDE` (error severity, so `savePlanForUser` records it and
the daily `ops/plan-audit` cron surfaces it) and `lib/plan/recalibrationComposition.test.ts`, which
is the **first check ever to run a recalibrated plan** — before it, zero harnesses called
`applyRecalibration`.
