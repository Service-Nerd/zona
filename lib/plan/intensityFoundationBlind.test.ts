import { describe, it, expect } from 'vitest'
import { validatePlan } from './invariants'
import { GENERATION_CONFIG } from './generationConfig'
import type { GeneratorInput, Plan, Week } from '@/types/plan'

/**
 * §1's denominator is the MAIN PLAN — Coaching Board CB-FOUNDATION-DENOM-01
 * (2026-09-10). §57 foundation weeks (n <= 0) are excluded.
 *
 * ── How this file got here, because the history is the argument ──────────────
 *
 * `INV-PLAN-INTENSITY-DISTRIBUTION` counted running sessions off `plan.weeks`,
 * and `validatePlan` runs TWICE on different objects: once on the bare plan
 * inside `generateRulePlan`, and again on the assembled plan in
 * `composePlanWithFoundation`. Foundation weeks are all-easy running, so they
 * enlarged the denominator on the second object only — the two runs disagreed
 * BY CONSTRUCTION.
 *
 * That produced two successive defects, each fixed by deferring the check:
 *   BLIND-01 (2026-09-09) deferred while `foundation_weeks_planned > 0`.
 *   BLIND-02 (2026-09-10) found BLIND-01's key was false on the >28-day 'choice'
 *     band — the decision arrives AFTER generation, so the planned count is 0
 *     while three weeks are still delivered — and widened the defer, adding a
 *     compose-time marker so declining the block could not leave §1unchecked.
 *
 * Both were correct under the doctrine of the day, and both were treating a
 * symptom. The board then removed the cause: measure main-plan weeks only, and
 * the two runs return the same verdict, so there is nothing to defer. **All the
 * defer machinery is deleted.** A defect class that cannot occur beats a check
 * that catches it.
 *
 * The coaching half: §57 says foundation weeks "are never part of the main
 * plan's periodisation arc", and §57's CB-1 ruling defines the block's job as
 * "habit and routine, not adaptation" — so a ratio governing adaptation may not
 * spend them (Seiler). Including them also made the ceiling looser the earlier a
 * runner happened to generate: same block, same quality sessions, different
 * verdict (Hutchinson). §22's SC-05 closure had already ruled the same way about
 * `totalWeeks` in this same file.
 */

const TENK_INPUT: GeneratorInput = {
  race_date: '2026-11-29', race_distance_km: 10, goal: 'time_target', target_time: '0:44:59',
  days_available: 4, age: 43, current_weekly_km: 40, longest_recent_run_km: 18,
  resting_hr: 48, max_hr: 188, preferred_long_run_day: 'sun',
  benchmark: { type: 'race', distance_km: 10, time: '0:48:30' },
}

const easy = { type: 'easy', label: 'Easy', distance_km: 5, zone: 'Zone 2', hr_target: '<145' }
const qual = { type: 'quality', label: 'Threshold', distance_km: 5, zone: 'Zone 3', hr_target: '150-160' }

/** Build an over-ceiling 10K plan: 10 quality of 20 running = 50% >> 25%. */
function overCeilingPlan(fwp: number, foundationWeeks = 0): Plan {
  const weeks: Week[] = []
  for (let n = 1; n <= 10; n++) {
    weeks.push({ n, phase: 'build', sessions: { mon: qual, thu: easy } } as unknown as Week)
  }
  for (let i = 0; i < foundationWeeks; i++) {
    weeks.unshift({ n: -i, phase: 'foundation', sessions: { mon: easy, thu: easy } } as unknown as Week)
  }
  return { weeks, meta: { volume_profile: 'build', foundation_weeks_planned: fwp } } as unknown as Plan
}

/**
 * A plan that BREACHES on its main weeks but would fall UNDER the ceiling once
 * all-easy foundation weeks are added to the denominator. This is the case the
 * old counting rule masked, and the reason the ruling is not cosmetic.
 *
 * main: 5 quality + 14 easy = 5/19 = 26.3% (10K ceiling 25%)
 * plus 3 foundation weeks of 2 easy = 5/25 = 20.0% — under, if they counted.
 */
function maskedByDilutionPlan(): Plan {
  const weeks: Week[] = []
  for (let n = 1; n <= 5; n++) {
    weeks.push({ n, phase: 'build', sessions: { mon: qual, thu: easy } } as unknown as Week)
  }
  for (let n = 6; n <= 8; n++) {
    weeks.push({ n, phase: 'build', sessions: { wed: easy, thu: easy, sat: easy } } as unknown as Week)
  }
  for (let i = 0; i < 3; i++) {
    weeks.unshift({ n: -i, phase: 'foundation', sessions: { mon: easy, thu: easy } } as unknown as Week)
  }
  return { weeks, meta: { volume_profile: 'build', foundation_weeks_planned: 3 } } as unknown as Plan
}

const intensityViolations = (plan: Plan) =>
  validatePlan(plan, TENK_INPUT).filter(v => v.code === 'INV-PLAN-INTENSITY-DISTRIBUTION')

/** Count exactly as the invariant does, to prove a fixture is what it claims. */
function share(plan: Plan, includeFoundation: boolean) {
  const HARD = new Set(['quality', 'intervals', 'tempo'])
  let hard = 0, running = 0
  for (const w of plan.weeks.filter(w => includeFoundation || w.n >= 1)) {
    for (const s of Object.values(w.sessions) as Array<{ type: string } | undefined>) {
      if (!s || ['rest', 'strength', 'cross-train'].includes(s.type)) continue
      running++
      if (HARD.has(s.type)) hard++
    }
  }
  return (hard / running) * 100
}

describe('CB-FOUNDATION-DENOM-01 — §1 counts main-plan weeks only', () => {
  it('the config flag is the one the invariant reads (not decorative)', () => {
    expect(GENERATION_CONFIG.INTENSITY_DISTRIBUTION_COUNTS_FOUNDATION_WEEKS).toBe(false)
  })

  it('a real breach fires when no block is coming', () => {
    // The INTENSITY-LONGDIST-LOWDAY-01 detection path. Unchanged by the ruling.
    const found = intensityViolations(overCeilingPlan(0))
    expect(found.length).toBeGreaterThan(0)
    expect(found[0].message).toContain('above the 10K ceiling')
  })

  it('the BARE and ASSEMBLED objects now return the SAME verdict', () => {
    // The property that dissolves BLIND-01/02. `validatePlan` runs on both
    // objects; if they can disagree, one of the two runs is always wrong and a
    // defer is needed to hide it. They must not disagree.
    const bare = intensityViolations(overCeilingPlan(3))
    const assembled = intensityViolations(overCeilingPlan(3, 3))

    expect(bare.length).toBeGreaterThan(0)
    expect(assembled.length).toBe(bare.length)
    expect(assembled[0].message).toBe(bare[0].message)
  })

  it('a block PENDING no longer suppresses the check (the defer is gone)', () => {
    // BLIND-01 asserted the opposite of this — deliberately, and correctly for
    // the doctrine it had. Recorded as a reversal, not an oversight.
    expect(intensityViolations(overCeilingPlan(3)).length).toBeGreaterThan(0)
  })

  it('all-easy foundation weeks CANNOT dilute a breach below the ceiling', () => {
    // The decisive case. Prove the fixture really is the masking shape first,
    // or this test passes for the wrong reason.
    const plan = maskedByDilutionPlan()
    const ceiling = GENERATION_CONFIG.INTENSITY_DISTRIBUTION['10K'].max_quality_session_pct

    expect(share(plan, false), 'main weeks must breach').toBeGreaterThan(ceiling)
    expect(share(plan, true), 'whole plan must fall under — this is the masking')
      .toBeLessThan(ceiling)

    expect(intensityViolations(plan).length,
      'the breach must survive the dilution').toBeGreaterThan(0)
  })

  it('the verdict does not move with the length of the block', () => {
    // Two runners, identical main plan, different generation timing. §1 must be
    // indifferent — that was Hutchinson's whole objection.
    const messages = [0, 1, 2, 3].map(fw => intensityViolations(overCeilingPlan(3, fw))[0]?.message)
    expect(new Set(messages).size, 'one verdict regardless of block length').toBe(1)
    expect(messages[0]).toBeDefined()
  })
})
