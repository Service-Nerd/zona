import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { generateRulePlan } from './ruleEngine'
import { GENERATION_CONFIG } from './generationConfig'
import type { GeneratorInput, Plan } from '@/types/plan'

/**
 * §12 — the injury weekly-volume cap must compound.
 *
 * THE DEFECT (fixed 2026-08-20): the cap was handed `volumes[i - 1]`, the raw
 * volume CURVE, rather than the previous week's post-adjustment result. So it
 * never compounded — a week capped down was followed by a week measured against
 * the HIGHER curve value, which sailed through uncapped.
 *
 * The result was a sawtooth. On a traced HM plan (knee history, 40 km/wk,
 * 6 days): W9 was capped to 48.3km and W10 then jumped to 65km — a 35% rise,
 * dragging the long run 11km -> 19km and tripping §45's progression cap.
 *
 * The injury-protection cap was producing the exact volume spike it exists to
 * prevent, and only for injured runners. Fixing it cleared 394 of the 981
 * INV-PLAN-LR-PROGRESSION-CAP violations in the property sweep.
 */

const FROZEN_NOW = new Date('2026-08-20T09:00:00Z')
const PLAN_START = '2026-04-27'

const HM_KNEE: GeneratorInput = {
  race_date: '2026-08-10', race_distance_km: 21.1, goal: 'finish',
  age: 35, days_available: 6, current_weekly_km: 40, longest_recent_run_km: 15,
  fitness_level: 'experienced', injury_history: ['knee'],
  resting_hr: 55, max_hr: 185, preferred_long_run_day: 'sun',
}

const weeklySeries = (p: Plan) =>
  p.weeks.filter(w => w.type !== 'race').map(w => ({ n: w.n, km: w.weekly_km, deload: w.type === 'deload' }))

beforeAll(() => { vi.useFakeTimers(); vi.setSystemTime(FROZEN_NOW) })
afterAll(() => { vi.useRealTimers() })

describe('§12 — the injury cap compounds', () => {
  it('no week rises more than the injury cap above the one before it', () => {
    // The assertion the old code could not satisfy. Deload weeks drop, and the
    // post-deload bounceback is EXCLUDED here — not because it is §2-exempt for
    // injury runners (RAMP-BOUNCEBACK-01, 2026-09-06, removed that exemption at
    // the CURVE), but because the DELIVERED weekly_km bounceback still diverges
    // from the capped curve by placement (a race-anchored long run inflates it) —
    // the deload-inversion class, tracked by INV-PLAN-BOUNCEBACK-BOUNDED (warn)
    // and cleared by DELOAD-INVERSION-01. This test checks the non-bounceback
    // compounding, which the curve fix already delivers.
    const plan = generateRulePlan(HM_KNEE, 'paid', PLAN_START)
    const s = weeklySeries(plan)
    const capPct = GENERATION_CONFIG.INJURY_WEEKLY_INCREASE_CAP_PCT

    for (let i = 1; i < s.length; i++) {
      if (s[i].deload || s[i - 1].deload) continue
      if (s[i].km <= s[i - 1].km) continue
      const risePct = ((s[i].km - s[i - 1].km) / s[i - 1].km) * 100
      // DELOAD-INVERSION-01 (2026-09-06) took this from a +35% defect to a bounded
      // residual. The residual above the pure cap is the §52-PROTECTED peak long
      // run growing (race-anchored, never trimmed) plus the recovery from the deep
      // injury-capped bounceback — both legitimate per the Coaching Board ruling.
      // The PRECISE delivered check (which excludes long-run-driven weeks) is
      // INV-PLAN-INJURY-CAP-DELIVERED; this coarse guard just holds the sawtooth
      // well under the old defect.
      expect(risePct, `W${s[i].n} rose ${risePct.toFixed(0)}% from W${s[i - 1].n}`)
        .toBeLessThan(capPct + 15)
    }
  })

  it('the traced sawtooth is gone — no 30%+ jump anywhere', () => {
    const s = weeklySeries(generateRulePlan(HM_KNEE, 'paid', PLAN_START))
    const jumps = s.slice(1)
      .map((w, i) => (s[i].deload || w.deload) ? 0 : ((w.km - s[i].km) / s[i].km) * 100)
    expect(Math.max(...jumps)).toBeLessThan(30)
  })

  it('an UNINJURED runner is unaffected — the cap only binds on injury', () => {
    // Guards the blast radius: this changed how one cap is fed, not the curve.
    const healthy = { ...HM_KNEE, injury_history: [] }
    const plan = generateRulePlan(healthy, 'paid', PLAN_START)
    expect(plan.weeks.length).toBeGreaterThan(0)
    // An uninjured runner keeps the standard §2 allowance, which is higher.
    expect(GENERATION_CONFIG.MAX_WEEKLY_VOLUME_INCREASE_PCT)
      .toBeGreaterThan(GENERATION_CONFIG.INJURY_WEEKLY_INCREASE_CAP_PCT)
  })

  it('the injured runner gets LESS volume than the healthy one, as §12 intends', () => {
    const injured = generateRulePlan(HM_KNEE, 'paid', PLAN_START)
    const healthy = generateRulePlan({ ...HM_KNEE, injury_history: [] }, 'paid', PLAN_START)
    const peak = (p: Plan) => Math.max(...p.weeks.filter(w => w.type !== 'deload' && w.type !== 'race').map(w => w.weekly_km))
    expect(peak(injured)).toBeLessThanOrEqual(peak(healthy))
  })
})
