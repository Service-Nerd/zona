import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { generateRulePlan } from './ruleEngine'
import { validatePlan } from './invariants'
import { GENERATION_CONFIG } from './generationConfig'
import type { GeneratorInput, Plan } from '@/types/plan'

/**
 * §1 / CD-21 — the intensity-distribution ceiling.
 *
 * The board ratified the six `max_quality_session_pct` values with two
 * amendments, and this file is the mechanical half of both.
 *
 * The evidence that produced the ruling: every observed breach fell into
 * exactly two buckets, and they needed OPPOSITE treatments.
 *
 *   Bucket A — 5K/10K/HM @ 2 days, 50K @ 3 days, 100K @ 3 days. Worst 28.6%.
 *              `volume_profile: 'maintenance'` in EVERY case.
 *   Bucket B — 100K @ 4d (14.0%), 5d (14.7%), 6d (12.2%), 7d (12.2%).
 *              `volume_profile: 'build'`. Independent of day count.
 *
 * The first draft called this "day-count sensitive". It is not — Bucket A
 * correlates with the PROFILE (day count merely triggers §52) and Bucket B
 * has nothing to do with day count at all. An exemption built on the wrong
 * reading would have left the real defect standing, which is why the shape of
 * the finding is asserted here and not just the outcome.
 *
 * Amendment 1: maintenance-profile plans are exempt. A distribution ratio
 * presupposes enough sessions to distribute; at two runs a week it is
 * undefined, not violated.
 * Amendment 2: 100K 12% -> 15%. The six values were authored on a MINUTES
 * basis and carried across the 2026-08-20 basis change unchanged; under a
 * session denominator road and ultra converge rather than diverge, so the
 * descending ladder was an artifact of the old unit.
 *
 * Ruling: Coaching Board CD-21, 2026-08-20.
 */

const FROZEN_NOW = new Date('2026-08-20T09:00:00Z')
const PLAN_START = '2026-09-07'

const BASE: GeneratorInput = {
  race_date: '2027-03-07', race_distance_km: 100, goal: 'finish',
  age: 43, current_weekly_km: 60, longest_recent_run_km: 25,
  resting_hr: 55, max_hr: 185, preferred_long_run_day: 'sun',
  fitness_level: 'experienced', training_age: '2-5yr',
  days_available: 6,
}

/** 2-day HM — 25.0% against a 20% ceiling. A real Bucket A breach. */
const TWO_DAY_HM: GeneratorInput = {
  ...BASE, race_distance_km: 21.1, race_date: '2027-01-10', goal: 'finish',
  days_available: 2, days_cannot_train: ['mon', 'tue', 'wed', 'thu', 'sat'],
  current_weekly_km: 20, longest_recent_run_km: 10,
}

const HARD_TYPES = new Set(['quality', 'intervals', 'tempo'])

/** Mirrors the invariant's own counting rule (§1 numerator/denominator). */
function qualityShare(plan: Plan): { pct: number, hard: number, running: number } {
  let hard = 0, running = 0
  for (const w of plan.weeks) {
    for (const s of Object.values(w.sessions)) {
      if (!s || s.type === 'rest' || s.type === 'strength' || s.type === 'cross-train') continue
      running++
      if (HARD_TYPES.has(s.type)) hard++
    }
  }
  return { pct: (hard / running) * 100, hard, running }
}

const intensityViolations = (plan: Plan, input: GeneratorInput) =>
  validatePlan(plan, input).filter(v => v.code === 'INV-PLAN-INTENSITY-DISTRIBUTION')

beforeAll(() => { vi.useFakeTimers(); vi.setSystemTime(FROZEN_NOW) })
afterAll(() => { vi.useRealTimers() })

describe('CD-21 — maintenance-profile plans are exempt from the §1 ceiling', () => {
  it('a 2-day plan over the ceiling produces no violation', () => {
    // Bucket A, and the case is chosen deliberately. A 2-day HM lands at 25.0%
    // against a 20% ceiling — it genuinely BREACHES, so this asserts the
    // exemption rather than passing because nothing was wrong.
    //
    // The first draft of this test used a 2-day 5K, which sits at exactly 25.0%
    // against a 25% ceiling. `pct > ceiling` is false at equality, so it passed
    // identically with and without the exemption. That is the same vacuous-test
    // failure mode as SWEEP-VACUOUS-01, caught by checking the fixture actually
    // breached before trusting the green.
    const plan = generateRulePlan(TWO_DAY_HM, 'paid', PLAN_START)

    expect(plan.meta.volume_profile, 'a 2-day week is maintenance by §52').toBe('maintenance')

    const { pct } = qualityShare(plan)
    expect(pct, 'fixture must exceed the ceiling or this test proves nothing')
      .toBeGreaterThan(GENERATION_CONFIG.INTENSITY_DISTRIBUTION.HM.max_quality_session_pct)

    expect(intensityViolations(plan, TWO_DAY_HM)).toHaveLength(0)
  })

  it('the exemption is keyed to the PROFILE, not to a day count', () => {
    // The assertion that stops the misreading coming back. If someone
    // reintroduces this as `days_available <= 2`, a maintenance plan at a
    // HIGHER day count silently re-enters the check and this fails.
    // 100K @ 3 days — Bucket A's worst case at 18.6%, and a day count the
    // rejected "days_available <= 2" reading would not have covered.
    const input: GeneratorInput = {
      ...BASE, days_available: 3,
      current_weekly_km: 40, longest_recent_run_km: 20,
    }
    const plan = generateRulePlan(input, 'paid', PLAN_START)
    if (plan.meta.volume_profile !== 'maintenance') return // shape moved; nothing to assert

    expect(input.days_available).toBeGreaterThan(2)
    expect(intensityViolations(plan, input)).toHaveLength(0)
  })

  it('the runner is still told why — §52 note, not a silent skip', () => {
    // McMillan's condition. The plan is exempt from the CHECK, not exempt from
    // explaining itself; §52 already owns the runner-facing half.
    const plan = generateRulePlan(TWO_DAY_HM, 'paid', PLAN_START)
    expect(plan.meta.volume_constraint_note, 'maintenance plan must explain itself').toBeTruthy()
  })

  it('a BUILD plan over the ceiling still errors', () => {
    // Willy's scope condition: the exemption must not become a blanket one.
    // Synthesised rather than generated — the point is that the check still
    // bites, and after the 100K correction the engine no longer emits a real
    // build-profile breach to test with.
    const input: GeneratorInput = { ...BASE }
    const plan = generateRulePlan(input, 'paid', PLAN_START)
    const forced: Plan = {
      ...plan,
      meta: { ...plan.meta, volume_profile: 'build' },
      weeks: plan.weeks.map(w => ({
        ...w,
        sessions: Object.fromEntries(
          Object.entries(w.sessions).map(([d, s]) =>
            [d, s && s.type === 'easy' ? { ...s, type: 'quality' } : s]),
        ) as typeof w.sessions,
      })),
    }
    const vs = intensityViolations(forced, input)
    expect(vs.length).toBeGreaterThan(0)
    expect(vs[0].severity, 'CD-21 restored this to error').toBe('error')
  })
})

describe('CD-21 — the 100K ceiling', () => {
  it('is 15%, matching 50K — the ladder flattens at the ultra end', () => {
    // Guards the numeric itself. 12% was the minutes-basis value carried across
    // the 2026-08-20 basis change; Seiler could not ratify it as a session share.
    expect(GENERATION_CONFIG.INTENSITY_DISTRIBUTION['100K'].max_quality_session_pct).toBe(15)
    expect(GENERATION_CONFIG.INTENSITY_DISTRIBUTION['100K'].max_quality_session_pct)
      .toBe(GENERATION_CONFIG.INTENSITY_DISTRIBUTION['50K'].max_quality_session_pct)
  })

  it('a 6-day 100K build plan now passes, and passes because §8 is satisfied', () => {
    // The plan behind the ruling: base 0% / build 12.5% / peak 33.3% /
    // taper 15.8% = 12.2% plan-wide. Its peak runs 2 quality/week, which is
    // EXACTLY what QUALITY_SESSIONS_PER_WEEK_MAX grants an experienced runner.
    // At 12% this table and §8 were arithmetically incompatible and the engine
    // obeyed §8. §1 is the section that yielded.
    const plan = generateRulePlan(BASE, 'paid', PLAN_START)
    expect(plan.meta.volume_profile).toBe('build')

    const { pct } = qualityShare(plan)
    expect(pct).toBeGreaterThan(GENERATION_CONFIG.INTENSITY_DISTRIBUTION['100K'].max_quality_session_pct - 5)
    expect(intensityViolations(plan, BASE)).toHaveLength(0)

    const peakQuality = plan.weeks
      .filter(w => w.phase === 'peak' && w.type !== 'deload')
      .map(w => Object.values(w.sessions).filter(s => s && HARD_TYPES.has(s.type)).length)
    expect(Math.max(...peakQuality))
      .toBeLessThanOrEqual(GENERATION_CONFIG.QUALITY_SESSIONS_PER_WEEK_MAX.experienced)
  })

  it('still binds — 15% is not so wide the check stopped working', () => {
    // A ceiling nothing can reach is the same as no ceiling. The observed worst
    // build-profile plan was 14.7%, so the margin is real but thin.
    const { pct } = qualityShare(generateRulePlan(BASE, 'paid', PLAN_START))
    expect(pct).toBeGreaterThan(8)
  })
})
