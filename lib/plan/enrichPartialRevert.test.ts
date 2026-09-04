import { describe, it, expect } from 'vitest'
import { attributableWeeks, revertWeeksToRuleCopy } from './enrichPartialRevert'
import type { Plan, Week } from '@/types/plan'
import type { Violation } from './invariants'

/**
 * ENRICH-PARTIAL-01 — one bad week must not discard thirteen good ones.
 *
 * `INV-PLAN-COPY-MATCHES-SESSIONS` (§27) rejects week copy promising what the
 * week does not contain. The check is right. The CONSEQUENCE was not: one
 * offending word on one week discarded enriched copy for the whole plan.
 *
 * Observed on a real trial plan 2026-09-04 — two §27 violations, on two of the
 * five weeks carrying no intensity, cost the runner voice on all fourteen. Base
 * phase is all-easy by design (§4/§5), so exposure is highest for beginners and
 * finish-goal plans: the runners least likely to know the app should sound
 * different, and most likely to be on trial.
 */

const week = (n: number, label: string, theme: string, note: string): Week => ({
  n, date: '2026-09-07', label, theme, type: 'normal', phase: 'base',
  weekly_km: 30, long_run_hrs: 1,
  sessions: { mon: { type: 'easy', label: `s${n}`, detail: null, distance_km: 8, coach_notes: [note] } },
} as unknown as Week)

const planOf = (...ws: Week[]): Plan => ({ meta: {}, weeks: ws } as unknown as Plan)

const RULE = planOf(
  week(1, 'Base — easy start', 'Zone 2 discipline.', 'rule note 1'),
  week(2, 'Base — consistency', 'Steady aerobic work.', 'rule note 2'),
  week(3, 'Build — first quality', 'Intensity begins.', 'rule note 3'),
)
const ENRICHED = planOf(
  week(1, 'Base — feels hard', 'This week will feel hard.', 'ai note 1'),
  week(2, 'Base — the engine room', 'Slower than feels right.', 'ai note 2'),
  week(3, 'Build — the work starts', 'First quality session.', 'ai note 3'),
)

const v = (code: string, wk: number | undefined): Violation =>
  ({ code, week: wk, severity: 'error', principle_ref: 'x', message: 'm' } as unknown as Violation)

describe('attributableWeeks', () => {
  it('collects the weeks a violation set names', () => {
    const r = attributableWeeks([v('A', 1), v('B', 3), v('C', 1)], RULE)
    expect(Array.from(r.weeks).sort()).toEqual([1, 3])
    expect(r.allAttributable).toBe(true)
  })

  it('refuses to attribute a plan-level violation', () => {
    // Meta and plan-wide checks (week 0, or no week) cannot be repaired by
    // reverting one week's copy. The caller must fall back to a full revert
    // rather than silently "fix" something it has not fixed.
    expect(attributableWeeks([v('A', 1), v('META', undefined)], RULE).allAttributable).toBe(false)
    expect(attributableWeeks([v('A', 0)], RULE).allAttributable).toBe(false)
  })

  it('refuses to attribute a week the plan does not contain', () => {
    expect(attributableWeeks([v('A', 99)], RULE).allAttributable).toBe(false)
  })
})

describe('revertWeeksToRuleCopy', () => {
  it('restores ONLY the named weeks and leaves the rest enriched', () => {
    // The whole point. Before this, week 2 and 3's voice was collateral damage.
    const out = revertWeeksToRuleCopy(ENRICHED, RULE, new Set([1]))
    expect(out.weeks[0].label).toBe('Base — easy start')
    expect(out.weeks[0].theme).toBe('Zone 2 discipline.')
    expect(out.weeks[1].label).toBe('Base — the engine room')   // untouched
    expect(out.weeks[2].theme).toBe('First quality session.')   // untouched
  })

  it('restores session copy too — label and coach_notes', () => {
    const out = revertWeeksToRuleCopy(ENRICHED, RULE, new Set([1]))
    const reverted = out.weeks[0].sessions.mon!
    expect(reverted.coach_notes).toEqual(['rule note 1'])
    const kept = out.weeks[1].sessions.mon!
    expect(kept.coach_notes).toEqual(['ai note 2'])
  })

  it('leaves every numeric alone', () => {
    // The enricher cannot write numerics today (EnrichedWeekSchema exposes label,
    // theme and coach_notes only), so restoring whole week objects would work —
    // until that schema widened, at which point it would start silently
    // discarding engine output. Pinned so the narrow copy-only revert stays.
    const out = revertWeeksToRuleCopy(ENRICHED, RULE, new Set([1]))
    expect(out.weeks[0].weekly_km).toBe(ENRICHED.weeks[0].weekly_km)
    expect(out.weeks[0].sessions.mon!.distance_km).toBe(8)
  })

  it('is a no-op for an empty week set, and does not mutate its input', () => {
    expect(revertWeeksToRuleCopy(ENRICHED, RULE, new Set())).toBe(ENRICHED)
    const out = revertWeeksToRuleCopy(ENRICHED, RULE, new Set([1]))
    expect(ENRICHED.weeks[0].label, 'input was mutated').toBe('Base — feels hard')
    expect(out).not.toBe(ENRICHED)
  })

  it('leaves a week alone when the rule plan has no counterpart', () => {
    // A week absent from the rule plan has no rule copy to restore; dropping or
    // blanking it would be worse than leaving the enriched version in place.
    const out = revertWeeksToRuleCopy(ENRICHED, planOf(RULE.weeks[0]), new Set([1, 2]))
    expect(out.weeks[0].label).toBe('Base — easy start')
    expect(out.weeks[1].label).toBe('Base — the engine room')
  })
})
