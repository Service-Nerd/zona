import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { generateRulePlan } from './ruleEngine'
import { validatePlan } from './invariants'
import type { GeneratorInput } from '@/types/plan'

/**
 * SC-06 / CD-16 — the pace inversion.
 *
 * Goal pace comes from the runner's stated target time; interval pace from
 * their measured benchmark VDOT. When the target is ambitious enough, goal pace
 * OVERTAKES interval pace. In the audit's traced plan:
 *
 *   goal-pace sessions (W6, W7, W11)  4:30/km, HR ceiling 160
 *   VO2max sessions    (W9, W10)      4:33/km, HR band   160–188
 *
 * The sessions labelled VO2max are prescribed three seconds per kilometre
 * SLOWER than the sessions labelled race pace, while carrying a heart-rate band
 * 28 beats wider at the top. A runner following pace finds the "VO2max" work
 * easier; a runner following heart rate finds the opposite. The plan cannot be
 * executed as written by both metrics.
 *
 * The cause is structural, not a slip, so ANY sufficiently ambitious target
 * produces it. Nothing caught it because every other invariant validates one
 * session in isolation — each session was individually defensible.
 *
 * The board ruled: reconcile the two, or surface the honesty signal, and named
 * §44's difficulty band as the correct surface (already ordinal, already FREE,
 * already exists to say "this is a real ask" without pretending to a
 * probability). INV-PLAN-INTENSITY-ORDERING therefore does not forbid the
 * inversion — it forbids a plan being SILENT about one.
 *
 * Ruling: docs/decisions/coaching-board-2026-08-19-session-catalogue.md
 */

const FROZEN_NOW = new Date('2026-08-20T09:00:00Z')
const PLAN_START = '2026-09-07'

// The audit's Task B profile: 10K PB 48:30, target 44:59 — 21 sec/km beyond
// measured fitness, which is what drives goal pace past interval pace.
const STRETCH: GeneratorInput = {
  race_date: '2026-11-29', race_distance_km: 10, goal: 'time_target', target_time: '0:44:59',
  days_available: 4, age: 43, current_weekly_km: 40, longest_recent_run_km: 18,
  resting_hr: 48, max_hr: 188, preferred_long_run_day: 'sun',
  benchmark: { type: 'race', distance_km: 10, time: '0:48:30' },
  injury_history: ['Left knee, posterior, recurring'],
}

// Same runner, a target roughly in line with the benchmark. The control: the
// inversion must NOT be declared when it does not exist, or the band becomes
// noise and stops meaning anything.
const REALISTIC: GeneratorInput = { ...STRETCH, target_time: '0:48:00' }

beforeAll(() => { vi.useFakeTimers(); vi.setSystemTime(FROZEN_NOW) })
afterAll(() => { vi.useRealTimers() })

describe('SC-06 — cross-session intensity ordering', () => {
  it('an ambitious target is declared, not hidden', () => {
    const plan = generateRulePlan(STRETCH, 'paid', PLAN_START)
    expect(plan.meta.goal_beyond_measured_fitness).toBe(true)
    expect(plan.meta.difficulty_band).not.toBe('comfortable')
    expect(plan.meta.difficulty_note).toBeTruthy()
    // The note must explain the artefact the runner will actually notice.
    expect(plan.meta.difficulty_note!.toLowerCase()).toContain('race-pace')
  })

  it('a realistic target is not flagged (no false positive)', () => {
    const plan = generateRulePlan(REALISTIC, 'paid', PLAN_START)
    expect(plan.meta.goal_beyond_measured_fitness).toBeUndefined()
  })

  it('the declared plan passes validation', () => {
    const plan = generateRulePlan(STRETCH, 'paid', PLAN_START)
    const found = validatePlan(plan, STRETCH).filter(v => v.code === 'INV-PLAN-INTENSITY-ORDERING')
    expect(found, found.map(v => v.message).join('\n')).toHaveLength(0)
  })

  it('an UNDECLARED inversion is rejected', () => {
    // The real assertion. Strip the honesty signal and keep the paces — this is
    // precisely the plan that shipped, and it must not validate.
    const plan = generateRulePlan(STRETCH, 'paid', PLAN_START)
    const silent = structuredClone(plan)
    delete silent.meta.goal_beyond_measured_fitness
    silent.meta.difficulty_band = 'comfortable'

    const found = validatePlan(silent, STRETCH).filter(v => v.code === 'INV-PLAN-INTENSITY-ORDERING')
    expect(found.length).toBeGreaterThan(0)
    expect(found[0].severity).toBe('error')
    expect(found[0].message).toContain('Zone 4–5')
  })

  it('the check is genuinely cross-session, not per-session', () => {
    // Guard the premise that makes this invariant a new class: the two sessions
    // it compares are in DIFFERENT weeks. A per-session validator cannot see
    // this defect however carefully it inspects any single session.
    const plan = generateRulePlan(STRETCH, 'paid', PLAN_START)
    const quality = plan.weeks.flatMap(w =>
      Object.values(w.sessions)
        .filter(s => s?.type === 'quality' && s.pace_target)
        .map(s => ({ week: w.n, zone: (s!.zone ?? '').toLowerCase() })))

    const vo2Weeks = quality.filter(q => q.zone.includes('zone 4') || q.zone.includes('zone 5')).map(q => q.week)
    const thrWeeks = quality.filter(q => q.zone.includes('zone 3') && !q.zone.includes('zone 4')).map(q => q.week)

    expect(vo2Weeks.length).toBeGreaterThan(0)
    expect(thrWeeks.length).toBeGreaterThan(0)
    // No week contains both bands — so the comparison spans weeks by necessity.
    expect(vo2Weeks.some(w => thrWeeks.includes(w))).toBe(false)
  })
})
