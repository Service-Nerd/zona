# Backlog — 2026-04-28 Review (Case 04 — Marathon)

Single-case backlog triggered by an under-resourced marathon plan. The headline item (H-01) is a new validation layer that runs *before* generation; the rest are tightening existing invariants and adding new ones.

IDs scoped to this round (`2026-04-28/H-01` etc.).

**UX decision (locked):** H-01 uses **two-step warn-and-acknowledge**. First call returns the warning + alternatives without generating. Second call with `acknowledged_prep_warning: true` proceeds. This is reflected in the snippets below — do not change.

---

## ⚠️ Regression-safety preface — READ FIRST

This round adds new principles that interact with existing ones from rounds one and two. Before any [HIGH] work begins, Claude Code must complete the following audit. **Do not modify any generator code until this audit is complete and you have confirmed the existing principles are preserved.**

### Audit checklist

1. **Read every principle currently in `docs/canonical/CoachingPrinciples.md`.** Build a mental map of what each one does.

2. **Read every invariant function in `lib/plan/invariants.ts`.** Build a mental map of what each one asserts.

3. **For each [HIGH] item in this backlog, identify which existing principles/invariants it might interact with.** Flag any conflicts before writing code.

4. **Confirm the generator entry point.** H-01 wraps generation with validation. Verify all code paths that call generation (tests, scripts, API endpoints, regression suite) go through the same wrapper. If any bypass it, fix that first or the validator won't fire.

### Known interaction risks (pre-flight)

These are the interactions I've already identified. Resolve each one explicitly. **If you find additional interactions during audit, add them to this list and resolve them before proceeding.**

| New rule | Interacts with | Risk | Resolution |
|---|---|---|---|
| H-01 prep-time validator | Round-one H-06 (maintenance downgrade) | Both downgrade plans for different reasons; could produce conflicting meta notes | Validator runs first. If `warn` + acknowledged, plan proceeds and may also be downgraded by H-06. Both notes coexist. |
| H-02 long-run progression cap | Round-one H-07 (peak long-run floor) | Compressed plans may need a peak long-run that violates the +20% cap | H-02 wins — cap is universal. If H-07's floor cannot be reached without violating H-02, plan downgrades to maintenance and adds prep-time warning. |
| H-03 marathon volume floor | Round-one H-06 (maintenance downgrade) | Both can trigger maintenance downgrade for marathon | If H-03 fails AND plan length is below H-01's `ok` threshold, route through H-01's warning flow. If above `ok` but volume insufficient, use H-06's downgrade. |
| H-04 peak long-run alternation | Round-one H-08 (race-specific long run required) | If peak is 2 weeks and only one can be a peak long run, the single peak long run must carry all H-08 specificity | Acceptable. H-08 says "≥1 long run with race-pace segments in peak phase" — one is enough. |
| H-01 returning-runner threshold shift | Round-one M-02 / round-two M-03 (returning-runner volume scaling) | Both fire on returning runners | These are independent: M-02/M-03 scale starting volume, H-01 shifts prep-time thresholds up. Both apply, neither cancels the other. |
| L-01 input validation | Existing input handling | Tightening might reject inputs that previously passed | Add validation behind a feature flag for one release. Compare regression-suite results before/after. |

### What "preserve existing principles" means concretely

- Every invariant in `lib/plan/invariants.ts` that exists today MUST still exist after this round and MUST still pass on the original three test cases (Sarah, Mark, Anna).
- Round-two backlog items still in flight (`docs/coaching-review/2026-05-25/backlog.md`) are not affected by this round. Do not touch them.
- The original three test cases must still generate successfully. Their plan structures should be largely unchanged. The only diff should be: any new meta fields added by this round (e.g. `prep_time_status: 'ok'`).

### Before opening any PR

Run the full regression suite against all four cases (the original three plus Case 04 inputs). Confirm:

1. Original three cases generate with `prep_time_status: 'ok'`. No structural changes to their plans.
2. Case 04 inputs return `prep_time_status: 'warn'` without `acknowledged_prep_warning`. No plan generated.
3. Case 04 inputs WITH `acknowledged_prep_warning: true` generate a plan that fails H-02, H-03, and H-04 invariants — and consequently downgrades to `maintenance` with both a `prep_time_warning` and a `volume_constraint_note`.
4. All previously-passing invariants from rounds one and two still pass.

---

## [HIGH] — Refusal mechanism and structural caps

### H-01 — Prep-time validation per race distance (two-step UX)
**Source:** Case 04. Engine generated a time-targeted marathon plan with 11 weeks of prep without any warning.
**Files:** `lib/plan/inputs.ts` (new validation layer), `lib/plan/index.ts` (generator entry point), `docs/canonical/CoachingPrinciples.md`, plan output schema, all generator entry points

**The dominant fix in this round.**

**Acceptance criteria:**
- Pre-generation validator `validatePrepTime(input)` returns one of: `ok`, `warn`, `block`.
- `block`: generation refuses with error explaining why and listing alternatives. No plan returned.
- `warn` without `acknowledged_prep_warning: true`: generation refuses, returns warning + alternatives. No plan returned.
- `warn` with `acknowledged_prep_warning: true`: generation proceeds. Plan meta includes `prep_time_status: 'warned'`, `prep_time_warning`, and `prep_time_alternatives`.
- `ok`: generation proceeds. Plan meta includes `prep_time_status: 'ok'`.
- Returning runners (`returning_runner_allowance_active: true` OR `weeks_at_current_volume < 8` OR layoff inferred): all thresholds shift up by 2 weeks.
- For `goal: finish`, only `block` thresholds apply (the `warn` zone is treated as `ok`). Time goals are stricter than finish goals.
- **Validator runs at every generator entry point.** Audit the codebase for every call site that produces a plan and ensure none bypass the validator.

**Minimum weeks per race distance:**

| Race distance | Block threshold | Warn threshold | OK threshold |
|---|---|---|---|
| ≤5K | <4 weeks | 4–7 weeks | ≥8 weeks |
| 10K | <6 weeks | 6–9 weeks | ≥10 weeks |
| HM | <8 weeks | 8–11 weeks | ≥12 weeks |
| Marathon | <10 weeks | 10–15 weeks | ≥16 weeks |
| Ultra (>42.2km) | <14 weeks | 14–19 weeks | ≥20 weeks |

**Principle to add:**
```markdown
### Prep-time validation (refusal mechanism)

Before generating, the engine MUST validate that the runner has adequate
preparation time for the chosen race distance and goal type. The engine
is not obligated to produce a plan when the inputs cannot support a
coachable outcome.

Minimum weeks of preparation by race distance:

| Distance | Block | Warn | OK |
|---|---|---|---|
| ≤5K | <4 | 4–7 | ≥8 |
| 10K | <6 | 6–9 | ≥10 |
| HM | <8 | 8–11 | ≥12 |
| Marathon | <10 | 10–15 | ≥16 |
| Ultra | <14 | 14–19 | ≥20 |

For returning runners (layoff >8 weeks, returning_runner_allowance_active,
or weeks_at_current_volume < 8), shift all thresholds up by 2 weeks.

For `goal: finish`, only `block` thresholds apply. The `warn` zone is
treated as `ok`. Finish goals are achievable on shorter timelines than
time goals.

When validation returns:
- **block**: refuse generation. Return error explaining why and listing
  alternatives: defer race, change distance, change goal to "finish".
- **warn**: refuse generation unless input includes
  `acknowledged_prep_warning: true`. Return the warning with alternatives.
  This is a two-step pattern: first call surfaces the warning, second
  call (with explicit acknowledgment) generates.
- **ok**: proceed normally.

Plans generated under a warn condition MUST include a `prep_time_warning`
field in plan meta explaining the constraint and what was sacrificed.

This principle composes with existing principles: a plan that proceeds
under `warn` must still satisfy all other invariants. Failure modes
that result (e.g. inability to reach peak volume floor) flow through
existing downgrade mechanisms (maintenance label, volume_constraint_note).
```

**Validator snippet:**
```typescript
// lib/plan/inputs.ts
export type PrepTimeStatus = 'ok' | 'warn' | 'block';

export interface PrepTimeResult {
  status: PrepTimeStatus;
  message?: string;
  alternatives?: string[];
  weeks_available?: number;
  weeks_required_ok?: number;
  weeks_required_block?: number;
}

const PREP_THRESHOLDS = {
  '5K':       { block: 4,  warn: 8 },
  '10K':      { block: 6,  warn: 10 },
  'HM':       { block: 8,  warn: 12 },
  'marathon': { block: 10, warn: 16 },
  'ultra':    { block: 14, warn: 20 },
};

function distanceKey(km: number): keyof typeof PREP_THRESHOLDS {
  if (km <= 5) return '5K';
  if (km <= 10) return '10K';
  if (km <= 21.5) return 'HM';
  if (km <= 42.5) return 'marathon';
  return 'ultra';
}

function isReturning(input: PlanInput): boolean {
  if (input.returning_runner_allowance_active) return true;
  if (input.weeks_at_current_volume !== undefined && input.weeks_at_current_volume < 8) return true;
  // Add other inferred-layoff conditions if available
  return false;
}

export function validatePrepTime(input: PlanInput): PrepTimeResult {
  const weeks = weeksBetween(input.plan_start, input.race_date);
  const distKey = distanceKey(input.race_distance_km);
  const thresholds = PREP_THRESHOLDS[distKey];
  const shift = isReturning(input) ? 2 : 0;
  const blockAt = thresholds.block + shift;
  const warnAt  = thresholds.warn  + shift;

  if (weeks < blockAt) {
    return {
      status: 'block',
      message: `${weeks} weeks is not enough preparation for a ${distKey}. Minimum is ${blockAt} weeks${shift ? ' for a returning runner' : ''}.`,
      alternatives: alternativesFor(distKey, weeks, input),
      weeks_available: weeks,
      weeks_required_ok: warnAt,
      weeks_required_block: blockAt,
    };
  }

  // For finish goals, the warn zone is treated as ok
  if (weeks < warnAt && input.goal === 'time_target') {
    return {
      status: 'warn',
      message: `${weeks} weeks is below the recommended ${warnAt}-week minimum for a time-targeted ${distKey}. The plan can be generated but the time goal may not be achievable safely.`,
      alternatives: alternativesFor(distKey, weeks, input),
      weeks_available: weeks,
      weeks_required_ok: warnAt,
      weeks_required_block: blockAt,
    };
  }
  return { status: 'ok', weeks_available: weeks };
}

function alternativesFor(distKey: string, weeks: number, input: PlanInput): string[] {
  const alts: string[] = [];
  if (distKey === 'marathon' && weeks >= 8) {
    alts.push(`Race the half marathon at this event instead — ${weeks} weeks is adequate for an HM build.`);
  }
  if (distKey === 'HM' && weeks >= 6) {
    alts.push(`Race the 10K at this event instead.`);
  }
  if (input.goal === 'time_target') {
    alts.push(`Switch goal to "finish" — finish goals are achievable on shorter timelines.`);
  }
  alts.push(`Defer the race to one with at least ${PREP_THRESHOLDS[distKey].warn + (isReturning(input) ? 2 : 0)} weeks of prep.`);
  return alts;
}
```

**Generator entry point change:**
```typescript
// lib/plan/index.ts (or wherever generation is invoked)
export type GenerationResult =
  | { ok: true; plan: Plan }
  | { ok: false; reason: 'block' | 'warn_unacknowledged'; prep: PrepTimeResult };

export function generatePlan(input: PlanInput): GenerationResult {
  // 1. Input field validation (L-01) runs first
  const inputValidation = validateInputFields(input);
  if (!inputValidation.ok) {
    throw new Error(inputValidation.message);
  }

  // 2. Prep-time validation
  const prep = validatePrepTime(input);
  if (prep.status === 'block') {
    return { ok: false, reason: 'block', prep };
  }
  if (prep.status === 'warn' && !input.acknowledged_prep_warning) {
    return { ok: false, reason: 'warn_unacknowledged', prep };
  }

  // 3. Generate (existing logic, untouched)
  const plan = buildPlan(input);

  // 4. Annotate meta with prep status
  plan.meta.prep_time_status = prep.status === 'warn' ? 'warned' : 'ok';
  if (prep.status === 'warn') {
    plan.meta.prep_time_warning = prep.message;
    plan.meta.prep_time_alternatives = prep.alternatives;
  }

  return { ok: true, plan };
}
```

**Audit task (must complete before any other work in this round):**
- `grep -rn "buildPlan\|generatePlan" --include="*.ts" --include="*.js"` — find every call site.
- Confirm every entry point uses `generatePlan` (the wrapper), not `buildPlan` (raw generator) directly.
- The regression script `scripts/generate-coaching-review.ts` must use `generatePlan`. If it currently calls `buildPlan` directly, fix that first.

---

### H-02 — Long-run week-on-week progression cap (universal, no phase exemption)
**Source:** Case 04. W5 (10.5km) → W6 (30km) is a +185% jump.
**Files:** `lib/plan/longRun.ts`, `lib/plan/invariants.ts`

**Interaction note:** This invariant takes precedence over round-one H-07 (peak long-run floor). If H-07's floor cannot be reached without violating H-02, the plan downgrades to maintenance and surfaces the constraint. This is the same pattern as H-06's downgrade mechanism.

**Acceptance criteria:**
- Long-run progression MUST NOT exceed +20% week-on-week OR +5km absolute, whichever is greater.
- Applies in ALL phases including peak. No phase exemption.
- Exception: a long run following a deload may step back up to the pre-deload long run distance.
- If the floor required by H-07 cannot be reached without violating H-02, plan downgrades to maintenance with both a `volume_constraint_note` and a `long_run_constraint_note`.

**Invariant snippet:**
```typescript
export function longRunProgressionCap(plan: Plan): InvariantResult {
  for (let i = 1; i < plan.weeks.length; i++) {
    const prev = plan.weeks[i - 1];
    const curr = plan.weeks[i];
    if (curr.type === 'race') continue;

    const prevLR = longestSession(prev);
    const currLR = longestSession(curr);
    if (!prevLR || !currLR || !prevLR.distance_km || !currLR.distance_km) continue;

    // Step-back to pre-deload distance is allowed
    if (prev.type === 'deload') {
      const preDeload = i >= 2 ? longestSession(plan.weeks[i - 2]) : null;
      if (preDeload?.distance_km && currLR.distance_km <= preDeload.distance_km * 1.05) continue;
    }

    const allowedJumpKm = Math.max(prevLR.distance_km * 0.20, 5);
    const actualJumpKm = currLR.distance_km - prevLR.distance_km;

    if (actualJumpKm > allowedJumpKm) {
      return {
        ok: false,
        message: `W${curr.n} long run ${currLR.distance_km}km is a ${Math.round(actualJumpKm/prevLR.distance_km*100)}% jump from W${prev.n} (${prevLR.distance_km}km). Cap is +20% or +5km, whichever is greater.`,
      };
    }
  }
  return { ok: true };
}
```

---

### H-03 — Peak weekly volume floor for marathon and ultra
**Source:** Case 04. Peak weekly volume 46km for a 42.2km marathon.
**Files:** `lib/plan/volume.ts`, `docs/canonical/CoachingPrinciples.md`, `lib/plan/invariants.ts`

**Interaction note:** Composes with round-one H-06 (peak overload requirement). H-06 says peak ≥110% of W1. H-03 adds an absolute floor scaled to race distance for marathon/ultra. Both must be satisfied. If either fails, plan downgrades to maintenance.

**Acceptance criteria:**
- For marathon time-targeted plans, peak weekly volume MUST be ≥125% of race distance (≥53km for 42.2km).
- For ultra (50K range): ≥100% of race distance.
- For ultra (>55km): ≥80% of race distance, capped at 130km/week.
- For HM and below: no absolute floor (existing peak-vs-base ratio sufficient).
- If floor unreachable given constraints, plan downgrades to maintenance via existing H-06 mechanism.

**Invariant snippet:**
```typescript
export function peakVolumeFloorForLongRaces(plan: Plan, input: PlanInput): InvariantResult {
  if (input.goal !== 'time_target') return { ok: true };
  const dist = input.race_distance_km;

  let requiredFloor = 0;
  if (dist >= 40 && dist <= 43) requiredFloor = dist * 1.25;
  else if (dist > 43 && dist <= 55) requiredFloor = dist * 1.0;
  else if (dist > 55) requiredFloor = Math.min(dist * 0.80, 130);
  else return { ok: true };

  const peakVolume = Math.max(...plan.weeks.filter(w => w.phase === 'peak').map(w => w.weekly_km));

  if (peakVolume < requiredFloor) {
    if (plan.meta.volume_profile === 'maintenance') return { ok: true };
    return {
      ok: false,
      message: `Peak weekly volume ${peakVolume}km is below the ${Math.round(requiredFloor)}km floor for a ${dist}km race. Either increase volume, downgrade to maintenance, or trigger a prep-time warning.`,
    };
  }
  return { ok: true };
}
```

---

### H-04 — Consecutive peak long runs must alternate
**Source:** Case 04. W6 and W7 both 30km MP long runs back-to-back.
**Files:** `lib/plan/phase/peak.ts`, `docs/canonical/CoachingPrinciples.md`, `lib/plan/invariants.ts`

**Interaction note:** Round-one H-08 requires ≥1 long run with race-pace segments in peak phase. H-04 says no two consecutive peak long runs. If peak is 2 weeks long and only one week can be a peak long run, the single peak long run must carry the H-08 requirement. This is acceptable.

**Acceptance criteria:**
- Within peak phase, no two consecutive weeks may both contain a long run at ≥90% of peak distance with race-pace segments.
- Permitted patterns: peak / step-back / peak; or peak / deload / peak.
- Exception: runners with `hard_session_relationship: love`, no `injury_history`, and `training_age: 5yr+` may have one occurrence of consecutive peaks per plan.

**Principle to add:**
```markdown
### Peak long-run alternation

Two consecutive weeks of peak long runs (≥90% of peak distance with
race-pace segments) is overload without recovery. Within peak phase,
the engine MUST alternate:

- Peak long run → step-back long run (≤80% of peak distance, no race-pace)
- Peak long run → deload week
- Peak MP/HM-pace long run → easy long run

Exception: runners with `hard_session_relationship: love`, no injury
history, and `training_age` of `5yr+` may have one occurrence per plan.

This principle composes with H-08 (race-specific long run required in
peak phase). When peak is 2 weeks, only one week carries the peak long
run, and that single week must satisfy H-08.
```

**Invariant snippet:** (as in previous version, no changes needed)

---

## [MEDIUM] — Quality and communication

### M-01 — Marathon taper duration cap
**Source:** Case 04. 4-week taper compresses build phase.
**Files:** `lib/plan/phase/taper.ts`, `docs/canonical/CoachingPrinciples.md`

**Acceptance criteria:**
- Taper duration capped per race distance: 1 week for 5K/10K, 2 weeks for HM, 3 weeks for marathon, 3 weeks for ultra.
- Engine cannot allocate more weeks to taper than these caps. Excess weeks must go to base or build.
- Verify this doesn't conflict with existing taper logic for the original three test cases (their tapers should be unchanged: 1 week 5K, 1 week 10K, 2 weeks HM).

---

### M-02 — Returning-runner allowance must be communicated
**Source:** Case 04. `returning_runner_allowance_active: true` in meta but no user-visible explanation.
**Files:** plan output schema, `lib/plan/inputs.ts`

**Acceptance criteria:**
- When returning-runner allowance fires, plan meta includes a `returning_runner_note` describing what was scaled and why.
- Format matches `volume_constraint_note` pattern from round one.

---

### M-03 — Quality session variety across full plan
**Source:** Case 04. Three "Progressive tempo" sessions in 11 weeks with identical pace.
**Files:** `lib/plan/sessions/selection.ts`, `lib/plan/invariants.ts`

**Acceptance criteria:**
- Extends round-two M-02 (taper variety) to apply across the full plan.
- No single quality session label may appear more than `floor(total_quality_sessions / 3) + 1` times in a plan.
- Confirm this doesn't false-positive on the original three test cases — re-check round-two output.

---

### M-04 — Long run not more than 60% of weekly volume
**Source:** Case 04. W6 weekday runs cut to 4km each to fit a 30km long run; long run is 67% of weekly.
**Files:** `lib/plan/volume.ts`, `lib/plan/invariants.ts`

**Acceptance criteria:**
- No single run may exceed 60% of weekly volume.
- If long-run prescription forces this, EITHER reduce long run, OR raise weekly volume cap (if persona allows), OR downgrade.

---

## [LOW] — Validation and polish

### L-01 — Reject empty/invalid critical input fields
**Source:** Case 04. `resting_hr: 0` got past validation.
**Files:** `lib/plan/inputs.ts`

**Acceptance criteria:**
- `resting_hr`: must be 30–100 (rejects 0).
- `max_hr`: must be 120–220.
- `age`: must be 13–90.
- Validator runs before prep-time validation.
- **Backward compatibility:** check that no existing test inputs have out-of-range values that previously generated successfully. If any do, fix the test data — don't loosen the validator.

---

### L-02 — Add Case 04 to standard regression set
**Source:** Round-two recommendation.
**Files:** `docs/coaching-review/cases/04-marathon-intermediate.md`, regression suite

**Acceptance criteria:**
- Add Case 04 (with full persona inputs) as a permanent test case.
- Engine must produce a `warn` status for this case after H-01 ships.
- The case file documents the expected behaviour: warn without acknowledgment, generate-with-warnings if acknowledged.

---

### L-03 — HR data fallbacks with surfaced assumptions
**Source:** Case 04. `resting_hr: 0` got past validation and the engine still computed Zone 2 ceiling at 140 bpm using an undisclosed fallback. Runner has no way to know their zones were derived from incomplete data.
**Files:** `lib/plan/zones.ts` (or wherever HR zones are computed), `lib/plan/inputs.ts`, plan output schema, `docs/canonical/CoachingPrinciples.md`, `lib/plan/invariants.ts`

**Interaction note:** This composes with L-01 (reject invalid inputs). L-01 rejects out-of-range values (e.g. `resting_hr: 0`, `max_hr: 50`). L-03 handles *missing* values (undefined / null / not provided). The two must agree: L-01 rejects nonsense, L-03 fills gaps. A `resting_hr: 0` should be rejected by L-01 as invalid, not silently treated as missing by L-03.

**Acceptance criteria:**
- Four-level fallback hierarchy implemented:
  1. Both `max_hr` and `resting_hr` provided → Karvonen (HRR) method. No note.
  2. Only `max_hr` provided → percentage-of-max method. Surface `hr_assumption_note`.
  3. Only `resting_hr` provided → estimate max from age (`208 − 0.7 × age`), then Karvonen. Surface `hr_assumption_note`.
  4. Neither provided → estimate max from age, percentage-of-max method. Surface `hr_assumption_note` more prominently.
- The engine NEVER refuses to generate over missing HR data.
- All four levels still produce HR targets on every session — no silent stripping of HR data.
- Plan meta exposes which method was used in `hr_zone_method` field: `'karvonen'`, `'karvonen_estimated_max'`, `'percent_of_max'`, `'percent_of_estimated_max'`.

**Principle to add:**
```markdown
### HR data fallbacks (assumption surfacing)

The engine MUST generate plans even when HR inputs are incomplete. Missing
HR data does not block generation — it triggers a fallback with a surfaced
assumption.

Fallback hierarchy:

| Inputs provided | Method | Surfaced note |
|---|---|---|
| max_hr + resting_hr | Karvonen: `Z2 ceiling = resting + (max − resting) × 0.70` | None |
| max_hr only | Percent of max: `Z2 ceiling = max × 0.80` | "Zones derived from max HR only. Add resting HR for more accurate zones." |
| resting_hr only | Estimate max from age (`208 − 0.7 × age`), then Karvonen | "Max HR estimated from age (X bpm). Refine via field test." |
| Neither | Estimate max from age, percent of max | "Both max and resting HR missing. Zones estimated from age alone. Recommend HR field test in first 2 weeks." |

The engine NEVER refuses to generate due to missing HR inputs. The
philosophy: a working coach makes a starting estimate and refines from
feedback. The note pushes the runner toward better data without
withholding the plan.

Plan meta MUST include:
- `hr_zone_method`: which of the four methods was used.
- `hr_assumption_note`: the user-facing explanation (only present when
  not Karvonen-with-real-data).
- `hr_estimated_max` / `hr_estimated_resting`: any values the engine
  estimated, surfaced for transparency.

This principle composes with L-01 (input validation): nonsense values
(e.g. resting_hr: 0, max_hr: 50) are rejected by L-01 as invalid;
missing values trigger L-03 fallbacks.
```

**HR computation snippet:**
```typescript
// lib/plan/zones.ts
export type HRZoneMethod =
  | 'karvonen'
  | 'karvonen_estimated_max'
  | 'percent_of_max'
  | 'percent_of_estimated_max';

export interface HRZoneResult {
  zone2_ceiling: number;
  threshold_ceiling: number;
  method: HRZoneMethod;
  assumption_note?: string;
  estimated_max?: number;
  estimated_resting?: number;
}

const Z2_KARVONEN_PCT = 0.70;
const Z2_PCT_OF_MAX = 0.80;
const THRESHOLD_KARVONEN_PCT = 0.85;
const THRESHOLD_PCT_OF_MAX = 0.88;

function estimateMaxHR(age: number): number {
  return Math.round(208 - 0.7 * age);
}

export function computeHRZones(input: PlanInput): HRZoneResult {
  const hasMax = input.max_hr !== undefined && input.max_hr !== null;
  const hasResting = input.resting_hr !== undefined && input.resting_hr !== null;

  if (hasMax && hasResting) {
    const max = input.max_hr!;
    const resting = input.resting_hr!;
    return {
      zone2_ceiling: Math.round(resting + (max - resting) * Z2_KARVONEN_PCT),
      threshold_ceiling: Math.round(resting + (max - resting) * THRESHOLD_KARVONEN_PCT),
      method: 'karvonen',
    };
  }

  if (hasMax && !hasResting) {
    const max = input.max_hr!;
    return {
      zone2_ceiling: Math.round(max * Z2_PCT_OF_MAX),
      threshold_ceiling: Math.round(max * THRESHOLD_PCT_OF_MAX),
      method: 'percent_of_max',
      assumption_note:
        'Zones derived from max HR only (no resting HR provided). Karvonen method (using both max and resting) is more accurate. To refine: measure resting HR first thing in the morning, lying down, for 1 minute.',
    };
  }

  if (!hasMax && hasResting) {
    const resting = input.resting_hr!;
    const estMax = estimateMaxHR(input.age);
    return {
      zone2_ceiling: Math.round(resting + (estMax - resting) * Z2_KARVONEN_PCT),
      threshold_ceiling: Math.round(resting + (estMax - resting) * THRESHOLD_KARVONEN_PCT),
      method: 'karvonen_estimated_max',
      estimated_max: estMax,
      assumption_note:
        `Max HR estimated from age (${estMax} bpm using 208 − 0.7 × age). Your true max may differ by ±10 bpm. To refine: note your highest HR during a hard finish or hill effort and update your profile.`,
    };
  }

  // Neither provided
  const estMax = estimateMaxHR(input.age);
  return {
    zone2_ceiling: Math.round(estMax * Z2_PCT_OF_MAX),
    threshold_ceiling: Math.round(estMax * THRESHOLD_PCT_OF_MAX),
    method: 'percent_of_estimated_max',
    estimated_max: estMax,
    assumption_note:
      `Both max and resting HR missing — zones estimated from age alone (max ≈ ${estMax} bpm, Zone 2 ceiling ≈ ${Math.round(estMax * Z2_PCT_OF_MAX)} bpm). This is a working approximation. We strongly recommend completing a HR field test in the first 2 weeks. If your easy runs feel consistently too hard or too easy, your true max differs from the estimate — adjust your inputs.`,
  };
}
```

**Plan meta integration:**
```typescript
// In the generator, after computing zones:
const hrZones = computeHRZones(input);
plan.meta.zone2_ceiling = hrZones.zone2_ceiling;
plan.meta.hr_zone_method = hrZones.method;
if (hrZones.assumption_note) {
  plan.meta.hr_assumption_note = hrZones.assumption_note;
}
if (hrZones.estimated_max !== undefined) {
  plan.meta.hr_estimated_max = hrZones.estimated_max;
}
if (hrZones.estimated_resting !== undefined) {
  plan.meta.hr_estimated_resting = hrZones.estimated_resting;
}
```

**Invariant snippet:**
```typescript
// Confirms surfacing happens when method is non-Karvonen
export function hrAssumptionsSurfaced(plan: Plan): InvariantResult {
  const method = plan.meta.hr_zone_method;
  if (!method) {
    return { ok: false, message: 'Plan meta missing hr_zone_method field.' };
  }
  if (method !== 'karvonen' && !plan.meta.hr_assumption_note) {
    return {
      ok: false,
      message: `hr_zone_method is "${method}" but no hr_assumption_note surfaced. Non-Karvonen methods MUST include the assumption note.`,
    };
  }
  return { ok: true };
}
```

**Backward compatibility check:**
- Audit the original three test cases: do any of them have only partial HR data? Sarah has `max_hr: 190, resting_hr: 60` (Karvonen). Mark has `max_hr: 185, resting_hr: 55` (Karvonen). Anna has `max_hr: 180, resting_hr: 50` (Karvonen). All three should land on `hr_zone_method: 'karvonen'` with no assumption note. No regression.
- Case 04 has `max_hr: 175, resting_hr: 0`. After L-01 rejects `resting_hr: 0` as invalid, the input is treated as if resting_hr were missing → falls into method 2 (`percent_of_max`) → assumption note surfaced.

---

## Expected post-fix outcomes

After audit:
- Inventory of all generator entry points confirmed. Validator wraps all of them.
- Inventory of all existing principles and invariants confirmed.
- All cross-rule interactions documented and resolved.

After [HIGH]:
- Original three cases (Sarah, Mark, Anna) generate unchanged plans with `prep_time_status: 'ok'`.
- Case 04 inputs without acknowledgment: generation refuses, returns warning + alternatives.
- Case 04 inputs WITH `acknowledged_prep_warning: true`: generates a plan that downgrades to maintenance (peak volume floor not reachable), includes both `prep_time_warning` and `volume_constraint_note`.
- No generated plan has a long-run jump exceeding +20% / +5km in any phase.
- All previously-passing invariants still pass.

After [MEDIUM]:
- Marathon taper capped at 3 weeks (no impact on original three cases).
- Returning-runner allowance communicated in meta.
- No quality session label repeats more than ~3 times in 11 weeks (verify no false positives on original three cases).
- No long run exceeds 60% of weekly volume.

After [LOW]:
- `resting_hr: 0` rejected at input validation.
- Case 04 in the standard regression set.
- HR zone computation has four-level fallback. All four cases have `hr_zone_method` in meta. Cases 01–03 use `karvonen` with no assumption note (no regression). Case 04 (after L-01 rejects `resting_hr: 0`) uses `percent_of_max` with surfaced assumption note.

---

## Verification protocol

After all [HIGH] items, run:

```bash
npm test
ts-node scripts/generate-coaching-review.ts > docs/coaching-review/2026-04-28/regenerated-output.md
```

Then verify by hand:

1. Read the regenerated outputs for cases 01, 02, 03. Compare structure to round-two output. Confirm only meta-level changes (new `prep_time_status: 'ok'` field). No structural plan changes.
2. Run Case 04 with default inputs. Confirm `warn` returned, no plan.
3. Run Case 04 with `acknowledged_prep_warning: true`. Confirm plan generated with maintenance downgrade and warnings.
4. Inspect every invariant defined in `lib/plan/invariants.ts`. Confirm each one is asserted against all four cases in the regression suite (round-two H-04 meta-test should catch any gaps).

If any of the original three cases produces a different plan structure than before (different week count, different phase boundaries, different session selection), STOP and report. Something has interacted unexpectedly.
