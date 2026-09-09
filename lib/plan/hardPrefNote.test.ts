import { describe, it, expect } from 'vitest'
import { generateRulePlan } from './ruleEngine'
import type { GeneratorInput, Plan } from '@/types/plan'

/**
 * §96 / HSR-INERT-01 — the brand-routed honesty line for `hard_session_relationship: 'love'`.
 *
 * Coaching Board CB-HSR-01 (2026-09-07) ruled the experience gate on love's STRUCTURAL
 * effect CORRECT (peak-LR stretch + §47 back-to-back exception are tissue-tolerance
 * judgements) — "the defect is that nothing tells the runner the answer is conditional.
 * That is copy, not coaching, and is routed to brand." This is that copy: a `love` runner
 * below the 5yr+ tier is told the preference is noted and earned with training history,
 * rather than silently discarded. The trigger is the single `training_age !== '5yr+'`
 * condition on purpose — re-deriving the full multi-branch gate would duplicate it.
 */

const base = (o: Partial<GeneratorInput>): GeneratorInput => ({
  race_date: '2026-12-13', race_distance_km: 10, goal: 'time_target', target_time: '0:45:00',
  days_available: 5, age: 40, current_weekly_km: 40, longest_recent_run_km: 14,
  resting_hr: 50, max_hr: 186, preferred_long_run_day: 'sun',
  benchmark: { type: 'race', distance_km: 10, time: '0:49:00' },
  ...o,
} as GeneratorInput)

const note = (p: Plan) => p.meta.hard_pref_note

describe('HSR-INERT-01 — a sub-5yr+ `love` runner is told the preference is conditional', () => {
  for (const training_age of ['<6mo', '6-18mo', '2-5yr'] as const) {
    it(`love + ${training_age}: carries the honesty note`, () => {
      const p = generateRulePlan(base({ hard_session_relationship: 'love', training_age }), 'paid')
      expect(note(p), 'note present for a love runner below 5yr+').toBeTruthy()
      // Forward-looking, honest even for a 2-5yr HM runner who got the recent-run stretch:
      // it names what is EARNED with experience, never claims the preference did nothing.
      expect(note(p)!.toLowerCase()).toContain('training history')
    })
  }

  it('love + 5yr+: no note — the runner is already at the structural tier', () => {
    const p = generateRulePlan(base({ hard_session_relationship: 'love', training_age: '5yr+' }), 'paid')
    expect(note(p), '5yr+ love runner earns the effect, so no conditional note').toBeFalsy()
  })

  it('neutral + 2-5yr: no note — the line is specific to a discarded `love` preference', () => {
    const p = generateRulePlan(base({ hard_session_relationship: 'neutral', training_age: '2-5yr' }), 'paid')
    expect(note(p)).toBeFalsy()
  })
})
