import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { validatePlan } from './invariants'
import { generateRulePlan } from './ruleEngine'
import type { GeneratorInput, Plan } from '@/types/plan'

/**
 * `INV-PLAN-LONGEST-RUN-NOT-IN-BASE` (§23 Amendment, Coaching Board 2026-10-10).
 *
 * 🔴 THE ARM THAT MATTERS MOST IS THE TIE ARM, because a tie is what made the rate we
 * took to the board wrong by 13.6 percentage points. The board was told **10.8%**,
 * measured by keeping the FIRST maximum met — and base weeks come first, so every plan
 * whose long run never grows was counted as an inversion. Strictly: **0 of 2,294**.
 * Same flaw already recorded for `INV-PLAN-PEAK-IN-PEAK-PHASE`.
 */

const PS = '2026-10-05'
const CODE = 'INV-PLAN-LONGEST-RUN-NOT-IN-BASE'

function planWith(lr: Record<string, number>): Plan {
  // One week per phase, each carrying a long run of the given distance.
  const weeks = Object.entries(lr).map(([phase, km], i) => ({
    n: i + 1, phase, type: 'normal',
    date: new Date(Date.parse(PS) + i * 7 * 864e5).toISOString().slice(0, 10),
    weekly_km: km * 2,
    sessions: { sun: { type: 'easy', role: 'long_run', label: 'Long run', distance_km: km } },
  }))
  return { meta: { race_distance_km: 42.2, plan_start: PS }, weeks } as unknown as Plan
}
const fire = (p: Plan) => validatePlan(p, {} as GeneratorInput).filter(v => v.code === CODE)

describe('INV-PLAN-LONGEST-RUN-NOT-IN-BASE', () => {
  it('fires when base is STRICTLY above everything after it', () => {
    const v = fire(planWith({ base: 23, build: 18.5, peak: 20.5, taper: 20 }))
    expect(v).toHaveLength(1)
    expect(v[0].severity).toBe('warn')
    // The live case, as measured: base 23.0 against a later max of 20.5.
    expect(v[0].actual).toContain('23.0')
    expect(v[0].actual).toContain('20.5')
  })

  it('🔴 does NOT fire on a TIE — this is the whole correction', () => {
    // 10km, 10km, 10km, 10km is a FLAT long run, not a backwards one. §23's
    // maintenance case, already honestly classified. Counting it is what produced
    // the 10.8% the board ruled on.
    expect(fire(planWith({ base: 10, build: 10, peak: 10, taper: 10 }))).toHaveLength(0)
    // A tie with only ONE later phase is still a tie.
    expect(fire(planWith({ base: 20.5, build: 18, peak: 20.5 }))).toHaveLength(0)
  })

  it('does not fire on a normal progressive plan', () => {
    expect(fire(planWith({ base: 12, build: 18, peak: 24, taper: 20 }))).toHaveLength(0)
  })

  it('does not fire when there is no later long run to invert against', () => {
    expect(fire(planWith({ base: 23 }))).toHaveLength(0)
  })

  it('does not fire when base carries no long run', () => {
    expect(fire(planWith({ build: 18, peak: 24 }))).toHaveLength(0)
  })

  /**
   * ⚠️ NO DISTANCE OR GOAL CLAUSE. ⚕️ Sims, binding: *"expressed against the MECHANISM,
   * never as '5K/10K are exempt'."* 📊 Seiler's `time_target` finding concerned the long
   * run yielding INTO peak (build/taper), which the tie arm above already permits.
   */
  it('is written against the mechanism, with no distance or goal exemption', () => {
    const src = readFileSync('lib/plan/invariants.ts', 'utf8')
    const i = src.indexOf("code: '" + CODE + "'")
    expect(i).toBeGreaterThan(-1)
    // Bound the region to this invariant's own block, never grep the 8,000-line file.
    const block = src.slice(src.lastIndexOf('{', src.lastIndexOf('INV-PLAN-LONGEST-RUN-NOT-IN-BASE (§23', i)), i)
    expect(block).not.toMatch(/race_distance_km\s*[<>=]/)
    expect(block).not.toMatch(/goal\s*===/)
  })

  it('REACHES real engine output rather than only hand-built fixtures', () => {
    // A fixture-only invariant is one nobody has run against the producer. This asserts
    // the generated shape is scored at all, and that a healthy plan is clean.
    const input = {
      athlete_name: 'X', age: 35, race_name: 'R', primary_metric: 'distance', plan_start: PS,
      race_distance_km: 42.2, race_date: '2027-03-01', goal: 'finish', resting_hr: 52, max_hr: 180,
      current_weekly_km: 30, longest_recent_run_km: 14, user_declared_level: 'intermediate',
      recent_quality_training: 'occasional', hard_session_relationship: 'neutral',
      training_age: '2-5yr', days_available: 5, days_cannot_train: [], injury_history: [],
      max_weekday_mins: 60, terrain: 'mixed',
    } as unknown as GeneratorInput
    const plan = generateRulePlan(input, 'paid', PS, undefined, PS)
    expect(plan.weeks.some(w => w.phase === 'base')).toBe(true)
    expect(validatePlan(plan, input).filter(v => v.code === CODE)).toHaveLength(0)
  })
})
