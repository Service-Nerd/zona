import { describe, it, expect } from 'vitest'
import { onRampCurve, onRampWeeksNeeded, assessOnRamp, generateBaseBuildPlan } from './baseBuildOnRamp'
import { GENERATION_CONFIG as C } from './generationConfig'
import type { GeneratorInput } from '@/types/plan'

const input = (over: Partial<GeneratorInput> = {}): GeneratorInput => ({
  race_distance_km: 42.195, race_date: '2027-04-25', days_available: 4,
  goal: 'finish', fitness_level: 'beginner', current_weekly_km: 10,
  longest_recent_run_km: 4, age: 30, injuries: [],
  recent_quality_training: 'none',
  // ⚠️ SPREAD LAST. The first cut of this helper omitted `...over` entirely, so
  // every case ran on the default input and ELEVEN TESTS PASSED without
  // exercising what they claimed. Two failed, which is the only reason it was
  // caught. A fixture that silently ignores its own argument is worse than no
  // fixture: it manufactures green.
  ...over,
} as unknown as GeneratorInput)

describe('§116 onRampCurve — §2 rate, §3 cadence', () => {
  it('climbs at §2s rate, not §57s flat ceiling — the defect this closes', () => {
    const c = onRampCurve(10, 3)
    expect(c[0]).toBe(10)
    expect(c[1]).toBeCloseTo(11, 1)
    expect(c[2]).toBeCloseTo(12.1, 1)
    // §57's curve would be 10, 11, 11 — flat from week 2 at any length.
    expect(c[2]).toBeGreaterThan(c[1])
  })

  it('dips on §3s cadence', () => {
    const c = onRampCurve(10, 6)
    const freq = C.BASE_BUILD_ONRAMP_DELOAD_FREQUENCY
    expect(c[freq - 1]).toBeLessThan(c[freq - 2])
  })

  // The deload RATCHET is a defect this repo has already recorded once.
  it('resumes the climb from the build line, not from the dip', () => {
    const c = onRampCurve(10, 6)
    const freq = C.BASE_BUILD_ONRAMP_DELOAD_FREQUENCY
    expect(c[freq]).toBeGreaterThan(c[freq - 2])
  })

  it('never hands over on a deload week', () => {
    for (let w = 2; w <= 16; w++) {
      const c = onRampCurve(10, w)
      expect(c[w - 1], `ramp of ${w} weeks ends in a dip`).toBeGreaterThanOrEqual(c[w - 2])
    }
  })
})

describe('§116 onRampWeeksNeeded', () => {
  it('reaches the target and reports the shortest ramp that does', () => {
    const w = onRampWeeksNeeded(8, 18)
    expect(w).toBeGreaterThan(0)
    expect(onRampCurve(8, w).at(-1)!).toBeGreaterThanOrEqual(18)
    expect(onRampCurve(8, w - 1).at(-1)!).toBeLessThan(18)
  })

  it('returns 0 when the runner is already there', () => {
    expect(onRampWeeksNeeded(20, 18)).toBe(0)
  })

  it('terminates rather than looping on an unreachable target', () => {
    expect(onRampWeeksNeeded(1, 9999)).toBe(C.BASE_BUILD_ONRAMP_MAX_WEEKS)
  })
})

describe('§116 assessOnRamp — the board amendments, each as an assertion', () => {
  it('offers a ramp to the runner §111 refuses, when the runway allows', () => {
    const a = assessOnRamp(input({ current_weekly_km: 10 }), 18, 29)
    expect(a.outcome).toBe('offered')
    expect(a.rampWeeks).toBeGreaterThan(0)
    expect(a.remainingWeeks).toBeGreaterThanOrEqual(C.BASE_BUILD_ONRAMP_MIN_REMAINING_WEEKS)
  })

  // McMillan, amendment 3 — §44's ratified threshold, not a new number.
  it('refuses when the ramp would leave under 16 weeks of race plan', () => {
    const a = assessOnRamp(input({ current_weekly_km: 10 }), 18, 18)
    expect(a.outcome).toBe('insufficient_runway')
    // ⚠️ and it still reports the numbers, so the runner can be told WHY.
    expect(a.rampWeeks).toBeGreaterThan(0)
    expect(a.remainingWeeks).toBeLessThan(C.BASE_BUILD_ONRAMP_MIN_REMAINING_WEEKS)
  })

  // Willy — run-walk is explicitly not scoped, and this is the boundary.
  it('declines below the floor where a RUNNING ramp is the right tool', () => {
    const a = assessOnRamp(input({ current_weekly_km: 3 }), 18, 40)
    expect(a.outcome).toBe('below_floor')
  })

  it('says not_needed rather than offering a ramp to nowhere', () => {
    expect(assessOnRamp(input({ current_weekly_km: 40 }), 18, 30).outcome).toBe('not_needed')
  })

  // §111 Am. 2 — the denominator is the volume the ENGINE starts from.
  it('starts from effectiveStartKm, not the raw wizard figure', () => {
    // ⚠️ `weeks_at_current_volume`, not an invented `fresh_return` flag. The
    // first cut used the latter, which is not a field on GeneratorInput, so the
    // scaling never applied and the test asserted 20 < 20. The product's own
    // spelling, every time — this repo has three injury types that were dead in
    // production for exactly this reason.
    const fresh = assessOnRamp(
      input({ current_weekly_km: 20, weeks_at_current_volume: 1 } as any), 30, 40)
    expect(fresh.startKm).toBeLessThan(20)
  })

  it('never reports offered without a positive ramp length', () => {
    for (const cwk of [6, 8, 10, 12, 15, 18, 25]) {
      const a = assessOnRamp(input({ current_weekly_km: cwk }), 18, 30)
      if (a.outcome === 'offered') expect(a.rampWeeks).toBeGreaterThan(0)
    }
  })
})

// ── §122 Amendment 2 — a benchmark derives a pace, so the ramp carries duration ──
//
// 🔴 §122 permits a missing `duration_mins` ONLY where no pace is derivable, and this
// module declined on the grounds that there is "no finished plan to read a pace from".
// True, and the wrong conclusion: a BENCHMARK derives one.
//
// 📐 Measured 2026-11-11 on LIVE data: 4 stored base-build plans carrying 51/51, 12/12,
// 30/30 and 7/7 sessions with no duration, and TWO of them carrying a stated 45-minute
// weekday cap that therefore never applied. That is the exact defect §122 was ratified to
// close (47.6% of foundation weekday sessions over budget), reopened by its second caller.
//
// 📐 After: with a benchmark 72/72 generated base-builds carry duration on EVERY session,
// against 0/72 before; 2,965 weekday sessions became cappable and 0 are over the stated
// cap. Without a benchmark: 0/72, which is §122's own decline and must stay that way.
describe('§122 Am. 2 — the base-build ramp sizes against the benchmark', () => {
  const DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const
  const WEEKDAY = new Set(['mon', 'tue', 'wed', 'thu', 'fri'])
  const todayIso = () => new Date().toISOString().slice(0, 10)
  // ⚠️ DERIVED FROM TODAY, never pinned (PINNED-CLOCK-01): `vdotFor` reads the real clock
  // to age the benchmark, so a literal date expires and this file would rot green.
  const benchDate = () => new Date(Date.now() - 14 * 864e5).toISOString().slice(0, 10)
  const raceDate = (w: number) => new Date(Date.now() + w * 7 * 864e5).toISOString().slice(0, 10)

  const build = (opts: { benchmark: boolean; cap?: number }) => {
    const input = {
      race_distance_km: 42.2, race_date: raceDate(29), goal: 'finish',
      user_declared_level: 'beginner', days_available: 3, current_weekly_km: 10,
      longest_recent_run_km: 5, age: 38, training_age: '1-2yr',
      recent_quality_training: 'occasional', injury_history: [], acknowledged_prep_warning: true,
      ...(opts.cap ? { max_weekday_mins: opts.cap } : {}),
      ...(opts.benchmark
        ? { benchmark: { type: 'race', distance_km: 5, time: '00:38:00', benchmark_date: benchDate() } }
        : {}),
    } as unknown as GeneratorInput
    // Built through `assessOnRamp`, the owner, rather than a hand-rolled assessment:
    // a fixture that invents `startKm` / `rampWeeks` is a fixture that stops matching
    // the producer (the `fixtures-must-use-product-values` class).
    const assessment = assessOnRamp(input, 18, 29)
    expect(assessment.outcome, 'the on-ramp was not offered \u2014 this fixture no longer reaches the code under test').toBe('offered')
    const plan = generateBaseBuildPlan(input, todayIso(), assessment)
    const out: { day: string; duration: number | null | undefined; pace: string | undefined }[] = []
    for (const w of plan.weeks) for (const d of DAYS) {
      const raw = (w.sessions as any)?.[d]
      const arr = raw == null ? [] : (Array.isArray(raw) ? raw : [raw])
      for (const s of arr) if (s && s.type !== 'rest') out.push({ day: d, duration: s.duration_mins, pace: s.pace_target })
    }
    expect(out.length, 'the ramp built no sessions — this check has stopped looking').toBeGreaterThan(0)
    return out
  }

  it('gives EVERY ramp session a duration when a benchmark is present', () => {
    const s = build({ benchmark: true })
    expect(s.filter(x => x.duration == null)).toEqual([])
  })

  it('gives every ramp session the easy pace BAND it was sized against', () => {
    // §122's pairing: the number that sizes the week is the number the card shows.
    const s = build({ benchmark: true })
    expect(s.filter(x => !x.pace)).toEqual([])
  })

  it('DECLINES with no benchmark, because a guessed pace is worse than none', () => {
    // §122 verbatim: "a foundation block sized against a guessed pace is worse than one
    // sized against none." The absence is the ruling, not a gap in it.
    const s = build({ benchmark: false })
    expect(s.every(x => x.duration == null)).toBe(true)
    expect(s.every(x => x.pace == null)).toBe(true)
  })

  it("holds the runner's stated weekday cap, which could not bind before", () => {
    // The whole point: the cap was skipped on `!s.duration_mins`. Two of the four live
    // plans carried a 45-minute cap against sessions with no duration at all.
    const cap = 30
    const weekdays = build({ benchmark: true, cap }).filter(x => WEEKDAY.has(x.day))
    // 🔴 THE POPULATION IS ASSERTED FIRST, AND THIS ARM WAS HOLLOW WITHOUT IT. Falsifying
    // against the pre-amendment code left it GREEN: with no durations the filter below
    // yields `[]` and "nothing is over the cap" is vacuously true. An empty population
    // must not read as a pass.
    const timed = weekdays.filter(x => x.duration != null)
    expect(timed.length, 'no weekday session carries a duration, so this arm proves nothing').toBeGreaterThan(0)
    expect(timed.length).toBe(weekdays.length)
    expect(timed.filter(x => (x.duration as number) > cap)).toEqual([])
  })
})
