import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { generateRulePlan } from './ruleEngine'
import { composePlanWithFoundation } from './foundationCompose'
import { resizeForDeferredFoundationAdd } from './foundationResize'
import type { GeneratorInput, Plan, Week } from '@/types/plan'

/**
 * FOUNDATION-CHOICE-RESIZE-01 — the onset must not depend on WHEN the runner
 * answered the foundation modal.
 *
 * On the >28-day 'choice' band the plan is generated with `foundation_decision`
 * unknown (the board-ratified conservative default — never presume 'add'), so
 * §91's on-ramp credit is not applied and the base keeps its full floor. When the
 * runner later taps "Add Foundation Block", `resizeForDeferredFoundationAdd`
 * re-runs the RULE engine with the decision so the base is credited exactly as if
 * the answer had been known at generation.
 *
 * The core test is PARITY under a frozen clock: decided-at-generation and
 * deferred-then-added must produce the same plan. If the anchoring assumption
 * (planStart = meta.plan_start round-trips through calcPlanLength) ever broke,
 * this goes red.
 */

const FROZEN_NOW = new Date('2026-09-07T09:00:00Z')
const TODAY = '2026-09-07'

const race = (wk: number) => {
  const d = new Date(2026, 8, 7)
  d.setDate(d.getDate() + wk * 7)
  return d.toISOString().slice(0, 10)
}

/** The founder's live input — fires the §89 gate. At race(20) the plan extends to
 *  max_weeks and its start lands >28 days out: the 'choice' band, generated with
 *  no decision, base at the gated floor and NO block. */
const ready10k = (o: Partial<GeneratorInput> = {}): GeneratorInput => ({
  race_date: race(20), race_distance_km: 10, goal: 'time_target',
  target_time: '0:45:00', benchmark: { type: 'race', distance_km: 10, time: '0:49:00' },
  current_weekly_km: 30, longest_recent_run_km: 10, days_available: 4, age: 44,
  resting_hr: 52, max_hr: 185, preferred_long_run_day: 'sun',
  training_age: '2-5yr', user_declared_level: 'experienced',
  recent_quality_training: 'regular', ...o,
} as GeneratorInput)

/** Structural skeleton of a week — everything the enricher CANNOT write. Two weeks
 *  with the same skeleton are the same prescription. */
const skeleton = (w: Week) =>
  JSON.stringify({
    n: w.n, phase: w.phase,
    sessions: Object.fromEntries(
      Object.entries(w.sessions).map(([d, s]) => [d, s && {
        type: s.type, role: s.role, catalogue_id: s.catalogue_id,
        zone: s.zone, distance_km: s.distance_km, duration_mins: s.duration_mins,
      }]),
    ),
  })

const planSkeleton = (p: Plan) => p.weeks.map(skeleton)
const hasQuality = (w: Week) => Object.values(w.sessions).some(s => s?.type === 'quality')
const calendarOnset = (p: Plan) => {
  const i = p.weeks.findIndex(hasQuality)
  return i === -1 ? null : i + 1
}

beforeAll(() => { vi.useFakeTimers(); vi.setSystemTime(FROZEN_NOW) })
afterAll(() => { vi.useRealTimers() })

describe('FOUNDATION-CHOICE-RESIZE-01 — deferred add === decided at generation', () => {
  it('is the choice band with an early-onset runner and no block at generation', () => {
    // Guards the fixture: if §97 ever fully absorbs this gap so no block is owed,
    // the parity test below would pass vacuously.
    const plan = generateRulePlan(ready10k(), 'paid')
    expect(plan.meta.early_quality_onset, 'gate must fire').toBe(true)
    expect(plan.meta.foundation_gap_class ?? 'choice',
      'should be the >28-day choice band').toBe('choice')
    expect(plan.meta.foundation_weeks_planned, 'no block at generation (undecided)').toBe(0)
  })

  it('produces the SAME plan whether the add was known at generation or deferred', () => {
    // Reference: the runner decided 'add' up front.
    const refInput = ready10k({ foundation_decision: 'add' })
    const refComposed = composePlanWithFoundation(
      generateRulePlan(refInput, 'paid'), refInput, TODAY, 'add')

    // Deferred: generated undecided, then resized when the answer lands.
    const defInput = ready10k()
    const defGen = generateRulePlan(defInput, 'paid')
    const resized = resizeForDeferredFoundationAdd(defGen, defInput, 'paid', TODAY)
    const defComposed = composePlanWithFoundation(resized, defInput, TODAY, 'add')

    expect(planSkeleton(defComposed.plan)).toEqual(planSkeleton(refComposed.plan))
    expect(defComposed.plan.meta.plan_start).toBe(refComposed.plan.meta.plan_start)
  })

  it('actually moves the onset earlier — the fix is not a no-op', () => {
    // Without the resize (compose only), the deferred runner's onset is LATER.
    const defInput = ready10k()
    const defGen = generateRulePlan(defInput, 'paid')

    const withoutFix = composePlanWithFoundation(defGen, defInput, TODAY, 'add')
    const resized = resizeForDeferredFoundationAdd(defGen, defInput, 'paid', TODAY)
    const withFix = composePlanWithFoundation(resized, defInput, TODAY, 'add')

    const before = calendarOnset(withoutFix.plan)
    const after = calendarOnset(withFix.plan)
    expect(before).not.toBeNull()
    expect(after).not.toBeNull()
    expect(after!, 'resized onset must be no later than the compose-only onset')
      .toBeLessThanOrEqual(before!)
    // And strictly earlier for this fixture — the whole reason the item exists.
    expect(after!).toBeLessThan(before!)
  })
})

describe('FOUNDATION-CHOICE-RESIZE-01 — surgical: untouched where it must be', () => {
  it('returns a NON-early-onset plan byte-identical (fast path, no re-run)', () => {
    // §91 credit is consumed only inside `if (earlyOnset)`, so re-running would
    // change nothing — the function must not even try.
    const input = ready10k({ injury_history: ['Left knee, recurring'] }) // vetoes the gate
    const plan = generateRulePlan(input, 'paid')
    expect(plan.meta.early_quality_onset).toBeFalsy()
    const out = resizeForDeferredFoundationAdd(plan, input, 'paid', TODAY)
    expect(out).toBe(plan) // same reference — provably untouched
  })
})

describe('FOUNDATION-CHOICE-RESIZE-01 — enrichment is preserved, never stale', () => {
  // Tag every incoming week's copy with its own prescription so we can prove the
  // graft only carries copy onto a week whose prescription is unchanged.
  const enrich = (p: Plan): Plan => ({
    ...p,
    meta: { ...p.meta, enrichment: 'applied' },
    weeks: p.weeks.map(w => ({ ...w, theme: `ENRICHED:${skeleton(w)}` })),
  })

  it('grafts enriched copy only onto weeks the re-size left unchanged', () => {
    const input = ready10k()
    const enriched = enrich(generateRulePlan(input, 'paid'))
    const resized = resizeForDeferredFoundationAdd(enriched, input, 'paid', TODAY)

    // Enrichment status stays honest — never silently dropped.
    expect(['applied', 'applied_partial']).toContain(resized.meta.enrichment)

    // SAFETY: any week that kept enriched copy must still match the prescription
    // that copy was written for. A stale graft (copy describing the old structure)
    // is the exact D-17 class this must never produce.
    for (const w of resized.weeks) {
      const t = w.theme ?? ''
      if (!t.startsWith('ENRICHED:')) continue
      expect(t, `grafted copy on n=${w.n} must match its own current skeleton`)
        .toBe(`ENRICHED:${skeleton(w)}`)
    }

    // And the graft is not vacuous — at least one week carried its copy across.
    expect(resized.weeks.some(w => (w.theme ?? '').startsWith('ENRICHED:')),
      'some structurally-unchanged week should keep its enriched copy').toBe(true)
  })

  it('does not graft when the incoming plan was never enriched', () => {
    const input = ready10k()
    const gen = generateRulePlan(input, 'paid') // meta.enrichment unset / rule copy
    const resized = resizeForDeferredFoundationAdd(gen, input, 'paid', TODAY)
    // Rule copy in, rule copy out — no fabricated 'applied' status.
    expect(resized.meta.enrichment).not.toBe('applied')
  })
})
