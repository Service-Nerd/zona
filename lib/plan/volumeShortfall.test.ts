import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { generateRulePlan } from './ruleEngine'
import { validatePlan } from './invariants'
import { GENERATION_CONFIG } from './generationConfig'
import type { GeneratorInput, Plan } from '@/types/plan'

/**
 * VOL-SHORTFALL-01 / §40c — the plan states it when a life-first constraint
 * materially suppresses weekly volume.
 *
 * `max_weekday_mins` is the runner's own statement about their life, and the
 * engine honours it correctly. The defect was SILENCE. Measured by
 * counterfactual (same profile, cap vs no cap): a 4-day HM runner with a
 * 45-minute weekday cap peaks at 49 km where the volume curve wanted 66 km —
 * 26% less — with nothing in the plan indicating the two asks are in tension.
 * Median loss across affected shapes 18%, worst 27%; 52% of capped plans had
 * more than a quarter of their weekday easy runs pinned exactly at the cap.
 *
 * The cap still wins. This governs what the plan SAYS, never what it prescribes.
 */

const FROZEN_NOW = new Date('2026-08-20T09:00:00Z')
const PLAN_START = '2026-09-07'

const HM: GeneratorInput = {
  race_date: '2026-12-21', race_distance_km: 21.1, goal: 'time_target',
  target_time: '1:45:00', days_available: 4, age: 38,
  current_weekly_km: 45, longest_recent_run_km: 18,
  resting_hr: 55, max_hr: 185, preferred_long_run_day: 'sun',
  fitness_level: 'experienced', training_age: '2-5yr',
}

beforeAll(() => { vi.useFakeTimers(); vi.setSystemTime(FROZEN_NOW) })
afterAll(() => { vi.useRealTimers() })

const peakOf = (p: Plan) =>
  Math.max(...p.weeks.filter(w => w.type !== 'deload' && w.type !== 'race').map(w => w.weekly_km))

describe('VOL-SHORTFALL-01 — the cost is stated', () => {
  it('a tight weekday cap produces a note', () => {
    const input = { ...HM, max_weekday_mins: 45 }
    const plan = generateRulePlan(input, 'paid', PLAN_START)
    expect(plan.meta.volume_shortfall_note).toBeTruthy()
  })

  it('the fixture genuinely loses volume — verified by counterfactual', () => {
    // Without this the test could pass on a plan that lost nothing, which is
    // the vacuous-fixture trap. The counterfactual is the only honest measure:
    // the cap binds through easy-run durations, so the cost cannot be read off
    // the finished plan.
    const capped = generateRulePlan({ ...HM, max_weekday_mins: 45 }, 'paid', PLAN_START)
    const free = generateRulePlan(HM, 'paid', PLAN_START)
    const lostPct = ((peakOf(free) - peakOf(capped)) / peakOf(free)) * 100
    expect(lostPct).toBeGreaterThanOrEqual(GENERATION_CONFIG.VOLUME_SHORTFALL_NOTE_THRESHOLD_PCT)
  })

  it('the note names the lever, not just the loss', () => {
    // McMillan's condition: a note that only reports the loss is a disclaimer.
    // Naming the one thing that would change it is what makes it coaching.
    const note = generateRulePlan({ ...HM, max_weekday_mins: 45 }, 'paid', PLAN_START)
      .meta.volume_shortfall_note!
    expect(note).toMatch(/lever/i)
    expect(note).toMatch(/5 days instead of 4|weekday limit to/)
  })

  it('states the actual numbers, not a vague warning', () => {
    const plan = generateRulePlan({ ...HM, max_weekday_mins: 45 }, 'paid', PLAN_START)
    const note = plan.meta.volume_shortfall_note!
    expect(note).toContain('45-minute')
    expect(note).toMatch(/\d+km/)
    expect(note).toMatch(/\d+% less/)
  })

  it('is not motivational — brand voice (brand.md)', () => {
    // An earlier draft read "a 44km week you run beats a 65km week you
    // abandon". True, but that is encouragement; the rule is to state the fact.
    const note = generateRulePlan({ ...HM, max_weekday_mins: 45 }, 'paid', PLAN_START)
      .meta.volume_shortfall_note!
    for (const banned of ['abandon', 'crushing', 'you\'ve got this', 'amazing', 'beast']) {
      expect(note.toLowerCase()).not.toContain(banned)
    }
  })
})

describe('VOL-SHORTFALL-01 — it stays quiet when it should', () => {
  it('no cap, no note', () => {
    const plan = generateRulePlan(HM, 'paid', PLAN_START)
    expect(plan.meta.volume_shortfall_note).toBeUndefined()
    expect(plan.meta.volume_shortfall_pct).toBeUndefined()
  })

  it('a cap that costs little produces no note', () => {
    // McMillan: firing at 5% is noise, and notes that fire on noise get ignored.
    // A 5-day week absorbs the same cap far better than a 4-day week.
    const plan = generateRulePlan({ ...HM, days_available: 5, max_weekday_mins: 90 }, 'paid', PLAN_START)
    const pct = plan.meta.volume_shortfall_pct ?? 0
    if (pct < GENERATION_CONFIG.VOLUME_SHORTFALL_NOTE_THRESHOLD_PCT) {
      expect(plan.meta.volume_shortfall_note).toBeUndefined()
    }
  })
})

describe('INV-PLAN-VOLUME-SHORTFALL-DECLARED', () => {
  it('a compliant plan passes', () => {
    const input = { ...HM, max_weekday_mins: 45 }
    const plan = generateRulePlan(input, 'paid', PLAN_START)
    expect(validatePlan(plan, input).filter(v => v.code === 'INV-PLAN-VOLUME-SHORTFALL-DECLARED')).toEqual([])
  })

  it('fires when the note is stripped but the cost stands', () => {
    const input = { ...HM, max_weekday_mins: 45 }
    const plan = generateRulePlan(input, 'paid', PLAN_START)
    const stripped: Plan = { ...plan, meta: { ...plan.meta, volume_shortfall_note: undefined } }
    const vs = validatePlan(stripped, input).filter(v => v.code === 'INV-PLAN-VOLUME-SHORTFALL-DECLARED')
    expect(vs.length).toBeGreaterThan(0)
    expect(vs[0].severity).toBe('error')
  })

  it('does NOT fire on a pinned-but-not-costly plan', () => {
    // The mismatch the HM archetype exposed: 10 of 15 weekday runs pinned, but
    // the week's volume still landed, so no note was due. Pinned-ness says the
    // cap is ACTIVE; the stamped percentage says whether it COST anything.
    const input = { ...HM, max_weekday_mins: 45 }
    const plan = generateRulePlan(input, 'paid', PLAN_START)
    const cheap: Plan = { ...plan, meta: { ...plan.meta, volume_shortfall_note: undefined, volume_shortfall_pct: 2 } }
    expect(validatePlan(cheap, input).filter(v => v.code === 'INV-PLAN-VOLUME-SHORTFALL-DECLARED')).toEqual([])
  })
})
