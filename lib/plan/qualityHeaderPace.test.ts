import { describe, it, expect } from 'vitest'
import { qualityHeaderPace } from './qualityHeaderPace'
import { generateRulePlan } from './ruleEngine'
import { validatePlan } from './invariants'
import { PINNED_PLAN_START_0907 } from './__fixtures__/pinnedPlanStart'
import type { DerivedSet } from './resolveMainSet'
import type { GeneratorInput, Plan } from '@/types/plan'

/**
 * RECAL-PACE-TWO-WRITER-01 Stage 1 — the header owner.
 *
 * `verify:parity` proves the extraction changed nothing (6,066 cases,
 * byte-for-byte). It CANNOT prove the owner is reached: dead code is also
 * byte-for-byte identical. The last describe block is that proof.
 */

const BAND = '5:36–5:52 /km'

const set = (paces: (string | null)[]): DerivedSet => ({
  version: 2,
  blocks: [{
    repeat: 1,
    steps: paces.map(p => ({
      role: 'work' as const, modality: 'run' as const,
      length: '5 min', pace: p, advance: 'auto' as const,
    })),
  }],
})

describe('qualityHeaderPace — the three branches', () => {
  it('a rep plan wins, and is formatted as its ±2% band', () => {
    // 5 min/km centre → ±2% → 4:54–5:06
    expect(qualityHeaderPace({ repWorkPaceMinPerKm: 5, derivedSet: set(['9:99 /km']), categoryBand: BAND }))
      .toBe('4:54–5:06 /km')
  })

  it('with no rep plan, a single work pace IS the header', () => {
    expect(qualityHeaderPace({ derivedSet: set(['5:12–5:27 /km']), categoryBand: BAND }))
      .toBe('5:12–5:27 /km')
  })

  it('repeated work steps at the SAME pace still count as one', () => {
    expect(qualityHeaderPace({ derivedSet: set(['5:12–5:27 /km', '5:12–5:27 /km']), categoryBand: BAND }))
      .toBe('5:12–5:27 /km')
  })

  it('mixed work paces fall to the category band — §85 scope, not laziness', () => {
    expect(qualityHeaderPace({ derivedSet: set(['5:12–5:27 /km', '5:45–6:00 /km']), categoryBand: BAND }))
      .toBe(BAND)
  })

  it('an effort-governed row with no paced work step takes the category band', () => {
    expect(qualityHeaderPace({ derivedSet: set([null, null]), categoryBand: BAND })).toBe(BAND)
  })

  it('no derived set at all takes the category band', () => {
    expect(qualityHeaderPace({ categoryBand: BAND })).toBe(BAND)
    expect(qualityHeaderPace({ derivedSet: null, categoryBand: BAND })).toBe(BAND)
  })

  it('ignores recovery and transition steps — a header is not a jog', () => {
    const mixedRoles: DerivedSet = {
      version: 2,
      blocks: [{
        repeat: 1,
        steps: [
          { role: 'work', modality: 'run', length: '5 min', pace: '5:12–5:27 /km', advance: 'auto' },
          { role: 'recovery', modality: 'jog', length: '2 min', pace: '7:00–7:30 /km', advance: 'auto' },
          { role: 'transition', modality: 'run', length: '1 min', pace: '6:00–6:30 /km', advance: 'auto' },
        ],
      }],
    }
    expect(qualityHeaderPace({ derivedSet: mixedRoles, categoryBand: BAND })).toBe('5:12–5:27 /km')
  })
})

/**
 * ⚠️ THE ARM THAT PARITY CANNOT REPLACE.
 *
 * If the extraction had left the inline expression in place and the new module
 * unreferenced, every test above would still pass and parity would still report
 * IDENTICAL. This asserts the composer actually routes through the owner, by
 * asserting the PROPERTY the owner exists to maintain on real generated plans:
 * §120's header-vs-work agreement. Mutating `qualityHeaderPace` to return the
 * category band unconditionally turns this red, which is the §120 defect
 * restored.
 *
 * ⚠️ MEASURED, AND I HAD GUESSED WRONG BY 6×. The mutation produces **18**
 * violations over this grid, not the ~109 first written here from the 197
 * single-work-pace sessions it reaches. The gap is the point: the invariant
 * skips mixed-anchor rows, and for a row anchored at `T` the category band IS
 * the work band, so it sits inside §19's 3% and never fires. **Only rows
 * anchored away from T can expose this** — `cv_intervals`, `intervals_long`,
 * `intervals_short`. A mutation's blast radius is bounded by the rows whose
 * anchor differs from the category by more than the tolerance, which is not
 * the same set as the rows the code touches.
 */
describe('qualityHeaderPace — is it REACHED?', () => {
  const base = (o: Partial<GeneratorInput> = {}): GeneratorInput => ({
    race_date: '2027-03-21', race_distance_km: 21.1, goal: 'finish',
    benchmark: { type: 'race', distance_km: 5, time: '0:22:00' },
    current_weekly_km: 40, longest_recent_run_km: 14, days_available: 4, age: 35,
    preferred_long_run_day: 'sun', training_age: '2-5yr',
    user_declared_level: 'intermediate', recent_quality_training: 'regular',
    terrain: 'road', injury_history: [], hard_session_relationship: 'neutral',
    ...o,
  } as GeneratorInput)

  const GRID: GeneratorInput[] = [5, 10, 21.1, 42.2].flatMap(km =>
    [20, 40, 70].flatMap(weekly => [3, 4, 5].map(days => base({
      race_distance_km: km,
      race_date: km === 5 ? '2027-01-10' : km === 10 ? '2027-02-14' : km === 21.1 ? '2027-03-21' : '2027-06-06',
      current_weekly_km: weekly,
      longest_recent_run_km: Math.max(4, Math.round(weekly * 0.35)),
      days_available: days,
    }))))

  it('the composer routes through it — zero header-vs-work violations on real plans', () => {
    let generated = 0
    const violations: string[] = []
    for (const input of GRID) {
      let plan: Plan
      try { plan = generateRulePlan(input, 'paid', PINNED_PLAN_START_0907) } catch { continue }
      generated++
      for (const v of validatePlan(plan, input)) {
        if (v.code === 'INV-PLAN-HEADER-PACE-MATCHES-WORK') violations.push(v.message ?? v.code)
      }
    }
    // An empty grid would pass the assertion below for the wrong reason.
    expect(generated).toBeGreaterThanOrEqual(30)
    expect(violations).toEqual([])
  })
})
