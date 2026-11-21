// ONRAMP-INJURY-CLIMB-01 — §116 Am. 16 (Coaching Board 2026-11-21, ADR-027 hotfix 2).
//
// A knee/shin runner's on-ramp uses the race engine's own combination of §2, §2 Am. 2 and §2 Am. 3, through ONE
// owner (`buildWeekCeilingKm`): ordinary weeks ≤ +5%, an 85% deload of the week as prescribed, a bounceback that
// returns to the pre-deload week and no higher. Before: the ramp read no injury history (worst ordinary +10.7%,
// worst bounceback +21.4% over pre-deload). Attempt 1 implemented §2 Am. 1's capped bounceback, which Am. 3
// withdrew, and the curve declined.
import { describe, it, expect } from 'vitest'
import { onRampCurve, onRampWeeksNeeded, rampProfileFor, assessOnRamp, generateBaseBuildPlan } from './baseBuildOnRamp'
import { buildWeekCeilingKm, injuryBouncebackMayReturnToPreDeload } from './deloadCadence'
import { validateBaseBuildBlock, volumeCappedRampOf } from './baseBuildValidate'
import { generateRulePlan } from './ruleEngine'
import { GENERATION_CONFIG as G } from './generationConfig'
import type { GeneratorInput, Week } from '@/types/plan'

const FREQ = G.BASE_BUILD_ONRAMP_DELOAD_FREQUENCY
const STEP = 0.1 // floor1dp's unit
const isDeloadIdx = (i: number, weeks: number) => (i + 1) % FREQ === 0 && i + 1 !== weeks
const floor1dp = (x: number) => Math.floor(x * 10) / 10

/** Attempt 1's withdrawn rule (§2 Am. 1): the bounceback capped at +5% over the deload. Kept ONLY as a falsifier. */
function cappedBouncebackCurve(start: number, weeks: number): number[] {
  const out: number[] = []
  for (let i = 0; i < weeks; i++) {
    const prev = out[i - 1]
    out.push(i === 0 ? start : isDeloadIdx(i, weeks) ? floor1dp(prev * 0.85) : Math.max(floor1dp(prev * 1.05), Math.round(prev * 10 + 1) / 10))
  }
  return out
}

/** The runner-reachable shape of a §12-capped ramp (`hasVolumeCappedInjuryHistory`). */
const kneeInput = (over: Partial<GeneratorInput> = {}): GeneratorInput => ({
  race_distance_km: 42.195, race_date: '2027-04-25', days_available: 4,
  goal: 'finish', current_weekly_km: 8, longest_recent_run_km: 3, age: 32,
  injury_history: ['knee'], recent_quality_training: 'none', training_age: '<6mo',
  ...over,
} as unknown as GeneratorInput)

const rampPlan = (over: Partial<GeneratorInput> = {}) => {
  const input = kneeInput(over)
  // A target ~1.35x the start: at §2's injury rate that is a 10–20 week ramp, so it spans several deload cycles.
  const a = assessOnRamp(input, Math.round((input.current_weekly_km ?? 8) * 1.35), 60)
  expect(a.outcome, 'fixture must be offered a ramp, or nothing below is tested').toBe('offered')
  return { a, plan: generateBaseBuildPlan(input, '2026-10-05', a) }
}
const withKm = (weeks: Week[], km: number[]) => {
  const w = JSON.parse(JSON.stringify(weeks)) as Week[]
  w.forEach((x, i) => { x.weekly_km = km[i] })
  return w
}
const climbCodes = (weeks: Week[], startKm: number, injury: boolean) =>
  validateBaseBuildBlock(weeks, startKm, { volumeCappedInjury: injury })
    .filter(v => v.code === 'INV-PLAN-ONRAMP-CURVE-CLIMBS' && v.severity === 'error')

describe('§116 Am. 16 — the ramp profile', () => {
  it('knee and shin histories ramp on the injury profile; every other history on the standard one', () => {
    expect(rampProfileFor({ injury_history: ['knee'] })).toBe('volume_capped_injury')
    expect(rampProfileFor({ injury_history: ['shin splints'] })).toBe('volume_capped_injury')
    for (const h of [['achilles'], ['back'], ['hip'], ['plantar fasciitis'], [], undefined]) {
      expect(rampProfileFor({ injury_history: h as string[] | undefined })).toBe('standard')
    }
  })

  it('generateBaseBuildPlan stamps the profile the validator reads', () => {
    const { plan } = rampPlan()
    expect((plan.meta as unknown as Record<string, unknown>).onramp_profile).toBe('volume_capped_injury')
    expect(volumeCappedRampOf(plan)).toBe(true)
    const healthy = generateBaseBuildPlan(kneeInput({ injury_history: [] }), '2026-10-05',
      assessOnRamp(kneeInput({ injury_history: [] }), 18, 40))
    expect(volumeCappedRampOf(healthy)).toBe(false)
  })
})

describe('§116 Am. 16 — the injury curve', () => {
  it('is the ruled curve from 8 km (decision note, option A)', () => {
    expect(onRampCurve(8, 17, 'volume_capped_injury'))
      .toEqual([8, 8.4, 8.8, 7.4, 8.8, 9.2, 9.6, 8.1, 9.6, 10, 10.5, 8.9, 10.5, 11, 11.5, 9.7, 11.5])
  })

  it('leaves the healthy curve byte-identical (carried line, unbounded bounceback)', () => {
    expect(onRampCurve(8, 9, 'standard')).toEqual([8, 8.8, 9.6, 7.4, 11.7, 12.8, 14.1, 10.9, 17.1])
  })

  for (const start of [2, 3, 4.5, 6, 9, 14, 20]) for (const weeks of [2, 4, 5, 8, 9, 13, 17, 20]) {
    it(`from ${start} km over ${weeks} weeks: ≤5% ordinary, 85% deload, return to pre-deload, climbs every cycle`, () => {
      const c = onRampCurve(start, weeks, 'volume_capped_injury')
      expect(c).toHaveLength(weeks)
      expect(isDeloadIdx(weeks - 1, weeks)).toBe(false)
      const preDeloads: number[] = []
      for (let i = 1; i < c.length; i++) {
        if (isDeloadIdx(i, weeks)) {
          expect(c[i]).toBe(floor1dp(c[i - 1] * G.INJURY_RECOVERY_WEEK_VOLUME_PCT / 100))
          preDeloads.push(c[i - 1])
        } else if (i >= 2 && isDeloadIdx(i - 1, weeks)) {
          expect(c[i], `W${i + 1} bounceback returns to pre-deload, no higher`).toBe(c[i - 2])
        } else {
          expect(c[i]).toBeLessThanOrEqual(c[i - 1] * (1 + G.INJURY_WEEKLY_INCREASE_CAP_PCT / 100) + STEP + 1e-9)
          expect(c[i], 'an ordinary week climbs').toBeGreaterThan(c[i - 1])
        }
      }
      for (let k = 1; k < preDeloads.length; k++) expect(preDeloads[k]).toBeGreaterThan(preDeloads[k - 1])
      expect(c[c.length - 1]).toBeGreaterThan(c[0])
    })
  }

  it('an injury ramp takes at least as many weeks to a target as a healthy one', () => {
    for (const [s, t] of [[6, 18], [9, 20], [4, 12]] as const) {
      expect(onRampWeeksNeeded(s, t, 'volume_capped_injury')).toBeGreaterThanOrEqual(onRampWeeksNeeded(s, t, 'standard'))
    }
  })
})

describe('§116 Am. 16 — the shared owner', () => {
  it('an ordinary week: min(allowance, injury cap) for a capped runner, allowance otherwise', () => {
    expect(buildWeekCeilingKm({ prevKm: 10, preDeloadKm: 10, prevWasDeload: false, allowancePct: 10, injuryCapPct: 5 })).toBeCloseTo(10.5, 9)
    expect(buildWeekCeilingKm({ prevKm: 10, preDeloadKm: 10, prevWasDeload: false, allowancePct: 10, injuryCapPct: undefined })).toBeCloseTo(11, 9)
  })
  it('a bounceback returns to pre-deload (both cohorts while the gate holds)', () => {
    expect(injuryBouncebackMayReturnToPreDeload()).toBe(true)
    expect(buildWeekCeilingKm({ prevKm: 8.5, preDeloadKm: 10, prevWasDeload: true, allowancePct: 10, injuryCapPct: 5 })).toBe(10)
    expect(buildWeekCeilingKm({ prevKm: 7, preDeloadKm: 10, prevWasDeload: true, allowancePct: 10, injuryCapPct: undefined })).toBe(10)
  })
})

describe('§116 Am. 16 — INV-PLAN-ONRAMP-CURVE-CLIMBS, amended (arms 1, 3, 4)', () => {
  it('a generated knee ramp is clean under the injury rules', () => {
    for (const cwk of [6, 8, 10, 12]) for (const days of [3, 4, 5]) {
      const { a, plan } = rampPlan({ current_weekly_km: cwk, days_available: days })
      expect(validateBaseBuildBlock(plan.weeks, a.startKm, { volumeCappedInjury: volumeCappedRampOf(plan) })
        .filter(v => v.severity === 'error'), `cwk ${cwk} days ${days}`).toEqual([])
    }
  })

  it('arm 1: the equal bounceback is legal ONLY for an injury ramp', () => {
    const { a, plan } = rampPlan()
    expect(climbCodes(plan.weeks, a.startKm, true)).toEqual([])
    expect(climbCodes(plan.weeks, a.startKm, false).length, 'the healthy rule still demands a strict climb').toBeGreaterThan(0)
  })

  it('🔴 FALSIFIED: restoring the carried line (today\'s defect) fires arm 3', () => {
    const { a, plan } = rampPlan()
    const w = withKm(plan.weeks, onRampCurve(a.startKm, plan.weeks.length, 'standard'))
    const v = climbCodes(w, a.startKm, true)
    expect(v.some(x => /injury cap|ABOVE its pre-deload/.test(x.message))).toBe(true)
  })

  it('🔴 FALSIFIED: restoring §2 Am. 1\'s capped bounceback fires arm 4 and fails the net climb', () => {
    const { a, plan } = rampPlan({ current_weekly_km: 6 })
    const weeks = plan.weeks.length
    const L = cappedBouncebackCurve(a.startKm, weeks)
    const pre = L.filter((_, i) => i + 1 < weeks && isDeloadIdx(i + 1, weeks))
    expect(pre.length, 'needs two cycles to see a cycle stall').toBeGreaterThanOrEqual(2)
    expect(pre.every((x, k) => k === 0 || x > pre[k - 1]), 'net climb per cycle').toBe(false)
    const v = climbCodes(withKm(plan.weeks, L), a.startKm, true)
    expect(v.some(x => /stuck/.test(x.message))).toBe(true)
  })

  it('arms 3 and 4 are silent on a healthy ramp (the healthy curve is out of their scope)', () => {
    const input = kneeInput({ injury_history: [] })
    const a = assessOnRamp(input, 18, 40)
    const plan = generateBaseBuildPlan(input, '2026-10-05', a)
    expect(validateBaseBuildBlock(plan.weeks, a.startKm, { volumeCappedInjury: volumeCappedRampOf(plan) })
      .filter(v => v.severity === 'error')).toEqual([])
  })
})

describe('§2 Am. 3\'s gate reaches BOTH callers through the one owner', () => {
  it('🔴 at INJURY_RECOVERY_WEEK_VOLUME_PCT = 80 the exemption withdraws in the ramp AND the race engine', () => {
    const cfg = G as unknown as Record<string, number>
    const was = cfg.INJURY_RECOVERY_WEEK_VOLUME_PCT
    cfg.INJURY_RECOVERY_WEEK_VOLUME_PCT = 80
    try {
      expect(injuryBouncebackMayReturnToPreDeload()).toBe(false)
      // The ramp: every bounceback is now ≤ the deload × 1.05 (+ one floor step), and below pre-deload.
      const c = onRampCurve(8, 17, 'volume_capped_injury')
      let bounces = 0
      for (let i = 2; i < c.length; i++) {
        if (!isDeloadIdx(i - 1, c.length) || isDeloadIdx(i, c.length)) continue
        bounces++
        expect(c[i]).toBeLessThanOrEqual(Math.max(floor1dp(c[i - 1] * 1.05), Math.round(c[i - 1] * 10 + 1) / 10))
        expect(c[i]).toBeLessThan(c[i - 2])
      }
      expect(bounces).toBeGreaterThan(0)
      // The race engine: a knee runner's post-deload weeks stop returning to pre-deload.
      const input = {
        athlete_name: 'R', age: 40, race_name: 'M', primary_metric: 'distance', plan_start: '2026-09-21',
        race_distance_km: 42.2, race_date: '2027-01-24', goal: 'finish', resting_hr: 52, max_hr: 180,
        current_weekly_km: 30, longest_recent_run_km: 14, fitness_level: 'intermediate',
        recent_quality_training: 'occasional', hard_session_relationship: 'neutral', training_age: '2-5yr',
        days_available: 4, days_cannot_train: [], injury_history: ['knee'],
      } as unknown as GeneratorInput
      const at80 = generateRulePlan(input, 'trial', '2026-09-21', undefined, '2026-09-21')
      cfg.INJURY_RECOVERY_WEEK_VOLUME_PCT = was
      const at85 = generateRulePlan(input, 'trial', '2026-09-21', undefined, '2026-09-21')
      const returns = (p: typeof at80) => p.weeks.filter((w, i) => i >= 2
        && (p.weeks[i - 1].type === 'deload' || p.weeks[i - 1].badge === 'deload')
        && w.type !== 'deload' && w.phase !== 'taper' && w.type !== 'race'
        && w.weekly_km >= p.weeks[i - 2].weekly_km).length
      expect(returns(at85), 'at 85 the race engine returns to pre-deload').toBeGreaterThan(0)
      expect(returns(at80), 'at 80 it no longer does').toBeLessThan(returns(at85))
    } finally {
      cfg.INJURY_RECOVERY_WEEK_VOLUME_PCT = was
    }
  })
})
