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

// 🔴 POSTRACE-ANCHOR-DIMENSION-01 (2026-11-10) — FOUR DEFECTS IN THIS FILE'S PRODUCER, MEASURED.
//
// Run on an 8-week plan with a marathon result, `reshapedPlan` contained:
//   **(1)** `toRecoveryRun` computed `km / (duration_mins / distance_km)`, which is **km² per
//     minute, not minutes** — a recovery run came back as **`3 km in 0.5 min`**, shown to the
//     runner as "3 km · 0 min";
//   **(2)** `scaleSession` cut the distance and left `duration_mins` **stale** —
//     **`4 km in 140 min`**;
//   **(3)** the same `if (!session.distance_km) return session` guard, so a duration-anchored
//     plan reported **`sessionsModified: 2` against 6**;
//   **(4)** a hardcoded **`Math.max(3, …)`** floor — the `MIN_SESSION_DISTANCE_KM` bypass that
//     `TAPER-FLOOR-FLAT-01` moved the taper off on 2026-09-19 and nobody carried across.
//
// All four now come from `SCALE-SESSION-OWNER-01`. ⚠️ **The floor moved 3 km → the resolved
// `floors.easy` (4 km with no recorded `generator_input`), which is a real change in what a
// recovery week prescribes** and is declared rather than absorbed.
/** Both anchors, which is what the engine actually stamps (0 of 48,221 carry distance alone). */
const both = (type: Session['type'], km: number, mins: number): Session =>
  ({ type, label: type, distance_km: km, duration_mins: mins, pace_target: '6:00-6:30 /km' } as unknown as Session)

const timed = (type: Session['type'], mins: number): Session =>
  ({ type, label: type, duration_mins: mins, pace_target: '6:00-6:30 /km' } as unknown as Session)

/** The same fixture, DURATION-anchored — the beginner's plan shape. */
const timedPlanOf = (total: number, raceWeekN: number, raceKm: number): Plan => {
  const plan = planOf(total, raceWeekN, raceKm)
  for (const w of plan.weeks) {
    w.sessions = {
      mon: session('rest', 0), wed: session('rest', 0),
      tue: timed('quality', 150), thu: timed('easy', 150),
      sat: timed('easy', 150), sun: timed('easy', 300),
    } as Week['sessions']
  }
  return plan
}

describe('POSTRACE-ANCHOR-DIMENSION-01 — the reshape respects the anchor and the runner\'s floors', () => {
  it('🔴 a converted recovery run gets a SANE duration — it used to be km² per minute', () => {
    // ⚠️ THIS ARM CANNOT USE THIS FILE'S OWN `session()` HELPER, and that is itself a finding.
    // It stamps `duration_mins: null` with no `pace_target`, so a converted session has nothing
    // to derive a duration from and `undefined` is the honest answer — the arm failed on
    // correct code until the fixture was corrected. **Production does not emit that shape:**
    // measured over 48,221 generated long runs, `distance_km` present WITHOUT `duration_mins`
    // never occurs (0 cases), while 34,264 carry both. Fixtures must use the product's values.
    const plan = planOf(5, 2, 42.2)
    for (const w of plan.weeks) {
      w.sessions = {
        mon: session('rest', 0), wed: session('rest', 0),
        tue: both('quality', 24, 150), thu: both('easy', 24, 150),
        sat: both('easy', 24, 150),    sun: both('easy', 48, 300),
      } as Week['sessions']
    }
    const r = computePostRaceReshape(plan, { distance_km: 42.2 } as RaceResult, 2)!
    const recovery = r.reshapedPlan.weeks
      .flatMap(w => Object.values(w.sessions ?? {}) as (Session | undefined)[])
      .filter((x): x is Session => !!x && x.type === 'recovery')
    expect(recovery.length, 'no session was converted, so this arm proves nothing').toBeGreaterThan(0)
    for (const x of recovery) {
      // `3 km in 0.5 min` was the old shape. A real recovery run is km × minutes per km.
      expect(x.duration_mins, `recovery run of ${x.distance_km}km in ${x.duration_mins}min`)
        .toBeGreaterThan(5)
      // …and it is PROPORTIONATE to the distance, not merely non-zero.
      expect(x.duration_mins! / x.distance_km!, 'the pace implied by the recovery run is wrong')
        .toBeGreaterThan(3)
    }
  })

  it('🔴 a DURATION-anchored plan is reshaped too — it used to report 2 of 6', () => {
    const plan = timedPlanOf(5, 2, 42.2)
    const before = JSON.stringify(plan.weeks.map(w => w.sessions))
    const r = computePostRaceReshape(plan, { distance_km: 42.2 } as RaceResult, 2)!
    expect(r.sessionsModified, 'the timed sessions were skipped').toBeGreaterThan(2)
    expect(JSON.stringify(r.reshapedPlan.weeks.map(w => w.sessions))).not.toBe(before)
    // And every surviving timed session came DOWN: this is a recovery curve.
    for (const w of r.reshapedPlan.weeks) {
      if (w.n <= 2) continue
      for (const x of Object.values(w.sessions ?? {}) as (Session | undefined)[]) {
        if (!x?.duration_mins || x.type === 'rest') continue
        expect(x.duration_mins, 'a recovery-week session grew').toBeLessThan(301)
      }
    }
  })

  it('🔴 the floor is the RUNNER\'S, not a hardcoded 3', () => {
    // TAPER-FLOOR-FLAT-01's fix, finally applied here.
    //
    // ⚠️ MY FIRST VERSION OF THIS ARM WAS HOLLOW AND TWO MUTATIONS PROVED IT: restoring the
    // hardcoded `3` in either place left all 17 arms green, because **nothing in the 120 km
    // fixture is small enough for any floor to bind.** A floor can only be tested on a session
    // the scale would push below it, so the volume has to be small enough that it does.
    const plan = planOf(5, 2, 42.2)
    for (const w of plan.weeks) {
      w.weekly_km = 20
      w.sessions = {
        mon: session('rest', 0), wed: session('rest', 0),
        tue: both('quality', 5, 32), thu: both('easy', 5, 32),
        sat: both('easy', 4, 25),    sun: both('easy', 6, 38),
      } as Week['sessions']
    }
    const r = computePostRaceReshape(plan, { distance_km: 42.2 } as RaceResult, 2)!
    const dists = r.reshapedPlan.weeks
      .filter(w => w.n > 2)
      .flatMap(w => Object.values(w.sessions ?? {}) as (Session | undefined)[])
      .filter((x): x is Session => !!x && x.type !== 'rest' && x.distance_km != null)
      .map(x => x.distance_km!)
    expect(dists.length, 'no scaled sessions to measure').toBeGreaterThan(0)
    // With the hardcoded 3 these land at 3; with the resolved floor, at MIN_SESSION_DISTANCE_KM.
    expect(Math.min(...dists), `smallest session ${Math.min(...dists)}km is under the floor`)
      .toBeGreaterThanOrEqual(G.MIN_SESSION_DISTANCE_KM.easy)
    // The floor must BIND here or the arm is vacuous again.
    expect(dists.some(d => d === G.MIN_SESSION_DISTANCE_KM.easy),
      'nothing was floored, so this arm cannot tell the two floors apart').toBe(true)
    // And the old hardcoded 3 is strictly below it, which is what makes them distinguishable.
    expect(G.MIN_SESSION_DISTANCE_KM.easy, 'the floor no longer exceeds the old hardcoded 3')
      .toBeGreaterThan(3)
  })

  it('a session whose distance moves carries its duration with it', () => {
    const plan = planOf(5, 2, 42.2)
    for (const w of plan.weeks) {
      ;(w.sessions as Record<string, Session>).sun =
        ({ type: 'easy', label: 'easy', distance_km: 48, duration_mins: 336, pace_target: '6:00-6:30 /km' } as unknown as Session)
    }
    const r = computePostRaceReshape(plan, { distance_km: 42.2 } as RaceResult, 2)!
    for (const w of r.reshapedPlan.weeks) {
      if (w.n <= 2) continue
      const sun = (w.sessions as Record<string, Session>).sun
      if (!sun || sun.distance_km === 48) continue
      expect(sun.duration_mins, `${sun.distance_km}km still carries ${sun.duration_mins}min`).toBeLessThan(336)
    }
  })
})
