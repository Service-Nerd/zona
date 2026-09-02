# §79-PEAKKM — upstream/downstream impact analysis

**Date:** 2026-09-02
**Status:** Analysis complete → board re-ruled → implemented (see commit)
**Board records:** first ruling + re-ruling, this session. Amends `CoachingPrinciples.md` §79.
**Trigger:** the shipped engine contradicted §79's own text on what a user-selected fitness level is allowed to bind.

---

## 1. The defect

§79 "User-selectable level (wizard)" states:

> "A user override raises the **intensity** allowance only; the structural volume/ramp/long-run caps stay bound to the conservative assessment (agency raises intensity, never tonnage — §10)"

and its returning-runner paragraph names the protected set: *"volume, **peak km**, ramp and long-run caps stay bound to current volume"*.

The engine did the opposite:

```ts
// ruleEngine.ts:3407 (before)
const fitness: FitnessLevel = input.fitness_level ?? assessed.structural
// :3439
const peakKm = config.peakKmByLevel[fitness]
```

and `peakKm` then sets the **week-1 volume floor**:

```ts
// ruleEngine.ts:475-477
const initFloor = peakKm * GENERATION_CONFIG.BUILD_VOL_INIT_FLOOR_VS_PEAK / 100   // 35%
let buildVol = Math.min(Math.max(startKm, initFloor), initCeiling)                 // floor overrides current volume UPWARD
```

So a self-declared level raised both the peak ceiling and the starting volume. The in-code comment at :3398 asserted the reverse ("start volume … computed from current volume … independent of `fitness_level`"), which line 477 contradicts.

### Measured effect (generated plans, not inferred)

| Input | Accept recommendation | Declare "experienced" |
|---|---|---|
| 10K, 15 km/wk, 2-5yr | wk1 **13**, peak **18** | wk1 **20**, peak **35** |
| Marathon, 20 km/wk, 2-5yr | wk1 **24**, peak **43** | wk1 **28**, peak **55** |
| Marathon, 8 km/wk, **`<6mo` novice** | wk1 18, peak **42** | wk1 18, peak **55** |

The third row is the significant one: a true novice (`training_age: '<6mo'`, 8 km/week) declaring "experienced" gets a **55 km** marathon peak instead of 42 km. CD-6's `BEGINNER_WEEK1_VOLUME_CAP_KM = 30` protects the *entry* but not the *destination* — it caps `declaredStartKm` before the `Math.max(startKm, initFloor)`, so the peak-derived floor is unaffected by it.

A second, compounding path: `isReturningRunner(input, peakKm)` (:420) thresholds at `peakKm × RETURNING_RUNNER_VOLUME_THRESHOLD_PCT (50%)`, so a higher declared level also makes the 15%/week grace ramp more likely to engage.

---

## 2. Why the obvious fix was wrong

The first board ruling said "revert :3407 to `assessed.structural`". Tracing every consumer showed three blockers.

### Blocker 1 — `fitness_level` is a dual-purpose field

It is simultaneously:

- **(a)** the documented **API contract** — `docs/contracts/api/generate-plan.md:43`, *"derived from data if absent"* — passed explicitly as the *structural* declaration by all 11 archetypes in `scripts/r23-phase7-validation.ts`, by `scripts/property-validate-plans.ts`, and by ~20 unit-test fixtures; and
- **(b)** the **wizard's user override** (`GeneratePlanScreen.tsx:836`), added 2026-08-31.

Redefining it as intensity-only would silently re-derive structure for every caller in (a).

Divergence between declared and volume-assessed level across the archetype matrix — **2 of 11**:

| Archetype | Declared | `assessFitness().structural` | Direction |
|---|---|---|---|
| A5 HM (20 km/wk, 8 km long) | beginner | intermediate | downward |
| A9 HM (50 km/wk, 20 km long) | experienced | intermediate | upward |

(A9 sits just under `FITNESS_VOLUME_THRESHOLDS.experienced_min_weekly_km = 55`. Whether a 50 km/week runner with a 20 km long run should read `experienced` is a separate threshold question — logged below, not addressed here.)

### Blocker 2 — the "structural" variable drives real intensity decisions

`fitness` is not purely structural today:

| Line | Use | Axis it really belongs to |
|---|---|---|
| :825 | `vo2maxRepPlan(row, fitness, …)` → `VO2MAX_WORK_TARGET_MINS[fitness][phase]` | **intensity** |
| :2077 | secondary quality slot catalogue selection | **intensity** |
| :1701 | peak-phase session count (`fitness === 'experienced' ? 2 : 1`) | **intensity** |
| :880 | "Cruise intervals" label selection | intensity (cosmetic) |
| :3413 | `buildFallbackPace(fitness)` | arguably structural |
| :3439 | `peakKm` | structural |

Note :2021 (**primary** quality slot) correctly uses `intensityFitness` while :2077 (**secondary**) uses `fitness` — a pre-existing inconsistency.

Reverting `fitness` wholesale would therefore have removed the intensity benefit the override exists to grant.

### Blocker 3 — the meta round-trip breaks the PAID reshape path

`validateReshapedPlan` runs in production on `/api/adjust-plan:385`. It reconstructs a `GeneratorInput` from plan meta (`invariants.ts:2766`, `fitness_level: m.fitness_level`), and `validatePlan:291` keys the quality-per-week ceiling off that value:

```ts
const fitness = input.fitness_level
const qualityMaxPerWeek = fitness ? GENERATION_CONFIG.QUALITY_SESSIONS_PER_WEEK_MAX[fitness] : undefined
```

Stamping the *structural* level into `meta.fitness_level` while the plan legitimately carries *elevated-intensity* quality sessions makes the plan fail its own invariant on the next reshape — `throw` in dev/test, and in prod a soft-degrade that floods `ops_events` with false `reshape_invalid`. This is the claim/computation-mismatch silent-failure class.

---

## 3. Incidental live findings (pre-existing, not caused by this work)

1. **The quality-per-week ceiling is unenforced on the wizard-accept path.** `validatePlan:291` yields `undefined` when `fitness_level` is absent, and the check self-skips. `fitness_level` was absent for every runner who accepted the recommendation — i.e. most real users. Fixed here by keying the ceiling off the intensity level, which is always stamped.
2. **The secondary quality slot selected on the wrong axis.** It filtered rows by `FITNESS_RANK[row.fitness_level_min] <= structural` while the *primary* slot used `intensityFitness`. **0 of 14** quality rows are eligible at `beginner`, so for any runner whose intensity exceeds their structural level, slot 2 fell through to an **uncatalogued** session (`catalogue_id = NONE`) — the ADR-018 defect class, where the runner is shown no rep structure. Fixed 2026-09-02 (§79-INTENSITY-ROUTING).

   **Correction to an earlier draft of this document.** It claimed this meant "a returning runner is denied their second quality session" and that "§79 Phase 1 is incomplete". **That was wrong.** `QUALITY_SESSIONS_PER_WEEK_MAX` is a *ceiling*, not an entitlement; the actual count comes from `plannedQuality` (`ruleEngine.ts:1671-1679`), which is **1 for every non-`experienced` runner in build and peak** by long-standing design. No second session was being withheld. Measured before and after the fix: peak weeks with 2+ quality unchanged (1/2); what changed is slot 2 gaining a real catalogue row (`10K-pace intervals`, `catalogue_id=NONE` → `10K-pace sustained`, `catalogue_id=tempo_continuous`). The error was conflating a ceiling with a target — worth recording because the ceiling/target distinction is easy to re-make.

---

## 4. Implemented design

Board re-ruling: **CORRECT WITH AMENDMENT** — substance unchanged, mechanism amended.

1. **New input `user_declared_level`** carries the wizard's declaration. `fitness_level` keeps its existing API meaning → **no contract break**; matrix, sweep and fixtures are untouched.
2. **Asymmetric binding** (§79, mirroring §50/HR-MAX-01's evidential asymmetry):
   - **Upward** declaration → raises the **intensity** allowance only. Structure stays on the assessment.
   - **Downward** declaration → binds **both**. A runner volunteering caution is heard on tonnage.
3. **Meta** stamps `fitness_level_declared` alongside `fitness_level` (structural) and `fitness_intensity_level`, so the invariant can compare the two.
4. **Reshape round-trip fixed** — the quality ceiling is an intensity rule and now keys off the intensity level.
5. The wizard now passes the level **whether accepted or overridden**. Once the level cannot touch `peakKm`, the maintenance-label regression that forced the `undefined`-on-accept workaround cannot occur — so the honesty seam (the runner accepts a level the engine never receives) closes as a side effect.

### Artifacts

| Artifact | Location |
|---|---|
| Principle | `CoachingPrinciples.md` §79 — "User-selectable level" amended with the asymmetry + why |
| Numeric | `GENERATION_CONFIG.USER_DECLARED_LEVEL_BINDS_STRUCTURE_DOWNWARD_ONLY = true` |
| Invariant | `INV-PLAN-USER-LEVEL-NO-UPWARD-TONNAGE` + row in `plan-invariants.md` |

---

## 5. Deliberately not done here

| Item | Why | Routing |
|---|---|---|
| Route VO2max dose + secondary-quality selection off `intensityFitness` | Changes prescription for accepting users; Willy required it be measured separately | New board item |
| Revisit `FITNESS_VOLUME_THRESHOLDS.experienced_min_weekly_km = 55` (A9 boundary) | A threshold question, not an override question | Board, if it recurs |
| Sims's under-declaration asymmetry | Needs declared-vs-assessed outcome data, which is not yet logged | Instrumentation (SLT) |
