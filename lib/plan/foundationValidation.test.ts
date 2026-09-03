import { describe, it, expect } from 'vitest'
import { foundationWeekViolations, isFoundationWeek } from './foundationValidation'
import { generateRulePlan } from './ruleEngine'
import { generateFoundationBlock } from './foundationBlock'
import type { GeneratorInput, Plan } from '@/types/plan'

/**
 * ADR-020 / CB-2 — the live foundation check must report violations found by ANY
 * invariant, not just the foundation-specific one.
 *
 * The previous filter (`v.code === 'INV-PLAN-FOUNDATION-BLOCK'`) computed the
 * four INV-PLAN-NO-SESSIONS-ON-BLOCKED-DAYS violations that WERE
 * FOUNDATION-DAYS-01 and discarded every one. The bug was detected by the
 * running code and thrown away by a one-line filter on the wrong axis.
 */

const PLAN_START = '2026-11-30'
const TODAY = '2026-11-06'   // ~24-day gap → auto foundation block

// Founder's real input (plan e876c470): blocked Mon/Wed/Thu.
const INPUT: GeneratorInput = {
  age: 44, goal: 'time_target', max_hr: 185, terrain: 'road',
  race_date: '2027-04-11', resting_hr: 52, target_time: '0:45:00',
  training_age: '2-5yr', days_available: 4, max_weekday_mins: 60,
  race_distance_km: 10, current_weekly_km: 30,
  days_cannot_train: ['monday', 'wednesday', 'thursday'],
  longest_recent_run_km: 10, preferred_long_run_day: 'sun',
} as unknown as GeneratorInput

function assemble(mutate?: (w: Plan['weeks']) => Plan['weeks']): { plan: Plan } {
  const main = generateRulePlan(INPUT, 'trial', PLAN_START)
  const fb = generateFoundationBlock({ input: INPUT, planStartDate: PLAN_START, today: TODAY })
  const weeks = mutate ? mutate(fb.weeks) : fb.weeks
  return { plan: { ...main, weeks: [...weeks, ...main.weeks] } }
}

describe('foundationWeekViolations', () => {
  it('reports a blocked-day violation — the class the old code-filter discarded', () => {
    // Reinstate FOUNDATION-DAYS-01: sessions on days the runner blocked.
    const { plan } = assemble(weeks => weeks.map(w => ({
      ...w,
      sessions: {
        mon: { type: 'easy', label: 'Easy run', detail: null, distance_km: 5, zone: 'Zone 2' },
        sun: (w.sessions as Record<string, unknown>).sun,
      },
    })) as Plan['weeks'])

    const found = foundationWeekViolations(plan, INPUT)
    const codes = found.map(v => v.code)

    expect(codes).toContain('INV-PLAN-NO-SESSIONS-ON-BLOCKED-DAYS')
    // The old filter kept only this code and would have returned nothing.
    expect(codes.filter(c => c === 'INV-PLAN-FOUNDATION-BLOCK')).toHaveLength(0)
    expect(found.length).toBeGreaterThan(0)
  })

  it('reports only foundation weeks — main weeks are already server-validated', () => {
    const { plan } = assemble(weeks => weeks.map(w => ({
      ...w,
      sessions: {
        mon: { type: 'easy', label: 'Easy run', detail: null, distance_km: 5, zone: 'Zone 2' },
        sun: (w.sessions as Record<string, unknown>).sun,
      },
    })) as Plan['weeks'])

    for (const v of foundationWeekViolations(plan, INPUT)) {
      expect(v.week).toBeLessThanOrEqual(0)
    }
  })

  it('is silent on a clean foundation block', () => {
    // Current generator output for this runner is clean post-33392ca.
    const { plan } = assemble()
    expect(foundationWeekViolations(plan, INPUT)).toEqual([])
  })

  it('never throws on a malformed plan — the runner still sees their plan', () => {
    const broken = { meta: {}, weeks: null } as unknown as Plan
    expect(() => foundationWeekViolations(broken, INPUT)).not.toThrow()
    expect(foundationWeekViolations(broken, INPUT)).toEqual([])
  })

  it('isFoundationWeek keys on n <= 0 (§57 numbering)', () => {
    expect(isFoundationWeek({ n: -2 })).toBe(true)
    expect(isFoundationWeek({ n: 0 })).toBe(true)
    expect(isFoundationWeek({ n: 1 })).toBe(false)
  })
})
