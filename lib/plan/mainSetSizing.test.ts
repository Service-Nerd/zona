import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { generateRulePlan } from './ruleEngine'
import { validatePlan } from './invariants'
import { GENERATION_CONFIG } from './generationConfig'
import { mainSetMinutes, SESSION_FORMAT } from './sessionFormat'
import { classifyStimulus } from './sessionRole'
import type { GeneratorInput, Plan } from '@/types/plan'

/**
 * SC-10 / CD-14 — quality session sizing.
 *
 * WHAT SHIPPED: the MEASUREMENT, not the fix. CD-14 ruled category-specific
 * sizing correct; it was built, measured against the property sweep, and did
 * not ship. These tests pin the defect and the reason, so neither is quietly
 * lost.
 *
 * The defect: a flat 18% of weekly volume for every quality session INVERTS the
 * main-set ordering. On the traced 12-week 10K, delivered main sets were
 *
 *     vo2max     30 and 32 min      <- the LARGEST sessions in the plan
 *     race pace  22 and 26 min
 *
 * when 25 minutes of threshold is a normal session and 25 minutes of VO2max is
 * a race.
 *
 * Why the fix did not ship, and it is NOT a calibration problem: sizing keys off
 * weekly volume, so the biggest sessions land in the biggest weeks whatever
 * their category — and VO2max is scheduled in peak, the biggest weeks of all.
 * A category percentage can only offset that by driving sessions under
 * MIN_SESSION_DISTANCE_KM. Swept 13-17%: 15% passed the canonical case then
 * failed at scale (187 ordering breaches, 220 undersized sessions, 37 peak
 * inversions), 17% broke the ordering outright.
 *
 * CORRECTED 2026-08-20: an earlier version of this note blamed the §23 peak
 * inversions on volume freed from quality being LOST at the §9 easy ceiling.
 * Measured, that is false — the redistribution preserves total weekly volume
 * and shifting the quality share moved a week by 0 km. Real mechanism filed as
 * VOL-SHORTFALL-01. The rejection of category sizing is unaffected: it rests on
 * the ordering and size-floor breaches, not on §23.
 *
 * Conclusion, which is about CD-14's PREMISE rather than its percentages:
 * share-of-weekly-volume cannot express "VO2max is the least sustainable per
 * minute". The main set needs sizing in absolute minutes. Tracked as
 * SIZING-REALLOC-01, paired with SC-08.
 */

const FROZEN_NOW = new Date('2026-08-20T09:00:00Z')
const PLAN_START = '2026-09-07'

const TENK: GeneratorInput = {
  race_date: '2026-11-30', race_distance_km: 10, goal: 'time_target',
  target_time: '0:44:59', days_available: 4, age: 43,
  current_weekly_km: 40, longest_recent_run_km: 18,
  resting_hr: 48, max_hr: 188, preferred_long_run_day: 'sun',
  benchmark: { type: 'race', distance_km: 10, time: '0:48:30' },
  fitness_level: 'experienced', training_age: '2-5yr',
}

const HARD = new Set(['quality', 'intervals', 'tempo'])

function maxMainSetByStimulus(plan: Plan): Record<string, number> {
  const out: Record<string, number> = {}
  for (const w of plan.weeks) {
    for (const s of Object.values(w.sessions)) {
      if (!s || !HARD.has(s.type)) continue
      const stim = classifyStimulus(s)
      if (!stim) continue
      out[stim] = Math.max(out[stim] ?? 0, mainSetMinutes(s.duration_mins ?? 0))
    }
  }
  return out
}

beforeAll(() => { vi.useFakeTimers(); vi.setSystemTime(FROZEN_NOW) })
afterAll(() => { vi.useRealTimers() })

describe('mainSetMinutes — the coaching-meaningful quantity', () => {
  it('accounts for the warm-up FLOOR, not a flat 80%', () => {
    // The floor is why the carve-out is not a fixed fraction, and why a short
    // taper session ends up mostly warm-up. A naive 80% would hide that.
    const u = SESSION_FORMAT.UNIVERSAL
    const short = 29
    expect(mainSetMinutes(short)).toBeCloseTo(short - u.quality_warmup_min_mins - short * 0.1, 5)
    expect(mainSetMinutes(short)).toBeLessThan(short * 0.8)

    // A long session is floor-free and reduces to the universal split.
    const long = 200
    expect(mainSetMinutes(long)).toBeCloseTo(long * u.main_pct / 100, 5)
  })

  it('never returns a negative main set', () => {
    expect(mainSetMinutes(5)).toBe(0)
    expect(mainSetMinutes(0)).toBe(0)
  })
})

describe('SC-10 — the ordering is measured, and currently violated by design', () => {
  it('the invariant computes the ordering across the plan', () => {
    const m = maxMainSetByStimulus(generateRulePlan(TENK, 'paid', PLAN_START))
    expect(m['vo2max'], 'traced plan must contain VO2max work').toBeDefined()
    expect(m['race_pace'], 'traced plan must contain race-pace work').toBeDefined()
  })

  it('is `warn`, not `error` — a known-open defect, declared AND exercised', () => {
    // §34's position, and the one CD-21 took on §1's ceiling: an unratified
    // value must be checked but must not throw at a runner.
    const plan = generateRulePlan(TENK, 'paid', PLAN_START)
    const vs = validatePlan(plan, TENK).filter(v => v.code === 'INV-PLAN-MAIN-SET-ORDERING')
    for (const v of vs) expect(v.severity).toBe('warn')
  })

  it('the inversion is REAL — pinning it so the fix cannot be lost', () => {
    // If this ever fails because the ordering came right, SIZING-REALLOC-01 has
    // effectively landed: flip the invariant to `error` and delete this test.
    const m = maxMainSetByStimulus(generateRulePlan(TENK, 'paid', PLAN_START))
    expect(
      m['vo2max'],
      'if VO2max is no longer the longest, the sizing defect is fixed — see SIZING-REALLOC-01',
    ).toBeGreaterThan(m['race_pace'] + GENERATION_CONFIG.MAIN_SET_ORDERING_TOLERANCE_MINS)
  })

  it('sizing is still the flat share the defect describes', () => {
    // Guards against a partial category table being reintroduced without the
    // volume-reallocation fix, which is what the sweep rejected.
    expect(GENERATION_CONFIG.QUALITY_SESSION_PCT_OF_WEEKLY).toBe(18)
  })

  it('the tolerance is grounded in rounding granularity, not chosen freely', () => {
    // One DISTANCE_ROUNDING_PRECISION_KM step at quality pace (~4:30-5:15/km) is
    // ~2.3-2.6 min. An ordering asserted finer than one rounding step is noise.
    const minsPerStep = GENERATION_CONFIG.DISTANCE_ROUNDING_PRECISION_KM * 5.25
    expect(GENERATION_CONFIG.MAIN_SET_ORDERING_TOLERANCE_MINS).toBeGreaterThanOrEqual(minsPerStep)
    expect(GENERATION_CONFIG.MAIN_SET_ORDERING_TOLERANCE_MINS).toBeLessThan(5)
  })
})
