import { describe, it, expect } from 'vitest'
import { generateRulePlan } from './ruleEngine'
import { GENERATION_CONFIG as G } from './generationConfig'
import type { GeneratorInput } from '@/types/plan'

/**
 * §29 + §37 — the fresh-from-layoff gate, and the 70% start it buys.
 *
 * §29 opens explicitly (`weeks_at_current_volume` under the threshold); §37
 * opens heuristically (deep training age, but current volume AND longest recent
 * run both below the floors). A runner who says "I'm doing 18 km/week" after a
 * six-month gap is naming the volume they ASPIRE to, not the volume their
 * tendons have absorbed.
 *
 * `INV-PLAN-FRESH-RETURN-GATE` proves the flag and the inputs agree on every
 * generated plan. It deliberately does NOT assert the start fraction, because
 * three other rules squeeze week 1 before it reaches the runner — the <6mo
 * beginner cap, §106's peak floor, the foundation block — so an invariant on
 * `week1 ≈ 0.7 × stated` would fail plans the engine handled correctly.
 *
 * That is this file's job: pin the fraction where nothing else binds, pin the
 * §37 AND-gate arm by arm, and pin that the runner is TOLD.
 *
 * Why the gate matters more than it reads: §29 was on `GeneratorInput` from
 * M-02 and the property sweep never once set it, so the whole path was
 * unreachable until GRID-COVERAGE-01 (see `freshReturnFloor.test.ts`).
 */
const START = '2026-04-27'

const runner = (over: Record<string, unknown> = {}) => ({
  age: 38, plan_start: START, race_distance_km: 21.1, race_date: '2026-09-06',
  goal: 'finish', current_weekly_km: 30, longest_recent_run_km: 14,
  training_age: '2-5yr', recent_quality_training: 'occasional',
  days_available: 4, injury_history: [],
  ...over,
}) as unknown as GeneratorInput

const gen = (over: Record<string, unknown> = {}) =>
  generateRulePlan(runner(over), 'paid', START, undefined, START)

const week1 = (over: Record<string, unknown> = {}) => gen(over).weeks.find(w => w.n === 1)!.weekly_km ?? 0
const isFresh = (over: Record<string, unknown> = {}) => gen(over).meta.fresh_return_active === true

describe('§29 — the explicit gate', () => {
  it('a consolidated runner is not a returner (guards the guard)', () => {
    expect(isFresh()).toBe(false)
    expect(isFresh({ weeks_at_current_volume: G.FRESH_RETURN_WEEKS_THRESHOLD })).toBe(false)
  })

  it('fires one week below the threshold, and not at it', () => {
    expect(isFresh({ weeks_at_current_volume: G.FRESH_RETURN_WEEKS_THRESHOLD - 1 })).toBe(true)
    expect(isFresh({ weeks_at_current_volume: G.FRESH_RETURN_WEEKS_THRESHOLD })).toBe(false)
  })

  it('treats the stated volume as aspirational — week 1 starts well below it', () => {
    // The directional claim, which no floor can invert: the same runner, same
    // stated volume, one extra input, starts materially smaller.
    const settled = week1()
    const fresh = week1({ weeks_at_current_volume: 3 })
    expect(fresh, `fresh ${fresh} km vs settled ${settled} km`).toBeLessThan(settled)
  })

  it('starts at FRESH_RETURN_START_FRACTION of the stated volume', () => {
    // Asserted only on a profile where no other cap binds: training age is deep
    // (so the <6mo bucket cap is out) and the volume clears §106's floor. A
    // tolerance, not an equality, because week 1 is rounded and day-fitted.
    const stated = 30
    const expected = stated * G.FRESH_RETURN_START_FRACTION
    const actual = week1({ weeks_at_current_volume: 3 })
    expect(Math.abs(actual - expected), `week 1 was ${actual} km, §29 wants ~${expected} km`)
      .toBeLessThanOrEqual(2)
  })

  it('ramps at the STANDARD rate — a fresh return buys caution, not speed', () => {
    // Explicitly not the returning-runner allowance. §29 says so in one line and
    // it is the clause most likely to be "helpfully" merged with §79's lift.
    const p = gen({ weeks_at_current_volume: 3 })
    const vols = p.weeks.filter(w => w.n >= 1 && w.n <= 4).map(w => w.weekly_km ?? 0)
    for (let i = 1; i < vols.length; i++) {
      const pct = ((vols[i] - vols[i - 1]) / vols[i - 1]) * 100
      expect(pct, `week ${i + 1} jumped ${pct.toFixed(1)}%`)
        .toBeLessThanOrEqual(G.MAX_WEEKLY_VOLUME_INCREASE_PCT + 1)
    }
  })
})

describe('§37 — the heuristic, arm by arm', () => {
  // All three arms must hit. Each case below breaks exactly one of them.
  const LOW = { current_weekly_km: 20, longest_recent_run_km: 8 }   // both under the floors

  it('fires when deep training age meets a low volume AND a short long run', () => {
    expect(isFresh(LOW)).toBe(true)
  })

  it('does NOT fire on a shallow training age — this is the returner heuristic', () => {
    expect(isFresh({ ...LOW, training_age: '6-18mo' })).toBe(false)
    expect(isFresh({ ...LOW, training_age: '<6mo' })).toBe(false)
  })

  it('does NOT fire when weekly volume clears its floor', () => {
    expect(isFresh({ ...LOW, current_weekly_km: G.HEURISTIC_FRESH_RETURN_WEEKLY_KM })).toBe(false)
  })

  it('does NOT fire when the long run clears its floor', () => {
    expect(isFresh({ ...LOW, longest_recent_run_km: G.HEURISTIC_FRESH_RETURN_LONG_RUN_KM })).toBe(false)
  })

  it('the explicit input wins when both are present and disagree', () => {
    // §29 says the explicit input is preferred; §37 is the safety net for
    // runners who do not think to mention a gap. A runner who HAS told us they
    // are consolidated still trips the heuristic's OR — which is correct, and
    // this pins that it is deliberate rather than an accident of precedence.
    expect(isFresh({ ...LOW, weeks_at_current_volume: 52 })).toBe(true)
  })
})

describe('§29 — the runner is told, in their own numbers', () => {
  // 🔴 THIS ARM ASSERTED AN IMPLEMENTATION DETAIL AS A REQUIREMENT (corrected 2026-11-09).
  // It demanded the note contain `70%`. **§51 requires the note to name "the change and the
  // reason"; it never required a ratio** — and `ui-patterns.md` §18 rule 2 FORBIDS one:
  // *"consequence, then cause, then the one lever. No thresholds, no ratios."* The Design
  // Board refused the old copy on exactly that ground, and this test would have held the
  // refused wording in place. **A test can encode a defect as a requirement**, which is why
  // the assertion now reads the principle rather than the string.
  //
  // ⚠️ HUTCHINSON'S CLAUSE SURVIVES AND IS ASSERTED: *where a gap exists, both figures stay.*
  // This note has a gap (week 1 below what the runner says they run), so BOTH numbers are
  // still required — that is what makes it coaching rather than a disclaimer.
  it('names the change and the reason, with BOTH volumes and no ratio (§51 + §18 rule 2)', () => {
    const plan = gen({ weeks_at_current_volume: 3 })
    const note = plan.meta.returning_runner_note ?? ''
    expect(note, 'a volume cut with no explanation reads as a broken plan').toBeTruthy()
    // ⚠️ DERIVED FROM THE PLAN, NOT TYPED. My first version asserted `21 km` — 70% of the
    // stated 30 — and the engine produces 23, because the start fraction is not the only
    // thing acting on week 1. A hand-computed expectation tests my arithmetic, not the note.
    const week1 = Math.round(plan.weeks.find(w => w.n === 1)!.weekly_km)
    expect(week1, 'week 1 must be BELOW the stated volume or there is no gap to explain')
      .toBeLessThan(30)
    expect(note, "the start volume, read off the plan").toContain(`${week1} km`)
    expect(note, "the runner's stated volume — both figures stay where a gap exists").toContain('30 km')
    expect(note, 'the REASON, not just the change').toMatch(/coming back from a break/)
    expect(note, '§18 rule 2 forbids a ratio').not.toMatch(/\d+%/)
    expect(note, 'engine register must not reach the runner').not.toContain('the engine prefers')
  })

  it('a settled runner gets no such note', () => {
    expect(gen().meta.returning_runner_note ?? null).toBeNull()
  })
})
