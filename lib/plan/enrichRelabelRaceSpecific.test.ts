import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { generateRulePlan } from './ruleEngine'
import { validatePlan } from './invariants'
import type { GeneratorInput, Plan } from '@/types/plan'

/**
 * A1 regression — INV-PLAN-RACE-SPECIFIC-EXPOSURE must survive enricher relabeling.
 *
 * The per-week arm of the invariant enforced a STRUCTURAL rule (second-half
 * build/peak quality must be goal-pace work) by testing for the substring "pace"
 * in the session label. But the label is enricher-writable (mergePlan overwrites
 * it; EnrichedWeekSchema permits it), and the enrich prompt never protected the
 * "-pace" fragment. So when the AI rephrased "10K-pace intervals" → "Speed
 * intervals", post-enrich re-validation tripped, the whole enriched plan was
 * discarded (plan_enrich_failed / post_enrich_invalid), and trial/paid users
 * silently lost their AI voice. Fix: detect goal pace via the stamped `stimulus`
 * (classifyStimulus), which the enricher cannot set — mirroring the D-17 /
 * isVo2maxSession structural precedent one line above the check.
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

function raceSpecErrs(plan: Plan) {
  return validatePlan(plan, INPUT).filter(v => v.code === 'INV-PLAN-RACE-SPECIFIC-EXPOSURE')
}

describe('A1 — race-specific exposure vs enricher relabeling', () => {
  it('the base 10K time-target plan is clean', () => {
    const plan = generateRulePlan(INPUT, 'paid', PLAN_START)
    const errs = raceSpecErrs(plan)
    expect(errs, errs.map(v => v.message).join('\n')).toHaveLength(0)
  })

  it('stays clean when the enricher rewrites race-pace labels to drop "pace"', () => {
    const plan = generateRulePlan(INPUT, 'paid', PLAN_START)
    // Simulate mergePlan applying AI voice: rewrite the label (the enricher can),
    // leave `stimulus` untouched (it cannot — EnrichedWeekSchema picks only
    // label + coach_notes). If the generator failed to stamp stimulus, this test
    // would fail — which is the point: the stamp is what carries the truth.
    let rewrote = 0
    for (const w of plan.weeks) {
      for (const s of Object.values(w.sessions)) {
        if (s && s.type === 'quality' && (s.label ?? '').toLowerCase().includes('pace')) {
          s.label = 'Speed intervals'
          rewrote++
        }
      }
    }
    expect(rewrote, 'expected at least one race-pace quality session to exist').toBeGreaterThan(0)
    const errs = raceSpecErrs(plan)
    expect(errs, errs.map(v => v.message).join('\n')).toHaveLength(0)
  })

  it('still fires for a genuinely non-race-pace session (stamp dropped + relabeled)', () => {
    const plan = generateRulePlan(INPUT, 'paid', PLAN_START)
    // Turn a second-half build/peak race-pace session into non-race-pace work,
    // dropping BOTH the stamp and the "pace" label. The invariant must still catch
    // this — otherwise the fix would mask real gaps in race-specific exposure.
    let mutated = false
    for (const w of plan.weeks) {
      if ((w.phase === 'build' || w.phase === 'peak') && w.type !== 'deload') {
        for (const s of Object.values(w.sessions)) {
          if (s && s.type === 'quality' && (s.label ?? '').toLowerCase().includes('pace')) {
            delete (s as { stimulus?: string }).stimulus
            s.label = 'Cruise intervals'   // tempo stimulus, not race pace
            mutated = true
          }
        }
      }
    }
    expect(mutated, 'expected a second-half build/peak race-pace session to mutate').toBe(true)
    expect(raceSpecErrs(plan).length).toBeGreaterThan(0)
  })
})
