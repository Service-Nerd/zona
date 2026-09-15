import { describe, it, expect } from 'vitest'
import { computePostRaceReshape, getDistanceBucket } from './postRaceReshape'
import { GENERATION_CONFIG as G } from '@/lib/plan/generationConfig'
import type { Plan, Week, Session, RaceResult } from '@/types/plan'

/**
 * §62 — the post-race recovery curve, and the quality blackout.
 *
 * Coming back too fast after a long race is the most common training error for
 * non-elites, and the reason it survives is that violating it causes NO visible
 * short-term harm: the runner feels fine at day +3. The cost arrives six to
 * eight weeks later as an injury, an illness, or a plateau nobody connects back
 * to the race.
 *
 * That is exactly the shape of failure this repo keeps finding — silent, not
 * crashing — and §62's whole table (six distances, two knobs each) had no test
 * at all. A curve that quietly stopped applying would look identical to one
 * that worked, for about two months.
 *
 * Not an invariant: this reshapes an EXISTING plan against a logged result.
 * `validatePlan` runs at generation, before any race has been run.
 */
const session = (type: Session['type'], km: number): Session => ({
  type, label: type, distance_km: km, duration_mins: null,
} as unknown as Session)

/**
 * A plan with `total` weeks, each 120 km over 4 running days + 2 rest, race in
 * `raceWeekN`.
 *
 * ⚠️ THE WEEK IS BIG ON PURPOSE. At 40 km/week a marathon's first recovery week
 * targets 8 km, and split 4 ways that is 2 km — under `toRecoveryRun`'s 3 km
 * floor. Every session then clamps to 3 whatever the split, so the budget
 * arithmetic is unobservable and a broken `activeDays` filter changes nothing.
 * `npm run test:liveness` proved it: adding rest days alone did not kill the
 * mutant, because the floor was doing the answering.
 */
const planOf = (total: number, raceWeekN: number, raceKm: number): Plan => {
  const weeks: Week[] = Array.from({ length: total }, (_, i) => ({
    n: i + 1, date: '2026-04-27', phase: 'build', type: i + 1 === raceWeekN ? 'race' : 'build',
    weekly_km: 120,
    sessions: {
      // REST DAYS ARE PART OF THE FIXTURE, not decoration. `activeDays` counts
      // non-rest sessions to divide the week's recovery budget between them, and
      // a fixture with no rest day makes that filter untestable: every session
      // counts either way, so breaking the filter changes nothing.
      mon: session('rest', 0),    wed: session('rest', 0),
      tue: session('quality', 24), thu: session('easy', 24),
      sat: session('easy', 24),   sun: session('easy', 48),
    },
  } as unknown as Week))
  return { meta: { race_distance_km: raceKm }, weeks } as unknown as Plan
}

const reshape = (raceKm: number, weeksAfter: number) => {
  const raceWeekN = 2
  const plan = planOf(raceWeekN + weeksAfter, raceWeekN, raceKm)
  return computePostRaceReshape(plan, { distance_km: raceKm } as RaceResult, raceWeekN)
}

const kmOf = (w: Week) => w.weekly_km ?? 0
const typesIn = (w: Week) => Object.values(w.sessions).filter(Boolean).map(s => (s as Session).type)
const runsOf = (w: Week) => (Object.values(w.sessions).filter(Boolean) as Session[])
  .filter(s => s.type !== 'rest')

describe('§62 — the distance bucket picks the curve', () => {
  it('maps each race distance to its bucket, including the gaps between them', () => {
    expect(getDistanceBucket(5)).toBe('5K')
    expect(getDistanceBucket(10)).toBe('10K')
    expect(getDistanceBucket(21.1)).toBe('HM')
    expect(getDistanceBucket(42.2)).toBe('MARATHON')
    expect(getDistanceBucket(50)).toBe('50K')
    expect(getDistanceBucket(100)).toBe('100K')
    // A 32 km "marathon" (a DNF at 30k, a re-measured course) still gets the
    // marathon curve rather than falling to HM.
    expect(getDistanceBucket(32)).toBe('MARATHON')
  })

  it('puts every bucket EDGE on the right side of the line', () => {
    // Added 2026-09-15 by `npm run test:liveness`: flipping `km <= 6` to `km < 6`
    // left this file green. The bucket boundaries were asserted from the middle
    // of each band (5, 10, 21.1, 42.2) and never at the edge, so an off-by-one
    // would have silently handed a 6 km race the 10K recovery curve.
    expect(getDistanceBucket(6)).toBe('5K')
    expect(getDistanceBucket(6.1)).toBe('10K')
    expect(getDistanceBucket(12)).toBe('10K')
    expect(getDistanceBucket(12.1)).toBe('HM')
    expect(getDistanceBucket(23)).toBe('HM')
    expect(getDistanceBucket(23.1)).toBe('MARATHON')
    expect(getDistanceBucket(45)).toBe('MARATHON')
    expect(getDistanceBucket(45.1)).toBe('50K')
    expect(getDistanceBucket(75)).toBe('50K')
    expect(getDistanceBucket(75.1)).toBe('100K')
  })

  it('every bucket in §62\'s table is reachable from a real race distance', () => {
    const reached = new Set([5, 10, 21.1, 42.2, 50, 100].map(getDistanceBucket))
    expect(Array.from(reached).sort())
      .toEqual(Object.keys(G.POST_RACE_RECOVERY_BY_DISTANCE).sort())
  })
})

describe('§62 — the volume curve is applied week by week', () => {
  it('sets each recovery week to its configured share of plan peak', () => {
    const out = reshape(42.2, 4)!
    const curve = G.POST_RACE_RECOVERY_BY_DISTANCE.MARATHON.volume_curve_pct
    const after = out.reshapedPlan.weeks.slice(2)   // weeks 3..6
    curve.forEach((pct, i) => {
      expect(kmOf(after[i]), `week +${i + 1} of a marathon recovery`)
        .toBeCloseTo(out.peakWeeklyKm * pct / 100, 1)
    })
  })

  it('the curve only ever climbs — recovery does not zig-zag', () => {
    for (const cfg of Object.values(G.POST_RACE_RECOVERY_BY_DISTANCE)) {
      const c = cfg.volume_curve_pct as readonly number[]
      for (let i = 1; i < c.length; i++) {
        expect(c[i], `curve went backwards at index ${i}`).toBeGreaterThan(c[i - 1])
      }
      expect(c[c.length - 1], 'a recovery curve that ends at full volume is not a curve')
        .toBeLessThan(100)
    }
  })

  it('a longer race gets a deeper and longer curve', () => {
    // The whole point of keying by distance: a 100K is not a slower marathon.
    const m = G.POST_RACE_RECOVERY_BY_DISTANCE.MARATHON
    const k = G.POST_RACE_RECOVERY_BY_DISTANCE['100K']
    const t = G.POST_RACE_RECOVERY_BY_DISTANCE['10K']
    expect(k.volume_curve_pct[0]).toBeLessThan(m.volume_curve_pct[0])
    expect(m.volume_curve_pct[0]).toBeLessThan(t.volume_curve_pct[0])
    expect(k.volume_curve_pct.length).toBeGreaterThan(m.volume_curve_pct.length)
    expect(k.quality_blackout_weeks).toBeGreaterThan(m.quality_blackout_weeks)
  })

  it('leaves weeks past the curve untouched', () => {
    const out = reshape(10, 4)!   // 10K curve is 2 weeks long
    const curveLen = G.POST_RACE_RECOVERY_BY_DISTANCE['10K'].volume_curve_pct.length
    expect(out.weeksAffected).toHaveLength(curveLen)
    expect(kmOf(out.reshapedPlan.weeks[2 + curveLen]), 'a week beyond the curve was reshaped').toBe(120)
  })
})

describe('§62 — the quality blackout is the half that prevents the injury', () => {
  it('converts quality and long work to recovery for the blackout weeks', () => {
    const out = reshape(42.2, 4)!
    const blackout = G.POST_RACE_RECOVERY_BY_DISTANCE.MARATHON.quality_blackout_weeks
    for (let i = 0; i < blackout; i++) {
      const types = typesIn(out.reshapedPlan.weeks[2 + i])
      expect(types, `week +${i + 1} still carries quality`).not.toContain('quality')
      expect(types).toContain('recovery')
    }
  })

  it('returns quality once the blackout ends, not at the end of the curve', () => {
    // "Quality returns when the body can do adaptive work, not junk miles at
    // high intensity" — the blackout is SHORTER than the curve, deliberately.
    const cfg = G.POST_RACE_RECOVERY_BY_DISTANCE.MARATHON
    expect(cfg.quality_blackout_weeks).toBeLessThan(cfg.volume_curve_pct.length)
    const out = reshape(42.2, 4)!
    expect(typesIn(out.reshapedPlan.weeks[2 + cfg.quality_blackout_weeks])).toContain('quality')
  })

  it('splits the week\'s budget between the RUNNING days only', () => {
    // `npm run test:liveness` flipped `s && s.type !== 'rest'` to `s || ...` and
    // this file stayed green, because the fixture had no rest day: `activeDays`
    // was 4 either way. With a rest day present the mutation counts 6 instead of
    // 4, and every converted recovery run is sized a third too short — the
    // runner is handed a week of token jogs and the weekly total still reads
    // correct, which is exactly the kind of wrong nobody spots.
    const out = reshape(42.2, 4)!
    const wk = out.reshapedPlan.weeks[2]                   // first recovery week
    const curvePct = G.POST_RACE_RECOVERY_BY_DISTANCE.MARATHON.volume_curve_pct[0]
    const targetKm = out.peakWeeklyKm * curvePct / 100
    expect(runsOf(wk).length, 'rest days leaked into the running count').toBe(4)
    // Only the CONVERTED session is sized from the budget; the untouched easy
    // runs are scaled by the curve percentage instead. Asserting both against the
    // budget was wrong and the run said so.
    const converted = (wk.sessions as Record<string, Session | undefined>).tue!
    expect(converted.type, 'tue was the quality session and should now be recovery').toBe('recovery')
    const budget = targetKm / 4
    expect(converted.distance_km!, 'the converted run was not sized against a 4-way split')
      .toBeCloseTo(Math.max(3, Math.round(budget * 2) / 2), 1)
    // The number that proves the filter matters: counting the two rest days would
    // give a 6-way split and a visibly shorter run.
    expect(converted.distance_km!, 'sized as though rest days were training days')
      .not.toBeCloseTo(Math.max(3, Math.round((targetKm / 6) * 2) / 2), 1)
  })

  it('marks the first week after the race as a deload, so the runner sees it', () => {
    const out = reshape(42.2, 4)!
    expect(out.reshapedPlan.weeks[2].type).toBe('deload')
    expect(out.reshapedPlan.weeks[2].label).toBe('Recovery week')
  })
})

describe('§62 — when there is nothing to reshape', () => {
  it('returns null when the race is the final week', () => {
    const plan = planOf(2, 2, 42.2)
    expect(computePostRaceReshape(plan, { distance_km: 42.2 } as RaceResult, 2)).toBeNull()
  })

  it('protects a following race\'s taper rather than reshaping into it', () => {
    // TAPER_PROTECTION_WEEKS worth of gap before the next race is off limits —
    // a recovery curve laid over a taper is two reductions stacked.
    const plan = planOf(4, 2, 42.2)
    ;(plan.weeks[3] as unknown as { type: string }).type = 'race'
    expect(computePostRaceReshape(plan, { distance_km: 42.2 } as RaceResult, 2)).toBeNull()
  })
})
