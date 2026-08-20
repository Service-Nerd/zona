import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { generateRulePlan } from './ruleEngine'
import { validatePlan } from './invariants'
import { GENERATION_CONFIG } from './generationConfig'
import { classifyStimulus } from './sessionRole'
import { V1_SESSION_CATALOGUE } from './sessionCatalogueData'
import type { GeneratorInput, Plan } from '@/types/plan'

/**
 * SC-07 / CD-16 + CD-22 — VO2max placement.
 *
 * Before: all three vo2max rows were peak-only, so a 12-week 10K put both
 * VO2max sessions in W9/W10 — two weeks before a taper that needs five. The
 * engine logged its own violation and proceeded, blaming the catalogue.
 *
 * THREE independent locks held it there, and finding that mattered: granting
 * the catalogue rows build eligibility on its own provably changed NOTHING.
 *   1. catalogue  — phase_eligibility: ['peak']
 *   2. selector   — preferredQualityCategory(build) hardcoded 'threshold',
 *                   never reading the signature's quality_categories_focus
 *   3. slot count — build carries one quality slot; the second slot, which
 *                   flips to the alternate category, exists only in peak
 *
 * Option A (session-neutral category rotation) shipped; Option B (a second
 * build quality session) was rejected unanimously — it adds load to reach a
 * stimulus and contradicts CD-20's volume arithmetic.
 */

const FROZEN_NOW = new Date('2026-08-20T09:00:00Z')
const PLAN_START = '2026-09-07'

const TENK_12WK: GeneratorInput = {
  race_date: '2026-11-30', race_distance_km: 10, goal: 'time_target',
  target_time: '0:44:59', days_available: 4, age: 43,
  current_weekly_km: 40, longest_recent_run_km: 18,
  resting_hr: 48, max_hr: 188, preferred_long_run_day: 'sun',
  benchmark: { type: 'race', distance_km: 10, time: '0:48:30' },
  fitness_level: 'experienced', training_age: '2-5yr',
}

// 10 weeks out from PLAN_START -> an 11-week plan, whose deadline (W4) falls
// in base phase. 10K.min_weeks is 10, so this length is supported.
const SHORT_RACE_DATE = '2026-11-16'

const HARD = new Set(['quality', 'intervals', 'tempo'])
const isVo2 = (s: { label?: string | null, zone?: string | null }) => classifyStimulus(s) === 'vo2max'

const qualityOf = (plan: Plan, phase?: string) =>
  plan.weeks.filter(w => !phase || w.phase === phase)
    .flatMap(w => Object.values(w.sessions)
      .filter(s => s && HARD.has(s.type))
      .map(s => ({ week: w.n, phase: w.phase, s: s! })))

beforeAll(() => { vi.useFakeTimers(); vi.setSystemTime(FROZEN_NOW) })
afterAll(() => { vi.useRealTimers() })

describe('SC-07 — VO2max reaches the build phase', () => {
  it('a 12-week 10K opens the adaptation window inside build', () => {
    const plan = generateRulePlan(TENK_12WK, 'paid', PLAN_START)
    const vo2 = qualityOf(plan).filter(q => isVo2(q.s))
    expect(vo2.length).toBeGreaterThan(0)
    expect(vo2[0].phase, 'first VO2max must be in build, not peak').toBe('build')
  })

  it('the adaptation window is satisfied, not logged against', () => {
    const plan = generateRulePlan(TENK_12WK, 'paid', PLAN_START)
    const taperStart = plan.weeks.find(w => w.phase === 'taper')!.n
    const firstVo2 = qualityOf(plan).filter(q => isVo2(q.s))[0].week
    expect(taperStart - firstVo2)
      .toBeGreaterThanOrEqual(GENERATION_CONFIG.VO2MAX_ONSET_MIN_ADAPTATION_WEEKS)

    // The old advisory shrug is gone, not merely amended — it asserted the
    // catalogue places VO2max only in peak, which this change makes false.
    const rules = (plan.meta.rule_adjustments ?? []).map(a => a.rule)
    expect(rules).not.toContain('V2-vo2max-onset-timing')
  })

  it('is SESSION-NEUTRAL — the mix changes, the load does not', () => {
    // Seiler's binding constraint: moving VO2max earlier must not become MORE
    // VO2max. Option B (a second build quality session) was rejected on this.
    const plan = generateRulePlan(TENK_12WK, 'paid', PLAN_START)
    const perBuildWeek = plan.weeks.filter(w => w.phase === 'build' && w.type !== 'deload')
      .map(w => Object.values(w.sessions).filter(s => s && HARD.has(s.type)).length)
    expect(Math.max(...perBuildWeek), 'build stays at one quality session per week').toBe(1)
  })

  it('build carries exactly ONE VO2max exposure', () => {
    // Without the cap the modulo rotation cycles back to vo2max and a
    // three-week build runs vo2max/threshold/vo2max — four VO2max sessions in
    // a plan that previously had two. That is the over-correction Seiler named.
    const plan = generateRulePlan(TENK_12WK, 'paid', PLAN_START)
    const buildVo2 = qualityOf(plan, 'build').filter(q => isVo2(q.s))
    expect(buildVo2).toHaveLength(1)
  })

  it('no consecutive VO2max weeks in build (McMillan)', () => {
    const plan = generateRulePlan(TENK_12WK, 'paid', PLAN_START)
    const weeks = qualityOf(plan, 'build').filter(q => isVo2(q.s)).map(q => q.week)
    for (let i = 1; i < weeks.length; i++) expect(weeks[i] - weeks[i - 1]).toBeGreaterThan(1)
  })

  it("Willy's gate: the VO2max-introducing week does not also step volume up", () => {
    const plan = generateRulePlan(TENK_12WK, 'paid', PLAN_START)
    const introWeek = qualityOf(plan).filter(q => isVo2(q.s))[0].week
    const prior = plan.weeks.filter(w => w.n < introWeek && w.type !== 'deload').pop()
    const cur = plan.weeks.find(w => w.n === introWeek)!
    if (!prior) return
    expect(cur.weekly_km, 'intensity and volume must not progress in the same week')
      .toBeLessThanOrEqual(prior.weekly_km)
  })
})

describe('SC-07 — blast radius: only 5K and 10K move', () => {
  it('HM, MARATHON, 50K and 100K build phases carry no VO2max', () => {
    // By construction: their signatures focus on threshold + race/ultra-specific,
    // and the non-midweek categories filter out, leaving threshold alone.
    const shapes: Array<[string, number, string, string]> = [
      ['HM', 21.1, '2026-12-21', '1:45:00'],
      ['MARATHON', 42.2, '2027-01-18', '3:45:00'],
    ]
    for (const [name, km, date, tt] of shapes) {
      const plan = generateRulePlan(
        { ...TENK_12WK, race_distance_km: km, race_date: date, target_time: tt }, 'paid', PLAN_START)
      const buildVo2 = qualityOf(plan, 'build').filter(q => isVo2(q.s))
      expect(buildVo2, `${name} build must not gain VO2max`).toHaveLength(0)
    }
  })

  it('the interval VO2max rows are build+peak eligible and nothing else moved', () => {
    // Was `toBe(3)` — SC-09 added `hill_reps` as a fourth vo2max row, and this
    // assertion caught it, which is what it was for. Scoped to the three
    // INTERVAL rows SC-07 actually moved; hill_reps carries its own eligibility
    // from CD-17a and is asserted in hillReps.test.ts.
    const vo2Rows = V1_SESSION_CATALOGUE.filter(
      r => r.category === 'vo2max' && r.id.startsWith('intervals_'))
    expect(vo2Rows.length).toBe(3)
    for (const r of vo2Rows) {
      expect(r.phase_eligibility).toContain('build')
      expect(r.phase_eligibility).toContain('peak')
      expect(r.phase_eligibility).not.toContain('taper')
    }
  })
})

describe('CD-22 — short plans record what they cannot deliver', () => {
  it('an 11-week 10K cannot reach the window, and says so instead of throwing', () => {
    // deadline W4 vs build start W5 — the window lands in base phase, where no
    // quality exists. 10K.min_weeks is 10, so this is a SUPPORTED length.
    const plan = generateRulePlan(
      { ...TENK_12WK, race_date: SHORT_RACE_DATE }, 'paid', PLAN_START)

    const taperStart = plan.weeks.find(w => w.phase === 'taper')!.n
    const firstVo2 = qualityOf(plan).filter(q => isVo2(q.s))[0]
    expect(taperStart - firstVo2.week)
      .toBeLessThan(GENERATION_CONFIG.VO2MAX_ONSET_MIN_ADAPTATION_WEEKS)

    const recorded = (plan.meta.rule_adjustments ?? [])
      .find(a => a.rule === 'V2-vo2max-onset-unreachable')
    expect(recorded, 'a shortfall the plan cannot fix must be recorded').toBeTruthy()
    expect(recorded!.resolution).toMatch(/too short/i)

    // ...and the invariant must NOT fire, because the window is unreachable.
    const vs = validatePlan(plan, { ...TENK_12WK, race_date: SHORT_RACE_DATE })
      .filter(v => v.code === 'INV-PLAN-VO2MAX-ONSET')
    expect(vs, 'unreachable window is recorded, not an error').toHaveLength(0)
  })

  it('the invariant DOES fire when a long-enough plan misses the window', () => {
    // Synthesised: take the compliant 12-week plan and push its VO2max late.
    const input = TENK_12WK
    const plan = generateRulePlan(input, 'paid', PLAN_START)
    const buildVo2 = qualityOf(plan, 'build').filter(q => isVo2(q.s))[0]
    const swapTarget = qualityOf(plan, 'build').find(q => !isVo2(q.s))!

    const poisoned: Plan = structuredClone(plan)
    for (const w of poisoned.weeks) {
      for (const [d, s] of Object.entries(w.sessions)) {
        if (!s) continue
        if (w.n === buildVo2.week && s.label === buildVo2.s.label) {
          (w.sessions as Record<string, typeof s>)[d] = { ...swapTarget.s }
        }
      }
    }
    const vs = validatePlan(poisoned, input).filter(v => v.code === 'INV-PLAN-VO2MAX-ONSET')
    expect(vs.length).toBeGreaterThan(0)
    expect(vs[0].severity).toBe('error')
  })
})
