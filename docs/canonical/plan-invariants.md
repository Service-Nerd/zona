# Plan Invariants — Constitutional Layer

This is the mechanical enforcement layer for `CoachingPrinciples.md`. Every rule
here corresponds to a section in the principles doc and is checked on every
generated plan via `lib/plan/invariants.ts → validatePlan()`.

**Authority chain:**
- Principle defined in `CoachingPrinciples.md`
- Numeric value defined in `lib/plan/generationConfig.ts → GENERATION_CONFIG`
- Mechanical check defined in `lib/plan/invariants.ts`
- Output verified by `validatePlan()` on every `generateRulePlan()` call

When all three layers agree, the engine is provably honouring its own
constitution. When the layers disagree, **the engine has a defect** —
not the principle.

## Enforcement

`generateRulePlan()` calls `validatePlan()` on its output:
- In `NODE_ENV=development` or `NODE_ENV=test`: **throws** on `error`-severity violations.
- In production: logs to `console.error` and returns the plan (failing soft for users).

The matrix script `scripts/r23-phase7-validation.ts` runs all archetype cases
under `NODE_ENV=test`, so any new violation breaks the matrix.

The property sweep `scripts/property-validate-plans.ts` generates plans across
a wide grid of inputs (race × fitness × days × volume × injuries × ...) and
runs `validatePlan()` on each. Designed to catch combinations no archetype covers.
Exit 1 on any violation.

## Active invariants

| Code | Principle Ref | Severity | What it checks |
|---|---|---|---|
| `INV-PLAN-MIN-SESSION-SIZE` | `CoachingPrinciples §9` | error | Every placed session ≥ `MIN_SESSION_DISTANCE_KM[type]`. Below this, "the session is too short to be coaching-meaningful." |
| `INV-PLAN-EMPTY-SESSION` | `CoachingPrinciples §9` | error | No session has both distance and duration zero. |
| `INV-PLAN-LONG-IS-LONGEST` | `CoachingPrinciples §9` | error | The long run is at least `LONG_RUN_MIN_RATIO_VS_EASY` × every easy run in the same week. |
| `INV-PLAN-LONG-CAP-MINS` | `CoachingPrinciples §9` | error | Long run duration ≤ `LONG_RUN_CAP_MINUTES[distance]`. |
| `INV-PLAN-WEEK-1-2-LONG-CAP` | `CoachingPrinciples §9` | error | First two weeks: long run ≤ `longest_recent_run × WEEK_1_2_LONG_RUN_CAP_MULTIPLIER` (or floor, whichever is higher). |
| `INV-PLAN-QUALITY-PER-WEEK` | `CoachingPrinciples §8` | error | Quality session count per week ≤ `QUALITY_SESSIONS_PER_WEEK_MAX[fitness]`. |
| `INV-PLAN-QUALITY-LONG-SPACING` | `CoachingPrinciples §7` | error | Quality session is at least `MIN_HOURS_BETWEEN_QUALITY_AND_LONG / 24` days from the long run. |
| `INV-PLAN-MAX-WEEKDAY-MINS` | Life-first | error | Every weekday session duration ≤ `input.max_weekday_mins` when the user has set one. |

## Out of scope (deliberately)

**Week-on-week volume cap (`MAX_WEEKLY_VOLUME_INCREASE_PCT`).** This is enforced
by `buildVolumeSequence` on the planning array, but the per-week sum on the
plan output can deviate due to legitimate session-level floors (e.g. weeks 1-2
where `longest_recent × 1.10` collides with `MIN_SESSION_DISTANCE_KM.long`).
Output-level checking would produce false positives. The cap belongs at the
volume-sequence layer where it's already enforced.

## Adding a new invariant

1. Identify the principle in `CoachingPrinciples.md`. If it's not there, write
   it first — INV-CFG-002 ("principle backstop").
2. Confirm the numeric lives in `GENERATION_CONFIG` (or a sibling config). If
   it's hardcoded, promote it first — INV-CFG-001 / N-013.
3. Add the check to `validatePlan()` with a `code`, `principle_ref`, and severity.
4. Add the row to the table above.
5. Run the matrix and the property sweep. Address any violations the new check surfaces.
