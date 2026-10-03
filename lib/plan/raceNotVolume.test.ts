import { describe, it, expect } from 'vitest'
import { sumWeeklyKm } from './ruleEngine'
import { planScale } from './planScale'
import { validatePlan } from './invariants'
import type { Plan, Session, Week } from '@/types/plan'
import type { Day } from './days'
import type { PaceGuide } from './paceBands'

/**
 * §121 — THE RACE IS THE TEST, NOT THE TRAINING. The MECHANISM gate.
 *
 * §121's Config line names two mechanisms: *"An exclusion in `sumWeeklyKm` beside
 * `strength` and `rest`, and the same exclusion in `planScale`."*
 *
 * 🔴 ONLY ONE OF THE TWO HAD A TEST, AND IT WAS NOT THE ONE THE RUNNER READS.
 * `planScale.test.ts` has asserted its half since the ruling. `sumWeeklyKm` — which
 * produces every `week.weekly_km` on every screen — was covered only by
 * `INV-PLAN-RACE-NOT-VOLUME`, a plan-level proxy comparing the race week against the
 * peak phase. Measured 2026-10-03 across 39,632 generated plans, that proxy would
 * fail to notice a re-inclusion on **20,736 of 20,736 5K and 10K plans**, 9,552 of
 * 10,368 HMs and 2,764 of 8,528 marathons: race-week training volume is so reduced
 * that adding 5 or 10 km back does not lift it above a peak week. §121's own table
 * reads 5K 0% / 10K 0.3%, which looks like "the defect does not occur there" and is
 * partly "that shape of check cannot see it there".
 *
 * So this file tests the exclusion where it lives, for every distance, with no
 * population and no proxy. A `?? 0` or a dropped `|| s.type === 'race'` fails here
 * immediately rather than surviving in two of four race distances.
 */

const pace = { minPerKmEasy: 6 } as unknown as PaceGuide
const s = (over: Partial<Session>): Session => ({
  type: 'easy', label: 'x', distance_km: null, duration_mins: null, ...over,
} as unknown as Session)

describe('§121 mechanism — sumWeeklyKm excludes the race session', () => {
  // Every supported race distance, because the proxy's blindness is distance-shaped.
  for (const raceKm of [5, 10, 21.1, 42.2, 50]) {
    it(`a ${raceKm}km race contributes 0 to the weekly sum`, () => {
      const training: Partial<Record<Day, Session>> = {
        tue: s({ distance_km: 5 }), thu: s({ distance_km: 5 }),
      }
      const withoutRace = sumWeeklyKm(training, pace)
      const withRace = sumWeeklyKm(
        { ...training, sun: s({ type: 'race', distance_km: raceKm }) }, pace)
      expect(withoutRace).toBe(10)
      // The whole of §121 in one assertion.
      expect(withRace).toBe(withoutRace)
    })
  }

  it('still excludes strength and rest, and still COUNTS every real run', () => {
    // Guards the inverse error: an over-broad exclusion that quietly zeroes training.
    expect(sumWeeklyKm({ mon: s({ type: 'strength', duration_mins: 45 }) }, pace)).toBe(0)
    expect(sumWeeklyKm({ mon: s({ type: 'rest' }) }, pace)).toBe(0)
    expect(sumWeeklyKm({ mon: s({ type: 'quality', distance_km: 8 }) }, pace)).toBe(8)
    expect(sumWeeklyKm({ mon: s({ type: 'easy', distance_km: 6 }) }, pace)).toBe(6)
  })

  it('a DURATION-anchored race is excluded too — beginners carry no distance_km', () => {
    // SESSION-KM-01: 95.8% of a beginner's sessions are duration-anchored. An
    // exclusion that keyed off `distance_km != null` would leak the race back in
    // for exactly the cohort §121 was measured on (beginner 22%).
    expect(sumWeeklyKm({ sun: s({ type: 'race', duration_mins: 240 }) }, pace)).toBe(0)
  })

  it('planScale excludes it too — the SECOND mechanism §121 names', () => {
    const plan = {
      meta: { race_distance_km: 42.2 },
      weeks: [
        { n: 1, start_date: '2027-04-12', sessions: { tue: s({ distance_km: 10 }) } },
        { n: 2, start_date: '2027-04-19', sessions: { sun: s({ type: 'race', distance_km: 42.2 }) } },
      ] as unknown as Week[],
    } as unknown as Plan
    expect(planScale(plan)?.totalDistance).toBe('10km')
  })
})

/**
 * The PLAN-LEVEL invariant, and the shape it must NOT fire on.
 *
 * TAPER-OVER-PEAK-SLOW-01: `INV-PLAN-RACE-NOT-VOLUME` used to read every taper week
 * and raised `error` on 18 of 14,265 sweep plans where the inversion was §23's
 * ratified `structuralPeakInversion` — an under-delivered peak, declared on 18 of 18
 * via `volume_profile: 'maintenance'` + a `volume_constraint_note`. It is now scoped
 * to the race week.
 */
const planWith = (weeks: Partial<Week>[]): Plan => ({
  meta: { race_distance_km: 42.2, vdot: 40 },
  weeks: weeks.map(w => ({ sessions: {}, type: 'normal', ...w })),
} as unknown as Plan)

const raceNotVolumeOf = (p: Plan) =>
  validatePlan(p, { race_distance_km: 42.2 } as never)
    .filter(v => v.code === 'INV-PLAN-RACE-NOT-VOLUME')

describe('§121 invariant — scoped to the race week (TAPER-OVER-PEAK-SLOW-01)', () => {
  it('FIRES when the race week carries more training than the peak phase', () => {
    const p = planWith([
      { n: 1, phase: 'peak', weekly_km: 25 },
      { n: 2, phase: 'taper', weekly_km: 59, sessions: { sun: s({ type: 'race', distance_km: 42.2 }) } },
    ])
    // §121's own worst measured case: peak 25, race week 59.
    expect(raceNotVolumeOf(p).length).toBe(1)
  })

  it('does NOT fire on a non-race taper week above the peak — that is §23\'s inversion', () => {
    // The 18. Identical numbers to the arm above, with the race moved off the week.
    const p = planWith([
      { n: 1, phase: 'peak', weekly_km: 25 },
      { n: 2, phase: 'taper', weekly_km: 59 },
      { n: 3, phase: 'taper', weekly_km: 0, sessions: { sun: s({ type: 'race', distance_km: 42.2 }) } },
    ])
    expect(raceNotVolumeOf(p)).toEqual([])
  })

  it('stays silent when there is no peak phase — nothing to compare against', () => {
    const p = planWith([
      { n: 1, phase: 'base', weekly_km: 40 },
      { n: 2, phase: 'taper', weekly_km: 90, sessions: { sun: s({ type: 'race', distance_km: 42.2 }) } },
    ])
    expect(raceNotVolumeOf(p)).toEqual([])
  })

  it('finds the race week by TYPE, not by phase or position', () => {
    // A race week that is neither last nor phased 'taper' must still be checked.
    const p = planWith([
      { n: 1, phase: 'peak', weekly_km: 25 },
      { n: 2, phase: 'build', weekly_km: 59, sessions: { sun: s({ type: 'race', distance_km: 42.2 }) } },
      { n: 3, phase: 'taper', weekly_km: 10 },
    ])
    expect(raceNotVolumeOf(p).length).toBe(1)
  })
})
