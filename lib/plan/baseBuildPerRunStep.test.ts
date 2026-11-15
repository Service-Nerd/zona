// §116 Amendment 12 (Coaching Board 2026-11-15, `ENGINE-BASEBUILD-UNVALIDATED-01`) —
// `INV-PLAN-ONRAMP-PER-RUN-STEP`'s build-week arm is a RATIO (§45's
// `LONG_RUN_PROGRESSION_CAP_PCT`), not §2 Amendment 2's week-1 ABSOLUTE of 1.5 km.
//
// 🔴 WHY THIS FILE EXISTS, AND WHY IT IS ALL MUTATION. The arm is now SILENT on the whole
// corpus — 163,068 error violations before, 0 after — because every single one of them was
// §2's own ratified 10% ramp measured against a constant that cannot coexist with it:
// `WEEK1_PER_RUN_STEP_MAX_KM / (MAX_WEEKLY_VOLUME_INCREASE_PCT/100)` = `1.5 / 0.10` = 15, so
// above a 15 km run a compliant ramp breached an absolute 1.5 km step EVERY week, forever.
// Measured: `prevLongest > 15 km` in 28,512 of 28,512 violations, smallest 16.5 km, every step
// 9.7–10.3%.
//
// ⚠️ SO A GREEN CORPUS IS NOT EVIDENCE THIS ARM WORKS, and §2 Amendment's own arm 3 records the
// same shape in as many words: *"its liveness comes from mutation rather than from the corpus."*
// Every case here mutates a valid plan and asserts WHICH arm fires, in both directions.
import { describe, it, expect } from 'vitest'
import { assessOnRamp, generateBaseBuildPlan } from './baseBuildOnRamp'
import { validateBaseBuildBlock } from './baseBuildValidate'
import { GENERATION_CONFIG as C } from './generationConfig'
import type { GeneratorInput, Week, Session } from '@/types/plan'

const input = (over: Partial<GeneratorInput> = {}): GeneratorInput => ({
  race_distance_km: 42.195, race_date: '2027-04-25', days_available: 4,
  goal: 'finish', fitness_level: 'beginner', current_weekly_km: 8,
  longest_recent_run_km: 3, age: 32, injuries: [],
  recent_quality_training: 'none', training_age: '<6mo',
  ...over,
} as unknown as GeneratorInput)

const build = (over: Partial<GeneratorInput> = {}) => {
  const i = input(over)
  const a = assessOnRamp(i, 18, 29)
  return { a, plan: generateBaseBuildPlan(i, '2026-10-05', a) }
}
const clone = (w: Week[]) => JSON.parse(JSON.stringify(w)) as Week[]
const codes = (w: Week[], startKm: number) =>
  validateBaseBuildBlock(w, startKm).filter(v => v.severity === 'error').map(v => v.code)

/** Set every run in week index `i` to `km`, so the week's LONGEST run is `km`. */
function setWeekRuns(weeks: Week[], i: number, km: number) {
  for (const s of Object.values(weeks[i].sessions ?? {}) as (Session | undefined)[]) {
    if (!s || s.type === 'rest' || s.type === 'cross-train') continue
    s.distance_km = km
    delete (s as { duration_mins?: number }).duration_mins
  }
}
/** The first index in the ramp where neither this week nor the one before it is a deload — the
 *  only place the arm looks. Derived, never assumed: the deload cadence is config. */
function firstComparableIndex(weeks: Week[]): number {
  const dl = (w: Week) => w.type === 'deload' || w.badge === 'deload'
  for (let i = 1; i < weeks.length; i++) if (!dl(weeks[i]) && !dl(weeks[i - 1])) return i
  throw new Error('no comparable adjacent build weeks — fixture is wrong, not the rule')
}

describe('§116 Am. 12 — the build-week per-run step is §45\'s ratio', () => {
  it('a valid ramp is clean, so every mutation below starts from green', () => {
    const { a, plan } = build()
    expect(codes(plan.weeks, a.startKm)).toEqual([])
  })

  it('🔴 FIRES on a step above §45\'s percentage', () => {
    const { a, plan } = build()
    const w = clone(plan.weeks)
    const i = firstComparableIndex(w)
    setWeekRuns(w, i - 1, 10)
    setWeekRuns(w, i, 10 * (1 + (C.LONG_RUN_PROGRESSION_CAP_PCT + 10) / 100))
    expect(codes(w, a.startKm)).toContain('INV-PLAN-ONRAMP-PER-RUN-STEP')
  })

  it('🔴 and SILENT on a step inside it — the same two weeks, a smaller step', () => {
    const { a, plan } = build()
    const w = clone(plan.weeks)
    const i = firstComparableIndex(w)
    setWeekRuns(w, i - 1, 10)
    setWeekRuns(w, i, 10 * (1 + (C.LONG_RUN_PROGRESSION_CAP_PCT - 10) / 100))
    expect(codes(w, a.startKm)).not.toContain('INV-PLAN-ONRAMP-PER-RUN-STEP')
  })

  it('🔴 catches Willy\'s own words: a DOUBLING is the load event', () => {
    const { a, plan } = build()
    const w = clone(plan.weeks)
    const i = firstComparableIndex(w)
    setWeekRuns(w, i - 1, 6)
    setWeekRuns(w, i, 12)
    const v = validateBaseBuildBlock(w, a.startKm).find(x => x.code === 'INV-PLAN-ONRAMP-PER-RUN-STEP')
    expect(v?.actual).toBe('+100%')
    expect(v?.expected).toBe(`≤ +${C.LONG_RUN_PROGRESSION_CAP_PCT}%`)
  })

  // 🔴 THE REGRESSION. This is the exact arithmetic that made 163,068 violations: §2's ramp
  // applied to a run above `WEEK1_PER_RUN_STEP_MAX_KM / (MAX_WEEKLY_VOLUME_INCREASE_PCT/100)`.
  // Under the old ABSOLUTE arm this case FAILED; it is a compliant ramp and must pass.
  it('🔴 a §2-COMPLIANT 10% step on a run above 15 km passes — it did not before', () => {
    const { a, plan } = build()
    const incompatibleAbove = C.WEEK1_PER_RUN_STEP_MAX_KM / (C.MAX_WEEKLY_VOLUME_INCREASE_PCT / 100)
    expect(incompatibleAbove).toBe(15)
    const prev = incompatibleAbove + 2            // 17 km: above the line, so the old arm fired
    const next = prev * (1 + C.MAX_WEEKLY_VOLUME_INCREASE_PCT / 100)
    expect(next - prev).toBeGreaterThan(C.WEEK1_PER_RUN_STEP_MAX_KM)   // the old absolute is breached
    const w = clone(plan.weeks)
    const i = firstComparableIndex(w)
    setWeekRuns(w, i - 1, prev)
    setWeekRuns(w, i, next)
    expect(codes(w, a.startKm)).not.toContain('INV-PLAN-ONRAMP-PER-RUN-STEP')
  })

  // ⚠️ §45's companion absolute (`LONG_RUN_PROGRESSION_CAP_ABS_KM`, 5 km) is deliberately NOT a
  // greater-of floor here. At this cohort's volumes it would re-open the hazard the ratio closes.
  it('🔴 §45\'s 5 km absolute is NOT used as a greater-of floor: 2 km → 6 km still fires', () => {
    const { a, plan } = build()
    expect(C.LONG_RUN_PROGRESSION_CAP_ABS_KM).toBe(5)
    const w = clone(plan.weeks)
    const i = firstComparableIndex(w)
    setWeekRuns(w, i - 1, 2)
    setWeekRuns(w, i, 6)      // +4 km, inside the 5 km absolute; +200%, far outside the ratio
    expect(codes(w, a.startKm)).toContain('INV-PLAN-ONRAMP-PER-RUN-STEP')
  })

  it('§2 Amendment 2 is untouched — its constant is still 1.5 and still a WEEK-1 screen', () => {
    expect(C.WEEK1_PER_RUN_STEP_MAX_KM).toBe(1.5)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// And the OTHER half of `ENGINE-BASEBUILD-UNVALIDATED-01`: the branch now validates.
//
// ⚠️ BEHAVIOURAL, NOT A SOURCE ASSERTION, and the reason is in this repo's record: a source
// assertion passes on a comment. The generator is mocked to return a block with a deliberate
// +100% per-run step, and `runEngine` must THROW — `enforceViolations` throws on error severity
// under NODE_ENV=test. Falsified by deleting the `enforceViolations` call in `engine.ts`, which
// turns this red and leaves every other case in the file green.
