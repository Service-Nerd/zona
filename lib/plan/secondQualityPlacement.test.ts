import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { generateRulePlan } from './ruleEngine'
import { validatePlan } from './invariants'
import { GENERATION_CONFIG } from './generationConfig'
import type { GeneratorInput, Week } from '@/types/plan'

/**
 * SC-01 / CD-20 — the second quality session.
 *
 * TWO defects, and one missing rule underneath them.
 *
 * Defect 1: the candidate list was hardcoded ['tue','thu','mon'] and never
 * considered Friday. For the common shape — long run Sunday, first quality
 * Wednesday — Friday is the ONLY day satisfying both 48-hour gaps:
 *
 *   mon (0) → 1 from sun          ✗
 *   tue (1) → 1 from wed          ✗
 *   thu (3) → 1 from wed          ✗
 *   fri (4) → 2 from wed, 2 from sun   ✓  ← never tried
 *
 * Defect 2: the code took the first FREE day and THEN tested spacing, so a
 * failing candidate ended the search instead of advancing. Even within
 * ['tue','thu','mon'] only the first free day was ever really considered.
 *
 * The missing rule: fixing both, on a FOUR-day week, produced a plan that lost
 * ~8% of its own volume out of the single remaining easy slot (capped at
 * 0.8 × long run by §9) — peak fell below build and tripped §23. The hardcoded
 * list had been blocking that by accident while wrongly denying five-day
 * runners a session they should get.
 *
 * The board (CD-20) ruled the fix ships gated on
 * MIN_TRAINING_DAYS_FOR_SECOND_QUALITY, derived from the volume arithmetic
 * rather than chosen. Both halves are asserted here — the gate must not become
 * a blanket ban, and the fix must not resurrect the overload.
 *
 * Ruling: docs/decisions/coaching-board-2026-08-19-session-catalogue.md
 */

const FROZEN_NOW = new Date('2026-08-20T09:00:00Z')
const PLAN_START = '2026-09-07'

const BASE: GeneratorInput = {
  race_date: '2027-01-17', race_distance_km: 42.2, goal: 'time_target', target_time: '3:30:00',
  age: 43, current_weekly_km: 55, longest_recent_run_km: 24,
  resting_hr: 48, max_hr: 188, preferred_long_run_day: 'sun',
  fitness_level: 'experienced', training_age: '2-5yr',
  days_available: 5,
}

const FIVE_DAY: GeneratorInput = { ...BASE, days_available: 5 }
const FOUR_DAY: GeneratorInput = { ...BASE, days_available: 4 }

const DAY_INDEX: Record<string, number> = { mon: 0, tue: 1, wed: 2, thu: 3, fri: 4, sat: 5, sun: 6 }
const gap = (a: string, b: string) => {
  const d = Math.abs(DAY_INDEX[a] - DAY_INDEX[b])
  return Math.min(d, 7 - d)
}
const daysOfType = (w: Week, t: string) =>
  Object.entries(w.sessions).filter(([, s]) => s?.type === t).map(([d]) => d)

beforeAll(() => { vi.useFakeTimers(); vi.setSystemTime(FROZEN_NOW) })
afterAll(() => { vi.useRealTimers() })

describe('SC-01 — second quality session placement', () => {
  it('a five-day week gets its second quality session', () => {
    // The half the old candidate list was wrongly denying.
    const plan = generateRulePlan(FIVE_DAY, 'paid', PLAN_START)
    const withTwo = plan.weeks.filter(w => daysOfType(w, 'quality').length >= 2)
    expect(withTwo.length).toBeGreaterThan(0)
  })

  it('a four-day week does not — and says so', () => {
    // The half the old candidate list was blocking by accident. McMillan's
    // amendment: the withheld session is a RECORDED decision, not a silent
    // absence. This assertion is the amendment.
    const plan = generateRulePlan(FOUR_DAY, 'paid', PLAN_START)
    const withTwo = plan.weeks.filter(w => daysOfType(w, 'quality').length >= 2)
    expect(withTwo).toHaveLength(0)

    const recorded = (plan.meta.rule_adjustments ?? [])
      .find(r => r.rule === 'V8-second-quality-min-days')
    expect(recorded, 'four-day plan must record why the second quality was withheld').toBeTruthy()
    expect(recorded!.weeks_affected.length).toBeGreaterThan(0)
  })

  it('the gate matches the configured minimum, not a hardcoded 5', () => {
    // Guards against the numeric being changed in config while the engine keeps
    // its own copy — the Configuration Singularity failure mode.
    expect(GENERATION_CONFIG.MIN_TRAINING_DAYS_FOR_SECOND_QUALITY).toBeGreaterThan(4)
    const belowGate = GENERATION_CONFIG.MIN_TRAINING_DAYS_FOR_SECOND_QUALITY - 1
    const plan = generateRulePlan({ ...BASE, days_available: belowGate }, 'paid', PLAN_START)
    expect(plan.weeks.filter(w => daysOfType(w, 'quality').length >= 2)).toHaveLength(0)
  })

  it('spacing holds everywhere quality is placed', () => {
    // The fix must not buy the second session by breaking the doctrine it was
    // wrongly blamed on.
    const minQualLong = GENERATION_CONFIG.MIN_HOURS_BETWEEN_QUALITY_AND_LONG / 24
    const minQualQual = GENERATION_CONFIG.MIN_HOURS_BETWEEN_QUALITY / 24

    for (const input of [FIVE_DAY, FOUR_DAY]) {
      const plan = generateRulePlan(input, 'paid', PLAN_START)
      for (const w of plan.weeks) {
        const quality = daysOfType(w, 'quality')
        const long = daysOfType(w, 'long')
        for (const q of quality) {
          for (const l of long) {
            expect(gap(q, l), `wk${w.n}: ${q} vs long ${l}`).toBeGreaterThanOrEqual(minQualLong)
          }
        }
        for (let i = 0; i < quality.length; i++) {
          for (let j = i + 1; j < quality.length; j++) {
            expect(gap(quality[i], quality[j]), `wk${w.n}: ${quality[i]} vs ${quality[j]}`)
              .toBeGreaterThanOrEqual(minQualQual)
          }
        }
      }
    }
  })

  it('both plans validate — no §23 volume regression', () => {
    // The four-day plan tripped INV-PLAN-PEAK-IN-PEAK-PHASE before the gate.
    for (const input of [FIVE_DAY, FOUR_DAY]) {
      const plan = generateRulePlan(input, 'paid', PLAN_START)
      const errors = validatePlan(plan, input).filter(v => v.severity === 'error')
      expect(errors, errors.map(v => `${v.code}: ${v.message}`).join('\n')).toHaveLength(0)
    }
  })
})
