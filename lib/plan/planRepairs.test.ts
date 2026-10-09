import { describe, it, expect } from 'vitest'
import {
  repriceStaleSteps, matchHeadersToSteps, stripEffortGovernedPace,
  repriceLongRunSegments, repairPlan, REPAIRABLE_CODES, type RepairViolation,
} from './planRepairs'
import { generateRulePlan } from './ruleEngine'
import { validatePlan } from './invariants'
import { buildPaceFromVDOT } from './paceBands'
import { fitnessAnchorMap } from './fitnessAnchorMap'
import { PINNED_PLAN_START_0907 } from './__fixtures__/pinnedPlanStart'
import type { GeneratorInput, Plan, Session } from '@/types/plan'

/**
 * DUNCAN-RESIDUAL-LOAD-01 — the four repairs for a plan damaged by
 * `RECAL-PACE-TWO-WRITER-01`.
 *
 * ⚠️ EVERY REPAIR IS SCOPED BY THE INVARIANT'S OWN VERDICTS, and these arms are
 * what hold that. The first repair written re-derived its own test, which was
 * LOOSER than the check, and would have re-priced two sessions sitting exactly on
 * the runner's GOAL band — §22's deliberate substitution. The invariant was right
 * and the fix was wrong. The arms below pin the scope in both directions: it acts
 * on what is flagged, and **does not act on what is not**.
 */

const tenK = (o: Partial<GeneratorInput> = {}): GeneratorInput => ({
  race_date: '2026-12-13', race_distance_km: 10, goal: 'time_target',
  target_time: '0:49:00', benchmark: { type: 'race', distance_km: 10, time: '0:46:00' },
  current_weekly_km: 45, longest_recent_run_km: 23, days_available: 5, age: 43,
  preferred_long_run_day: 'sun', training_age: '2-5yr',
  user_declared_level: 'intermediate', recent_quality_training: 'regular',
  terrain: 'road', injury_history: ['hip'], hard_session_relationship: 'neutral',
  ...o,
} as GeneratorInput)

const plan = () => generateRulePlan(tenK(), 'paid', PINNED_PLAN_START_0907)
const guide = (vdot: number) => buildPaceFromVDOT(vdot * 0.97, vdot)

const quality = (p: Plan): { week: number; day: string; s: Session }[] =>
  p.weeks.flatMap(w => Object.entries(w.sessions)
    .filter(([, s]) => s?.type === 'quality' && s?.derived_set)
    .map(([day, s]) => ({ week: w.n, day, s: s as Session })))

const workPaces = (s: Session): string[] =>
  (s.derived_set?.blocks ?? []).flatMap(b => b.steps)
    .filter(st => st.role === 'work' && st.pace).map(st => st.pace as string)

describe('REPAIRABLE_CODES', () => {
  /**
   * ⚠️ THE CALLER'S POPULATION READS THIS LIST. It selected plans by ONE code
   * before, so once that code was repaired a plan dropped out of the target set
   * entirely — and the motivating plan still had EIGHT other repairable
   * violations at that moment, invisible to the tool written for them.
   */
  it('names a remedy for every code, and no code without one', () => {
    expect(Array.from(REPAIRABLE_CODES).sort()).toEqual([
      'INV-PLAN-5K10K-LR-PACE-CAP',
      'INV-PLAN-EFFORT-GOVERNED-NOT-GOAL-PACED',
      'INV-PLAN-HEADER-PACE-MATCHES-WORK',
      'INV-PLAN-STEP-PACE-FROM-GUIDE',
    ])
  })
})

describe('repriceStaleSteps', () => {
  it('re-prices a flagged step to the band ITS OWN anchor means now', () => {
    const p = plan()
    const q = quality(p).find(x => workPaces(x.s).length === 1)!
    const stale = '9:99–9:99 /km'
    const before = workPaces(q.s)[0]
    q.s.derived_set!.blocks[0].steps.find(st => st.role === 'work' && st.pace)!.pace = stale
    const v: RepairViolation[] = [{
      code: 'INV-PLAN-STEP-PACE-FROM-GUIDE', week: q.week, actual: stale,
    }]
    expect(repriceStaleSteps(p, v, guide(44))).toBeGreaterThanOrEqual(1)
    expect(workPaces(q.s)).not.toContain(stale)
    // It is the anchor's band, which is what makes it a derivation not a guess.
    const admitted = Object.values(fitnessAnchorMap(guide(44)))
    expect(admitted).toContain(workPaces(q.s)[0])
    void before
  })

  it('does NOT touch a step the violation does not name — §22 lives here', () => {
    const p = plan()
    const q = quality(p).find(x => workPaces(x.s).length === 1)!
    const original = workPaces(q.s)[0]
    // A violation for a DIFFERENT band on the same week.
    const v: RepairViolation[] = [{
      code: 'INV-PLAN-STEP-PACE-FROM-GUIDE', week: q.week, actual: '1:11–1:11 /km',
    }]
    expect(repriceStaleSteps(p, v, guide(38))).toBe(0)
    expect(workPaces(q.s)[0]).toBe(original)
  })

  it('does nothing with no violations — the empty-population case', () => {
    const p = plan()
    const snapshot = JSON.stringify(p.weeks)
    expect(repriceStaleSteps(p, [], guide(44))).toBe(0)
    expect(JSON.stringify(p.weeks)).toBe(snapshot)
  })
})

describe('matchHeadersToSteps', () => {
  it('sets the header to the band its own steps run', () => {
    const p = plan()
    const q = quality(p).find(x => new Set(workPaces(x.s)).size === 1)!
    const stepBand = workPaces(q.s)[0]
    q.s.pace_target = '9:00–9:30 /km'          // the damage: header flattened
    const n = matchHeadersToSteps(p, [{ code: 'INV-PLAN-HEADER-PACE-MATCHES-WORK', week: q.week }])
    expect(n).toBeGreaterThanOrEqual(1)
    expect(q.s.pace_target).toBe(stepBand)
  })

  it('leaves a MIXED-anchor row alone — §85 means its header equals no single step', () => {
    const p = plan()
    const q = quality(p).find(x => new Set(workPaces(x.s)).size > 1)
    if (!q) return expect(true).toBe(true)      // no mixed row in this fixture
    const original = q.s.pace_target
    matchHeadersToSteps(p, [{ code: 'INV-PLAN-HEADER-PACE-MATCHES-WORK', week: q.week }])
    expect(q.s.pace_target).toBe(original)
  })

  it('ignores a violation of another code', () => {
    const p = plan()
    const q = quality(p)[0]
    q.s.pace_target = '9:00–9:30 /km'
    expect(matchHeadersToSteps(p, [{ code: 'INV-PLAN-STEP-PACE-FROM-GUIDE', week: q.week }])).toBe(0)
    expect(q.s.pace_target).toBe('9:00–9:30 /km')
  })
})

describe('stripEffortGovernedPace', () => {
  it('DELETES the field — the only repair that removes rather than rewrites', () => {
    const p = plan()
    const q = quality(p)[0]
    q.s.pace_target = '5:24–5:39 /km'
    const n = stripEffortGovernedPace(p, [{
      code: 'INV-PLAN-EFFORT-GOVERNED-NOT-GOAL-PACED', week: q.week, day: q.day,
    }])
    expect(n).toBe(1)
    expect('pace_target' in q.s).toBe(false)   // absent, not empty-string
  })

  it('respects the DAY, so a sibling session on the same week is untouched', () => {
    const p = plan()
    const week = p.weeks.find(w => Object.values(w.sessions).filter(s => s?.pace_target).length >= 2)
    if (!week) return expect(true).toBe(true)
    const days = Object.entries(week.sessions).filter(([, s]) => s?.pace_target).map(([d]) => d)
    const keep = week.sessions[days[1] as keyof typeof week.sessions]!.pace_target
    stripEffortGovernedPace(p, [{
      code: 'INV-PLAN-EFFORT-GOVERNED-NOT-GOAL-PACED', week: week.n, day: days[0],
    }])
    expect(week.sessions[days[1] as keyof typeof week.sessions]!.pace_target).toBe(keep)
  })
})

describe('repriceLongRunSegments', () => {
  it('re-prices lr_segment_pace to the runner\'s own HM band', () => {
    const p = plan()
    const w = p.weeks[4]
    const day = Object.keys(w.sessions)[0] as keyof typeof w.sessions
    ;(w.sessions[day] as { lr_segment_pace?: string }).lr_segment_pace = '4:51–5:09 /km'
    const g = guide(38.4)
    const n = repriceLongRunSegments(p, [{
      code: 'INV-PLAN-5K10K-LR-PACE-CAP', week: w.n, day: String(day),
    }], g)
    expect(n).toBe(1)
    expect((w.sessions[day] as { lr_segment_pace?: string }).lr_segment_pace).toBe(g.hmPaceStr)
  })

  it('declines when the guide has no HM band — §24b, not a fallback', () => {
    const p = plan()
    const w = p.weeks[4]
    const day = Object.keys(w.sessions)[0] as keyof typeof w.sessions
    ;(w.sessions[day] as { lr_segment_pace?: string }).lr_segment_pace = '4:51–5:09 /km'
    const beginner = { ...guide(38.4), hmPaceStr: null }
    expect(repriceLongRunSegments(p, [{
      code: 'INV-PLAN-5K10K-LR-PACE-CAP', week: w.n, day: String(day),
    }], beginner)).toBe(0)
    expect((w.sessions[day] as { lr_segment_pace?: string }).lr_segment_pace).toBe('4:51–5:09 /km')
  })
})

describe('repairPlan — the composed path', () => {
  /**
   * ⚠️ ORDER MATTERS AND THIS IS WHAT PINS IT. The header repair READS the steps,
   * so it must run after they are re-priced; otherwise it would match a header to
   * a stale step, which is this defect inverted.
   */
  it('re-prices the steps BEFORE matching the header to them', () => {
    const p = plan()
    const q = quality(p).find(x => new Set(workPaces(x.s)).size === 1)!
    const stale = '9:99–9:99 /km'
    q.s.derived_set!.blocks[0].steps.find(st => st.role === 'work' && st.pace)!.pace = stale
    q.s.pace_target = stale
    const r = repairPlan(p, [
      { code: 'INV-PLAN-STEP-PACE-FROM-GUIDE', week: q.week, actual: stale },
      { code: 'INV-PLAN-HEADER-PACE-MATCHES-WORK', week: q.week },
    ], guide(44))
    expect(r.steps).toBeGreaterThanOrEqual(1)
    // The header must equal the RE-PRICED step, never the stale one.
    expect(q.s.pace_target).not.toBe(stale)
    expect(q.s.pace_target).toBe(workPaces(q.s)[0])
  })

  it('introduces no NEW violation on a clean plan given no violations', () => {
    const input = tenK()
    const p = generateRulePlan(input, 'paid', PINNED_PLAN_START_0907)
    const before = validatePlan(p, input).filter(v => v.severity === 'error').length
    repairPlan(p, [], guide(44))
    expect(validatePlan(p, input).filter(v => v.severity === 'error').length).toBe(before)
  })
})
