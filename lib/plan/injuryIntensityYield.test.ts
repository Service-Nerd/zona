import { describe, it, expect } from 'vitest'
import { generateRulePlan } from './ruleEngine'
import { validatePlan } from './invariants'
import { GENERATION_CONFIG as G } from './generationConfig'
import { isLongRun } from './sessionRole'
import type { GeneratorInput, Plan, Session, Week } from '@/types/plan'

/**
 * §90 Amendment 1 — when the injury trim removes easy runs, quality yields.
 * Coaching Board S1-INJURY-DENOMINATOR-01, 2026-09-15.
 *
 * This is the board's third artifact. `INV-PLAN-INTENSITY-DISTRIBUTION` already
 * existed and already fired on the defect, so the ruling needed no new invariant
 * — what it needed was proof that the YIELD engages, which an invariant that
 * merely stays silent cannot give you.
 *
 * The fixture is the measured case, not a constructed one: the parity grid found
 * 6 of 4,320 plans breaching, all marathon, all carrying `injury_history:
 * ['knee']`. This is one of them, plus its healthy twin, differing in one field.
 *
 * ⚠️ The property sweep does NOT see this family — 15,973 plans, 0 violations.
 * Only the exhaustive parity grid reaches it. A clean sweep is not a clean engine.
 */
const PLAN_START = '2026-09-14'

const runner = (injury: string[]): GeneratorInput => ({
  goal: 'finish', age: 40, resting_hr: 55, max_hr: 180,
  preferred_long_run_day: 'sun', race_date: '2026-12-06',
  race_distance_km: 42.2, current_weekly_km: 15, longest_recent_run_km: 5,
  days_available: 4, fitness_level: 'intermediate', injury_history: injury,
} as unknown as GeneratorInput)

const gen = (injury: string[]) => generateRulePlan(runner(injury), 'paid', PLAN_START)

/** The SAME denominator INV-PLAN-INTENSITY-DISTRIBUTION uses. */
const runsOf = (w: Week) => (Object.values(w.sessions).filter(Boolean) as Session[])
  .filter(s => s.type !== 'rest' && s.type !== 'race' && s.type !== 'strength' && s.type !== 'cross-train')
const isQual = (s: Session) => s.type === 'quality' || s.type === 'intervals' || s.type === 'tempo' || s.type === 'hard'
const share = (p: Plan) => {
  const runs = p.weeks.filter(w => w.n >= 1).flatMap(runsOf)
  return (runs.filter(isQual).length / runs.length) * 100
}
const CEILING = G.INTENSITY_DISTRIBUTION.MARATHON.max_quality_session_pct

describe('§90 Am.1 — the premise still holds (guards the guard)', () => {
  it('the healthy twin is clean and near the ceiling, or this fixture proves nothing', () => {
    const p = gen([])
    expect(share(p)).toBeLessThanOrEqual(CEILING)
    expect(share(p), 'the healthy plan drifted far from the ceiling — the fixture is stale')
      .toBeGreaterThan(CEILING - 3)
    expect(validatePlan(p, runner([])).filter(v => v.severity === 'error')).toEqual([])
  })

  it('the injury trim really does remove RUNS, not just kilometres', () => {
    // The whole mechanism in one assertion. If §2's injury-cap trim ever stops costing the
    // runner a day, this amendment has no trigger and should be revisited.
    const healthy = gen([]).weeks.filter(w => w.n >= 1).flatMap(runsOf).length
    const injured = gen(['knee']).weeks.filter(w => w.n >= 1).flatMap(runsOf).length
    expect(injured, `injured ${injured} runs vs healthy ${healthy} — no day was lost`)
      .toBeLessThan(healthy)
  })
})

describe('§90 Am.1 — the yield engages', () => {
  for (const injury of [['knee'], ['shin_splints']]) {
    it(`brings a ${injury[0]} plan back under §1's ceiling`, () => {
      const p = gen(injury)
      expect(share(p)).toBeLessThanOrEqual(CEILING)
      expect(validatePlan(p, runner(injury)).filter(v => v.severity === 'error')).toEqual([])
    })

    it(`records WHY, so §102 exempts it rather than the absence being silent (${injury[0]})`, () => {
      // §102: "the exemption must be earned. It keys on a recorded reason, not on
      // the absence itself." Without this stamp the week reads as a generator
      // defect to INV-PLAN-QUALITY-EXPECTED — which is exactly what it did on the
      // first build.
      const downgraded = gen(injury).weeks.filter(w => w.quality_downgraded)
      expect(downgraded.length).toBeGreaterThan(0)
      expect(downgraded[0].quality_downgraded!.trigger).toBe('injury_intensity_ceiling')
    })
  }

  it('leaves the healthy twin completely untouched', () => {
    // The blast radius. A yield that also fires on runners with no injury would
    // be removing intensity from people who earned it.
    const p = gen([])
    expect(p.weeks.some(w => w.quality_downgraded)).toBe(false)
    expect(share(p)).toBeCloseTo(17.4, 0)
  })
})

describe('§90 Am.1 — the three traps the build fell into', () => {
  it('CONVERTS rather than deletes: the session count is preserved', () => {
    // Deleting takes the denominator down with the numerator and does not fix
    // the breach (38/7 = 18.4%, still over). This is the assertion that would
    // catch a future "tidy-up" turning the conversion into a removal.
    const healthyRuns = gen([]).weeks.filter(w => w.n >= 1).flatMap(runsOf)
    const injuredRuns = gen(['knee']).weeks.filter(w => w.n >= 1).flatMap(runsOf)
    const healthyQ = healthyRuns.filter(isQual).length
    const injuredQ = injuredRuns.filter(isQual).length
    expect(injuredQ, 'no quality session yielded').toBeLessThan(healthyQ)
    // The yielded session is still THERE, as an easy run on the same day.
    const wk = gen(['knee']).weeks.find(w => w.quality_downgraded)!
    expect(runsOf(wk).length, 'the week lost a run instead of converting one')
      .toBeGreaterThanOrEqual(2)
  })

  it('holds the DURATION, so a capped weekday is still honoured', () => {
    // An easy run is slower than the quality it replaces, so converting at the
    // same DISTANCE makes a longer session and overran max_weekday_mins.
    const capped = { ...runner(['knee']), max_weekday_mins: 45 } as GeneratorInput
    const p = generateRulePlan(capped, 'paid', PLAN_START)
    expect(validatePlan(p, capped).filter(v => v.code === 'INV-PLAN-MAX-WEEKDAY-MINS')).toEqual([])
  })

  it('keeps the long run the longest, by §9\'s RATIO and not by a nose', () => {
    // A quality session is floored at MIN_SESSION_DISTANCE_KM.quality, which on a
    // taper week can exceed that week's long run. Clamping just under it then
    // failed §9's 1.25x ratio at 5.0 vs 4.5.
    const wk = gen(['knee']).weeks.find(w => w.quality_downgraded)!
    const long = Math.max(0, ...runsOf(wk).filter(isLongRun).map(s => s.distance_km ?? 0))
    const easy = Math.max(0, ...runsOf(wk).filter(s => !isLongRun(s)).map(s => s.distance_km ?? 0))
    if (long > 0 && easy > 0) {
      expect(long / easy).toBeGreaterThanOrEqual(G.LONG_RUN_MIN_RATIO_VS_EASY)
    }
  })

  it('the week stops promising intensity it no longer contains (§27)', () => {
    const wk = gen(['knee']).weeks.find(w => w.quality_downgraded)!
    const copy = `${wk.label ?? ''} ${wk.theme ?? ''}`.toLowerCase()
    const stillHasQuality = runsOf(wk).some(isQual)
    if (!stillHasQuality) {
      expect(copy, 'week copy promises intensity the yield removed')
        .not.toMatch(/quality|threshold|tempo|interval|vo2|sharpen|intensity stays/)
    }
  })
})

describe('§90 Am.1 — the runner is told', () => {
  it('the converted session explains itself, and the plan records the adjustment', () => {
    const p = gen(['knee'])
    const wk = p.weeks.find(w => w.quality_downgraded)!
    const notes = runsOf(wk).flatMap(s => s.coach_notes ?? []).filter(Boolean).join(' ')
    expect(notes.toLowerCase()).toContain('injury')
    const adj = (p.meta.rule_adjustments ?? []).find(a => a.rule.includes('§90 Amendment 1'))
    expect(adj, 'the yield left no trace in rule_adjustments').toBeTruthy()
    expect(adj!.weeks_affected.length).toBeGreaterThan(0)
  })
})
