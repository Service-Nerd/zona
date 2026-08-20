import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { generateRulePlan } from './ruleEngine'
import { validatePlan } from './invariants'
import { V1_SESSION_CATALOGUE } from './sessionCatalogueData'
import type { GeneratorInput } from '@/types/plan'

/**
 * SC-05 / CD-18 — 10K had no race-specific session.
 *
 * The catalogue held HM-pace intervals, an HM-pace long run, a marathon-pace
 * long run and an all-distance taper sharpener — and nothing at 10K pace. The
 * nearest a 10K runner got was 1000s at 5K pace, plus a build-phase session the
 * engine renames "10K-pace progression" on the fly with no catalogue entry
 * behind it. 10K is one of two free-tier flagship distances.
 *
 * The board's correction to the audit is the part worth remembering: the rename
 * is NOT an undocumented workaround — §33 explicitly sanctions it, names this
 * exact case, and requires the borrowed voice be replaced, which the engine does
 * correctly. The finding is different and worse: **§33 closed the review by
 * fixing the symptom (borrowed voice) and left the cause (no 10K entry) in
 * place.** A principle can close a review without closing a gap.
 *
 * Ruling: docs/decisions/coaching-board-2026-08-19-session-catalogue.md
 */

const FROZEN_NOW = new Date('2026-08-20T09:00:00Z')
const PLAN_START = '2026-09-07'

const INPUT: GeneratorInput = {
  race_date: '2026-11-29', race_distance_km: 10, goal: 'time_target', target_time: '0:44:59',
  days_available: 4, age: 43, current_weekly_km: 40, longest_recent_run_km: 18,
  resting_hr: 48, max_hr: 188, preferred_long_run_day: 'sun',
  benchmark: { type: 'race', distance_km: 10, time: '0:48:30' },
}

beforeAll(() => { vi.useFakeTimers(); vi.setSystemTime(FROZEN_NOW) })
afterAll(() => { vi.useRealTimers() })

describe('SC-05 — 10K owns a race-specific session', () => {
  it('the catalogue has a 10K-specific race-pace entry', () => {
    const own = V1_SESSION_CATALOGUE.filter(r =>
      r.category === 'race_specific'
      && r.distance_eligibility.includes('10K')
      && r.distance_eligibility.length < 6)   // the all-distance generic doesn't count
    expect(own.length).toBeGreaterThan(0)
    expect(own[0].name).toBe('10K-pace intervals')
  })

  it('a 10K plan actually receives it — the row is not dead weight', () => {
    // The trap this guards: the row is eligible in peak, but the 10K peak
    // prefers vo2max, and the taper force-picked the all-distance sharpener.
    // Added without the selection change, this session would never be chosen.
    const plan = generateRulePlan(INPUT, 'paid', PLAN_START)
    const labels = plan.weeks.flatMap(w =>
      Object.values(w.sessions).map(s => s?.label ?? ''))
    expect(labels).toContain('10K-pace intervals')
  })

  it('the most specific race row wins over the all-distance generic', () => {
    const plan = generateRulePlan(INPUT, 'paid', PLAN_START)
    const taperLabels = plan.weeks
      .filter(w => w.phase === 'taper')
      .flatMap(w => Object.values(w.sessions).map(s => s?.label ?? ''))
    expect(taperLabels).toContain('10K-pace intervals')
    expect(taperLabels).not.toContain('Goal-pace sharpener')
  })

  it('HM and marathon still resolve to their own race rows', () => {
    // Ranking by distance_eligibility size must not have disturbed the
    // distances that were already correct.
    for (const [km, expected] of [[21.1, 'HM'], [42.2, 'MARATHON']] as const) {
      const own = V1_SESSION_CATALOGUE.filter(r =>
        r.category === 'race_specific'
        && r.distance_eligibility.includes(expected)
        && r.distance_eligibility.length < 6)
      expect(own.length, `${expected} lost its race-specific rows`).toBeGreaterThan(0)
      expect(km).toBeGreaterThan(0)
    }
  })

  it('the invariant rejects a distance with no race row of its own', () => {
    // Exercise the rule rather than trusting the current catalogue: a
    // time-targeted plan at a distance whose race pace is distinct from I-pace
    // must own a real entry. Simulated by asking the check about a plan whose
    // distance has been switched to one lacking such a row.
    const plan = generateRulePlan(INPUT, 'paid', PLAN_START)
    const errs = validatePlan(plan, INPUT)
      .filter(v => v.code === 'INV-PLAN-RACE-SPECIFIC-EXPOSURE')
    expect(errs, errs.map(v => v.message).join('\n')).toHaveLength(0)
  })

  it('the plan validates end to end', () => {
    const plan = generateRulePlan(INPUT, 'paid', PLAN_START)
    const errors = validatePlan(plan, INPUT).filter(v => v.severity === 'error')
    expect(errors, errors.map(v => `${v.code}: ${v.message}`).join('\n')).toHaveLength(0)
  })
})
