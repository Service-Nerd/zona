import { describe, it, expect } from 'vitest'
import { computeTaperRecalibration } from './taperRecalibration'
import { GENERATION_CONFIG as G } from './generationConfig'
import type { Plan, Week, Session } from '@/types/plan'

/**
 * §68 — the taper is a reduction from what the BODY did, not from the spreadsheet.
 *
 * A runner who completed 60% of their planned peak carries none of the fatigue
 * the original taper was designed to dissipate. Tapering from a fiction does not
 * over-rest them; it mistargets them, and they arrive at the start line
 * under-recovered relative to what they actually ran.
 *
 * Nothing tested this. It is a one-shot, once-per-plan, entry-week-only
 * computation — four gates, each of which fails SILENTLY by returning
 * `applied: false` with a reason nobody reads. A gate that inverted would be
 * invisible until a runner's taper was wrong, and by then the race has happened.
 *
 * Not an invariant: it reads `weeklyActuals` — completed training — which no
 * generated plan contains. `validatePlan` runs before a single session is run.
 */
const session = (type: Session['type'], km: number): Session =>
  ({ type, label: type, distance_km: km } as unknown as Session)

/** 10 weeks: build 1-7, taper 8-9, race week 10. Pre-taper (wk 7) = 60 km. */
const planOf = (over: Partial<Plan['meta']> = {}): Plan => {
  const weeks: Week[] = Array.from({ length: 10 }, (_, i) => {
    const n = i + 1
    const phase = n >= 8 ? 'taper' : 'build'
    return {
      n, date: '2026-04-27', phase, type: n === 10 ? 'race' : phase,
      weekly_km: n === 7 ? 60 : n >= 8 ? 45 : 50,
      sessions: { tue: session('quality', 10), thu: session('easy', 10), sun: session('easy', 25) },
    } as unknown as Week
  })
  return {
    meta: { race_distance_km: 42.2, ...over },
    phases: [
      { name: 'build', start_week: 1, end_week: 7 },
      { name: 'taper', start_week: 8, end_week: 10 },
    ],
    weeks,
  } as unknown as Plan
}

const actuals = (...km: number[]) => new Map(km.map((v, i) => [i + 1, v]))
const run = (weeklyActuals: Map<number, number>, currentWeekN = 8, plan = planOf()) =>
  computeTaperRecalibration({ weeklyActuals, plan, currentWeekN })

// 60 km planned pre-taper; 85% of that is 51 km.
const UNDER = actuals(30, 32, 31, 34, 33)        // functional peak 33 → 55% of planned
const ON_TRACK = actuals(56, 58, 57, 59, 55)     // functional peak 58.5 → 98%

describe('§68 — the gate fires only at taper entry, once', () => {
  it('fires on the first taper week', () => {
    expect(run(UNDER, 8).applied).toBe(true)
  })

  it('does not fire mid-taper — the reduction is set at entry or not at all', () => {
    expect(run(UNDER, 9).applied).toBe(false)
    expect(run(UNDER, 9).skipReason).toMatch(/not taper entry/)
  })

  it('does not fire during the build', () => {
    expect(run(UNDER, 5).applied).toBe(false)
  })

  it('is idempotent — a re-run never compounds the reduction', () => {
    const once = run(UNDER, 8)
    expect(once.applied).toBe(true)
    const twice = computeTaperRecalibration({ weeklyActuals: UNDER, plan: once.plan!, currentWeekN: 8 })
    expect(twice.applied, 'a second pass would taper from the already-tapered figure').toBe(false)
    expect(twice.skipReason).toMatch(/already recalibrated/)
  })

  it('refuses on thin data rather than guessing from one week', () => {
    const thin = actuals(...Array(G.TAPER_RECAL_MIN_WEEKS_DATA - 1).fill(30))
    expect(run(thin, 8).applied).toBe(false)
    expect(run(thin, 8).skipReason).toMatch(/insufficient actual data/)
  })
})

describe('§68 — functional peak is the top-N average, not the single best week', () => {
  it('averages the top N so one outlier week is not read as adaptation', () => {
    // "Big weeks followed by collapses — a single peak week is an outlier, not
    // an adaptation signal." One 60 km week among 30s must not cancel the recal.
    const spiky = actuals(60, 28, 30, 29, 31)
    const r = run(spiky, 8)
    expect(G.TAPER_RECAL_FUNCTIONAL_PEAK_WEEKS).toBe(2)
    expect(r.functionalPeakKm).toBeCloseTo((60 + 31) / 2, 1)
    expect(r.applied, 'one big week cancelled the recalibration').toBe(true)
  })

  it('anchors the ratio to the planned week before the taper', () => {
    const r = run(UNDER, 8)
    expect(r.plannedPreTaperKm).toBe(60)
    expect(r.ratio).toBeCloseTo(r.functionalPeakKm! / 60, 3)
  })
})

describe('§68 — downward only, and only when the gap is material', () => {
  it('leaves an on-track runner\'s taper alone', () => {
    const r = run(ON_TRACK, 8)
    expect(r.applied).toBe(false)
    expect(r.skipReason).toMatch(/within tolerance/)
  })

  it('does NOT raise the taper for an overperformer', () => {
    // Deliberately excluded: a well-trained runner tapering below target arrives
    // fresh at no cost, and raising taper volume carries injury risk. §103's
    // benchmark recalibration is the right lever for overperformance, not this.
    const over = actuals(80, 82, 81, 79, 83)
    const r = run(over, 8)
    expect(r.applied).toBe(false)
    expect(r.ratio!).toBeGreaterThan(1)
  })

  it('the threshold is where it switches', () => {
    expect(G.TAPER_RECAL_VOLUME_THRESHOLD_PCT).toBe(85)
    const justUnder = actuals(50, 50, 50, 50)   // 50/60 = 83%
    const justOver  = actuals(52, 52, 52, 52)   // 52/60 = 87%
    expect(run(justUnder, 8).applied).toBe(true)
    expect(run(justOver, 8).applied).toBe(false)
  })

  it('EXACTLY at the threshold does NOT recalibrate', () => {
    // `npm run test:liveness` flipped `ratio >= threshold` to `>` and this file
    // stayed green: the fixtures sat at 83% and 87%, either side of the line,
    // never ON it. The comparison is inclusive on purpose — "within tolerance"
    // includes the tolerance — and at exactly 85% an off-by-one would start
    // rewriting the taper of a runner who hit their target.
    // 60 km planned x 0.85 = 51. Top-2 average of 51 and 51 is exactly 51.
    const exactly85 = actuals(51, 51, 40, 40)
    const r = run(exactly85, 8)
    expect(r.ratio).toBeCloseTo(0.85, 6)
    expect(r.applied, 'a runner exactly at the threshold had their taper rewritten').toBe(false)
    expect(r.skipReason).toMatch(/within tolerance/)
  })

  it('refuses when the planned pre-taper week is ZERO, rather than dividing by it', () => {
    // Flipping `plannedPreTaperKm <= 0` to `< 0` survived. Zero is the case that
    // actually occurs (a malformed or truncated plan); a negative never does. On
    // zero the guard is the only thing standing between this and ratio = Infinity,
    // which would silently read as "within tolerance" and skip with the WRONG
    // reason — the runner's taper left alone for a reason nobody could act on.
    const plan = planOf()
    ;(plan.weeks[6] as unknown as { weekly_km: number }).weekly_km = 0   // week 7, pre-taper
    const r = computeTaperRecalibration({ weeklyActuals: UNDER, plan, currentWeekN: 8 })
    expect(r.applied).toBe(false)
    expect(r.skipReason, 'a zero pre-taper week was divided by instead of refused')
      .toMatch(/pre-taper volume missing/)
    expect(r.ratio).toBeUndefined()
  })
})

describe('§68 — what the recalibrated taper actually looks like', () => {
  it('reduces every taper week below its original, and stamps the provenance', () => {
    const r = run(UNDER, 8)
    const before = planOf().weeks
    for (const n of r.weeksModified!) {
      expect(r.plan!.weeks[n - 1].weekly_km!, `week ${n}`)
        .toBeLessThan(before[n - 1].weekly_km!)
    }
    expect(r.plan!.meta.taper_recalibrated_at).toBeTruthy()
    expect(r.plan!.meta.functional_peak_km).toBeCloseTo(r.functionalPeakKm!, 0)
    expect(r.plan!.meta.planned_peak_km_at_recal).toBe(60)
  })

  it('never scales a REST day into a run', () => {
    // Flipping `!session || session.type === 'rest'` to `&&` survived: with `&&`
    // the skip needs a session that is BOTH null and typed 'rest', which is
    // impossible, so every rest day falls through to `scaleSession`. It happens
    // to be harmless today because `scaleSession` returns early on a session with
    // no `distance_km` — but that is a property of a DIFFERENT function, and the
    // taper's promise is that a rest day stays a rest day.
    const plan = planOf()
    for (const w of plan.weeks) {
      if (w.phase !== 'taper') continue
      const sess = w.sessions as Record<string, unknown>
      sess.wed = { type: 'rest', label: 'Rest' }
      // An EXPLICIT undefined day, which `Object.entries` still yields. This is
      // the half of the guard that is genuinely load-bearing: with `&&` the
      // expression becomes `!session && session.type === 'rest'`, which reads
      // `.type` off undefined and throws. Without an undefined day in the
      // fixture the mutation is equivalent, because `scaleSession` early-returns
      // on any session with no `distance_km` and a rest day has none — so the
      // rest-type assertion alone could never have caught it.
      sess.fri = undefined
    }
    const r = computeTaperRecalibration({ weeklyActuals: UNDER, plan, currentWeekN: 8 })
    expect(r.applied).toBe(true)
    for (const n of r.weeksModified!) {
      const rest = (r.plan!.weeks[n - 1].sessions as Record<string, { type?: string } | undefined>).wed
      expect(rest?.type, `week ${n}'s rest day was rewritten`).toBe('rest')
    }
  })

  it('leaves the RACE week exactly as written (§26)', () => {
    // Shakeouts are volume-irrelevant and race-week structure is sacred.
    const r = run(UNDER, 8)
    expect(r.weeksModified).not.toContain(10)
    expect(r.plan!.weeks[9]).toEqual(planOf().weeks[9])
  })

  it('steps DOWN gradually — the first taper week is not already at full depth', () => {
    // `npm run test:liveness` swapped `Math.max(1, taperPhaseWeeks - 1)` for
    // `Math.min` and this file stayed green. That halves `fullTaperWeeks`, which
    // DOUBLES the per-week reduction step, so the runner drops to full taper
    // depth in week one instead of over the taper. Every existing assertion
    // (descends, below original, race week untouched) still held, because they
    // check ORDER and not MAGNITUDE.
    //
    // §6's taper is graduated: volume drops sharply, but across the taper.
    const r = run(UNDER, 8)
    const weeks = r.weeksModified!.map(n => r.plan!.weeks[n - 1].weekly_km!)
    expect(weeks.length, 'need at least two taper weeks to test a gradient')
      .toBeGreaterThan(1)
    const peak = r.functionalPeakKm!
    const firstCut = (peak - weeks[0]) / peak * 100
    const lastCut  = (peak - weeks[weeks.length - 1]) / peak * 100
    const fullReduction = G.TAPER_BY_DISTANCE.MARATHON.volume_reduction_pct
    expect(firstCut, 'the first taper week is already at full depth — no gradient')
      .toBeLessThan(fullReduction - 1)
    expect(lastCut).toBeGreaterThan(firstCut)
  })

  it('still descends across the taper — recalibrating is not flattening', () => {
    const r = run(UNDER, 8)
    const tapers = r.weeksModified!.map(n => r.plan!.weeks[n - 1].weekly_km!)
    for (let i = 1; i < tapers.length; i++) {
      expect(tapers[i], 'taper week volumes stopped descending').toBeLessThan(tapers[i - 1])
    }
  })
})
