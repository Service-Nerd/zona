import { describe, it, expect } from 'vitest'
import { generateRulePlan } from './ruleEngine'
import { COHORT_PLAN_START } from './cohortGrid'
import type { GeneratorInput } from '@/types/plan'

// DAYS-GATE-CAPACITY-01 — §18 Amendment requires `frequency_constraint_note` to
// name the days declared, the days used, AND THE REASON. It fired for every cause
// and hard-coded the VOLUME reason, so a runner who had blocked five days was told
// their weekly volume was why.
//
// ⚠️ THE POPULATION IS CONSTRUCTED, AND IT HAS TO BE. `cohortGrid()` barely blocks
// days (measured: 0 of 2,218 note-carrying grid plans are blocked-day-limited; all
// ten found came from a cohort built by hand), and the item's own production read
// says the same — most days ever blocked by a real runner is 4, and this needs 5-6,
// reachable only from the Adjust sheet. A gate pointed at the grid would pass
// while saying nothing.
const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']

// ⚠️ `declared 6 / blocked 5` is deliberately NOT used here. It throws
// INV-PLAN-QUALITY-NOT-ZERO at error severity, which is this item's OTHER half —
// the `block`-tier gate being evadable — and that half carries an explicit DO NOT
// FIX and "ask Russ". `blocked 4` is the same defect with a plan that generates.
function plan(declared: number, blockedCount: number, weeklyKm: number, level = 'intermediate') {
  const input = {
    race_distance_km: 21.1, race_date: '2027-02-14', fitness_level: level,
    current_weekly_km: weeklyKm, longest_recent_run_km: Math.max(5, Math.round(weeklyKm * 0.4)),
    days_available: declared,
    days_cannot_train: DAYS.slice(0, blockedCount), age: 35,
    goal: 'time_target', goal_type: 'time', target_time: '01:50:00',
    training_age: '2-5yr', recent_quality_training: 'regular', metric: 'distance',
  } as unknown as GeneratorInput
  return generateRulePlan(input, 'paid', COHORT_PLAN_START, undefined, COHORT_PLAN_START)
}

const VOLUME_REASON = /your weekly volume spread any thinner/
const BLOCKED_REASON = /you have blocked \d+ days and only \d+ are clear/

describe('DAYS-GATE-CAPACITY-01 — the frequency note names the REAL reason', () => {
  it('a blocked-day-limited runner is told about their blocked days, not their volume', () => {
    // declared 6, five days blocked: capacity is 2, and that is what binds.
    const note = String(plan(6, 4, 40).meta.frequency_constraint_note ?? '')
    expect(note, 'the note must fire at all for this runner').not.toBe('')
    expect(note, `named the wrong reason: ${note}`).toMatch(BLOCKED_REASON)
    expect(note, `still blames volume: ${note}`).not.toMatch(VOLUME_REASON)
  })

  it('names the lever that actually works', () => {
    expect(String(plan(6, 4, 40).meta.frequency_constraint_note ?? ''))
      .toMatch(/Freeing up a day is what adds one, not more volume/)
  })

  it('a volume-limited runner still gets the volume reason — 99.5% of the real population', () => {
    // No days blocked, so capacity is 7 and cannot be what binds. A low-volume
    // beginner is the shape that actually triggers the volume branch; an
    // intermediate at 25 km simply gets all six days and emits no note at all,
    // which would make this arm vacuous.
    const note = String(plan(6, 0, 15, 'beginner').meta.frequency_constraint_note ?? '')
    expect(note, 'the note must fire at all for this runner').not.toBe('')
    expect(note, `lost the volume reason: ${note}`).toMatch(VOLUME_REASON)
    expect(note, `wrongly blames blocked days: ${note}`).not.toMatch(BLOCKED_REASON)
  })

  it('always states the declared and the used count, which §18 Am. also requires', () => {
    for (const [d, b, km, lvl] of [[6, 4, 40, 'intermediate'], [6, 0, 15, 'beginner']] as const) {
      const note = String(plan(d, b, km, lvl).meta.frequency_constraint_note ?? '')
      expect(note).toMatch(new RegExp(`You told us you can run ${d} days a week`))
      expect(note).toMatch(/This plan uses \d+/)
    }
  })
})
