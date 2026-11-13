/**
 * §117 Amendment 5 — the run-walk PRESCRIPTION on readiness to run.
 *
 * 🩹 WILLY'S BINDING CONDITION LIVES IN ARM 2. The ruling was granted on the
 * condition that no peak falls, and `validatePlan` cannot express that (it has
 * no counterfactual peak and no `standardLevelPeakKm`). What it CAN be pinned
 * on is the flag: `finish_goal_run_walk` is the flag that reduces a peak, and
 * the readiness route must never set it.
 *
 * ⚠️ ARM 3 IS THE `PRESCRIBED-FIELD-REACH-01` LESSON. `run_walk_prescribed` was
 * stamped in plan JSON and read by nothing for months while its invariant stayed
 * green. A meta flag is not a prescription; the walk interval on the session is.
 *
 * 🔴 AND THIS FILE WAS THE SIXTH BLIND HARNESS (RUNWALK-ASSESSED-LEVEL-01,
 * 2026-11-03). Every fixture below set `fitness_level: 'beginner'` — a field the
 * wizard never sends — so every arm passed against a population production cannot
 * produce, while the prescription fired for **0 of 39** live plans. The arms now
 * resolve the level through `resolveLevels`, the owner the engine uses, and
 * § PRODUCTION SHAPE at the foot of the file omits the field entirely.
 *
 * ⚠️ DO NOT PASS A LITERAL `'beginner'` TO THE GATE IN THIS FILE. That is the
 * defect, re-expressed as a test: it asserts the gate works on inputs the product
 * does not build. `levelOf` resolves it the way the engine does.
 */
import { describe, it, expect } from 'vitest'
import { generateRulePlan } from './ruleEngine'
import { runWalkPrescriptionApplies } from './runWalkPlan'
import { resolveLevels } from './fitnessAssessment'
import { validatePlan } from './invariants'
import { GENERATION_CONFIG as G } from './generationConfig'
import type { GeneratorInput } from '@/types/plan'

const DAY = 86_400_000
const START = '2026-11-02'

function marathonBeginner(longestKm: number, weeklyKm: number): GeneratorInput {
  const start = new Date(START + 'T00:00:00Z')
  return {
    athlete_name: 'Readiness', age: 38, race_name: 'Target race',
    primary_metric: 'distance', race_distance_km: 42.195,
    race_date: new Date(start.getTime() + 20 * 7 * DAY).toISOString().slice(0, 10),
    plan_start: START,
    goal: 'finish', fitness_level: 'beginner', training_age: '6-18mo',
    resting_hr: 55, max_hr: 185,
    current_weekly_km: weeklyKm, longest_recent_run_km: longestKm,
    days_available: 4, injury_history: [],
    hard_session_relationship: 'neutral', recent_quality_training: 'occasional',
    acknowledged_days_warning: true, acknowledged_prep_warning: true,
  } as unknown as GeneratorInput
}

/** §79's structural level, resolved exactly as `generateRulePlan` resolves it. */
const levelOf = (i: GeneratorInput) => resolveLevels(i).structural

/** The shape the wizard actually posts: no `fitness_level`, level on the declaration. */
function asWizardSends(i: GeneratorInput, declared?: 'beginner' | 'intermediate' | 'experienced'): GeneratorInput {
  const { fitness_level: _dropped, ...rest } = i as GeneratorInput & { fitness_level?: unknown }
  return { ...rest, ...(declared ? { user_declared_level: declared } : {}) } as GeneratorInput
}

function planOf(input: GeneratorInput) {
  // 'paid' is what `envelopeMeasure` passes, so this test and the benchmark
  // measure the same thing. A missing tier is not a neutral default.
  const r = generateRulePlan(input, 'paid', START)
  return (r as unknown) as {
    weeks: { n: number; sessions: Record<string, unknown> }[]
    meta: Record<string, unknown>
  }
}

describe('§117 Am.5 — run-walk prescribed on readiness to run', () => {
  // The measured failing cohort: 15 km/week clears §117's 13 km door by two
  // kilometres, and the longest run is 7 km = 16.6% of the race.
  const UNREADY = marathonBeginner(7, 15)
  const READY = marathonBeginner(15, 35)

  it('the predicate separates the measured cohorts', () => {
    expect(runWalkPrescriptionApplies(UNREADY, levelOf(UNREADY))).toBe(true)
    // 15 km = 35.5% of the race, above the bar.
    expect(runWalkPrescriptionApplies(READY, levelOf(READY))).toBe(false)
    // The bar itself, stated so a config change has to come through here.
    expect(G.RUNWALK_PRESCRIBE_LONGEST_RUN_PCT_OF_RACE).toBe(25)
  })

  it('a runner who is ready is NOT given the prescription by this route', () => {
    // Guards the direction that would be invisible: over-prescribing walk
    // breaks to a runner who does not need them.
    for (const i of [marathonBeginner(11, 25), marathonBeginner(20, 50)]) {
      expect(runWalkPrescriptionApplies(i, levelOf(i))).toBe(false)
    }
  })

  it('only beginners with a finish goal, at a distance in the RULED scope, reach it', () => {
    // ▲ §117 Amendment 8 (2026-11-12, SHORTDIST-RUNWALK-SCOPE-01) — this arm read
    // "at marathon+" and the scope is now 5K, 10K and the marathon. The HM stays OUT by
    // ruling, which is why it is still the negative case here; `INV-PLAN-RUNWALK-SHORTDIST-
    // SCOPE` counts it rather than serving it.
    const notBeginner = { ...UNREADY, fitness_level: 'intermediate' } as GeneratorInput
    const notFinish = { ...UNREADY, goal: 'time_target', target_time: '4:15:00' } as unknown as GeneratorInput
    const halfMarathon = { ...UNREADY, race_distance_km: 21.1 } as GeneratorInput
    expect(runWalkPrescriptionApplies(notBeginner, levelOf(notBeginner))).toBe(false)
    expect(runWalkPrescriptionApplies(notFinish, levelOf(notFinish))).toBe(false)
    expect(runWalkPrescriptionApplies(halfMarathon, levelOf(halfMarathon)),
      'the HM entered the instruction scope without a ruling').toBe(false)
    // And the two the amendment ADDED, with a longest run under each race's own 25% bar.
    for (const km of [5, 10]) {
      const short = { ...UNREADY, race_distance_km: km, current_weekly_km: 10,
        longest_recent_run_km: 0 } as unknown as GeneratorInput
      expect(runWalkPrescriptionApplies(short, levelOf(short)),
        `§117 Am. 8 requires the ${km}km to reach the instruction`).toBe(true)
    }
  })

  it('a MISSING longest run does not reach it — but a DECLARED ZERO does', () => {
    // §18's INV-INPUT-LONGEST-LE-WEEKLY means a stated longest is trustworthy;
    // an ABSENT one is not evidence of anything, and must not buy a prescription.
    //
    // ▲ §117 Amendment 8 (2026-11-12, SHORTDIST-RUNWALK-SCOPE-01) — this arm asserted that
    // BOTH `undefined` and `0` were excluded, and the reason above only ever justified the
    // first. The gate read `longest <= 0`, so it treated "I have never run" exactly like "we
    // were not told". 0 is a real wizard value (the longest-run ruler starts at 0, step 1),
    // `ENVELOPE-LRR-BLIND-01` exists because no corpus could reach the runner who declares
    // it, and under Amendment 5 a longest run of zero answers the readiness question most
    // clearly of all. **The comment was right and the assertion over-applied it.**
    const absent = { ...UNREADY } as unknown as Record<string, unknown>
    delete absent.longest_recent_run_km
    const a = absent as unknown as GeneratorInput
    expect(runWalkPrescriptionApplies(a, levelOf(a)),
      'an ABSENT longest run must not buy a prescription — absence is not a value').toBe(false)

    const zero = { ...UNREADY, longest_recent_run_km: 0 } as unknown as GeneratorInput
    expect(runWalkPrescriptionApplies(zero, levelOf(zero)),
      'a DECLARED zero is the strongest case for the prescription, not an excluded one').toBe(true)
  })

  it('the unready runner GETS the prescription, and the plan validates', () => {
    const p = planOf(UNREADY)
    expect(p.meta.run_walk_prescribed).toBe(true)
    const errs = validatePlan(p as never, UNREADY).filter(v => v.severity === 'error')
    expect(errs.map(v => v.code)).toEqual([])
  })

  // 🩹 WILLY: no peak may fall.
  it('ARM 2 — the readiness route does NOT set the peak-reduction flag', () => {
    const p = planOf(UNREADY)
    expect(p.meta.run_walk_prescribed).toBe(true)
    // `finish_goal_run_walk` is what swaps `standardLevelPeakKm` for
    // `runWalkPeakKm()`. Unset means the peak is the one they would have had.
    expect(p.meta.finish_goal_run_walk).toBeUndefined()
  })

  it('ARM 3 — the walk interval reaches the SESSIONS, not just the meta', () => {
    const p = planOf(UNREADY)
    let running = 0, withInterval = 0
    for (const w of p.weeks) {
      for (const s of Object.values(w.sessions ?? {})) {
        const sess = s as { type?: string; run_walk_strategy?: unknown }
        // ▲ `'cross-train'`, not `'cross'` (code review, 2026-11-03). The schema type is
        // `'cross-train'`, which is what `applyRunWalk` and INV-PLAN-RUNWALK-PRESCRIBED both
        // skip; `'cross'` is a DISPLAY key in `TodayScreen`. The old spelling matched nothing,
        // so the day a run-walk plan carried a cross-train session this arm failed on a
        // correct plan. Copied forward into the new arm before it was caught.
        if (!sess || sess.type === 'rest' || sess.type === 'strength' || sess.type === 'cross-train') continue
        running++
        if (sess.run_walk_strategy) withInterval++
      }
    }
    expect(running).toBeGreaterThan(20)
    expect(withInterval).toBe(running)
  })

  it('the invariant fires when the stamp is missing', () => {
    const p = planOf(UNREADY)
    delete p.meta.run_walk_prescribed
    const codes = validatePlan(p as never, UNREADY).map(v => v.code)
    expect(codes).toContain('INV-PLAN-RUNWALK-PRESCRIBED-WHEN-UNREADY')
  })
})

/**
 * RUNWALK-ASSESSED-LEVEL-01 — the shape the PRODUCT builds.
 *
 * 🔴 EVERY ARM ABOVE SET `fitness_level`, AND THE WIZARD NEVER DOES. These arms
 * omit it, which is the only population that has ever reached this gate in
 * production, and all four were RED before the fix: the engine prescribed
 * nothing, the invariant skipped, and the suite was green.
 *
 * ⚠️ ARM "identity" is the durable one. It does not assert a value — it asserts
 * that the gate gives the SAME answer whether or not the field is present. That is
 * the property the defect broke, and it stays true if the thresholds move.
 */
describe('§117 Am.5 — PRODUCTION SHAPE: no fitness_level, level on the declaration', () => {
  const UNREADY = marathonBeginner(7, 15)
  const READY   = marathonBeginner(15, 35)

  it('the level resolves to beginner from volume alone — the premise of the rest', () => {
    // 15 km/wk is below FITNESS_VOLUME_THRESHOLDS.beginner_max_weekly_km (20).
    expect(levelOf(asWizardSends(UNREADY))).toBe('beginner')
    // Stated so a threshold change cannot quietly empty this whole describe block.
    expect(levelOf(asWizardSends(READY))).not.toBe('beginner')
  })

  it('an unready beginner GETS the prescription with no fitness_level present', () => {
    const i = asWizardSends(UNREADY)
    expect((i as { fitness_level?: unknown }).fitness_level).toBeUndefined()
    expect(runWalkPrescriptionApplies(i, levelOf(i))).toBe(true)
  })

  it('identity — the gate does not care whether the field is present', () => {
    for (const base of [UNREADY, READY, marathonBeginner(11, 25)]) {
      const withField = base
      const without   = asWizardSends(base)
      expect(runWalkPrescriptionApplies(without, levelOf(without)))
        .toBe(runWalkPrescriptionApplies(withField, levelOf(withField)))
    }
  })

  it('§117 is DERIVED, NEVER ASKED — declaring intermediate does not opt out', () => {
    // §79: USER_DECLARED_LEVEL_BINDS_STRUCTURE_DOWNWARD_ONLY, so a runner who
    // reads beginner on volume keeps a beginner STRUCTURE whatever they declare.
    // That is the cohort this exists to serve: they will not tick the box.
    const up = asWizardSends(UNREADY, 'intermediate')
    expect(levelOf(up)).toBe('beginner')
    expect(runWalkPrescriptionApplies(up, levelOf(up))).toBe(true)
    // Declaring DOWNWARD binds structure, and a beginner is already the floor.
    const down = asWizardSends(READY, 'beginner')
    expect(runWalkPrescriptionApplies(down, levelOf(down))).toBe(false)
  })

  it('end to end — the plan prescribes, the sessions carry it, and the peak does not move', () => {
    const i = asWizardSends(UNREADY)
    const p = planOf(i)
    expect(p.meta.run_walk_prescribed).toBe(true)
    // 🩹 Willy: no peak may fall. The readiness route must not set the flag that
    // swaps `standardLevelPeakKm` for `runWalkPeakKm()`.
    expect(p.meta.finish_goal_run_walk).toBeUndefined()
    // The interval reaches the SESSIONS, not just the meta (PRESCRIBED-FIELD-REACH-01).
    let running = 0, withInterval = 0
    for (const w of p.weeks) {
      for (const s of Object.values(w.sessions ?? {})) {
        const sess = s as { type?: string; run_walk_strategy?: unknown }
        // ▲ `'cross-train'`, not `'cross'` (code review, 2026-11-03). The schema type is
        // `'cross-train'`, which is what `applyRunWalk` and INV-PLAN-RUNWALK-PRESCRIBED both
        // skip; `'cross'` is a DISPLAY key in `TodayScreen`. The old spelling matched nothing,
        // so the day a run-walk plan carried a cross-train session this arm failed on a
        // correct plan. Copied forward into the new arm before it was caught.
        if (!sess || sess.type === 'rest' || sess.type === 'strength' || sess.type === 'cross-train') continue
        running++
        if (sess.run_walk_strategy) withInterval++
      }
    }
    expect(running).toBeGreaterThan(20)
    expect(withInterval).toBe(running)
    expect(validatePlan(p as never, i).filter(v => v.severity === 'error')).toEqual([])
  })

  it('the invariant fires on a production-shaped plan whose stamp is missing', () => {
    // The arm that was structurally unreachable: with no `fitness_level`, the
    // checker resolved `undefined` and skipped, so this could not fire at all.
    const i = asWizardSends(UNREADY)
    const p = planOf(i)
    delete p.meta.run_walk_prescribed
    expect(validatePlan(p as never, i).map(v => v.code))
      .toContain('INV-PLAN-RUNWALK-PRESCRIBED-WHEN-UNREADY')
  })
})
