import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { savePlanForUser } from '../plan'
import * as ops from '../ops/recordOpsEvent'
import { generateRulePlan } from './ruleEngine'
import type { GeneratorInput, Plan } from '@/types/plan'

// SAVE-VALIDATE-01 — THE GATE FOR THE GATE.
//
// ⚠️ THIS TEST EXISTS BECAUSE THE GUARD WAS MEASURED INERT BEFORE IT WAS
// WRITTEN. A log-only probe placed inside `savePlanForUser` and run across the
// entire suite recorded 8 saves, and ALL 8 skipped for want of
// `plan.meta.generator_input` — the fixtures build plans by hand. A guard that
// nothing in the suite can reach is the repo's own recorded failure class
// (the decorative-config family, D9's unreachable `flexShrink`, §97's two inert
// gates), so the guard ships WITH the one test that supplies the field.
//
// The falsification is recorded: with the `errors.length` branch removed, case
// 2 below fails. Verified by deleting it and re-running.

const BASE = {
  athlete_name: 'A', age: 34, race_name: 'T', primary_metric: 'distance',
  race_distance_km: 21.1, race_date: '2027-04-18', plan_start: '2026-11-02',
  goal: 'finish', fitness_level: 'intermediate', user_declared_level: 'intermediate',
  training_age: '2-5yr', resting_hr: 55, max_hr: 186,
  current_weekly_km: 35, longest_recent_run_km: 16,
  days_available: 4, injury_history: [], hard_session_relationship: 'neutral',
  recent_quality_training: 'occasional',
} as unknown as GeneratorInput

/** Minimal Supabase stub: enough surface for savePlanForUser's happy path. */
function stubSupabase() {
  const calls: string[] = []
  const thenable = (rows: unknown) => ({
    data: rows, error: null,
    eq() { return this }, gte() { return this }, maybeSingle() { return Promise.resolve({ data: null, error: null }) },
    select() { return this }, then(r: (v: unknown) => void) { r({ data: rows, error: null }) },
  })
  return {
    calls,
    from(table: string) {
      calls.push(table)
      return {
        select: () => thenable([]),
        insert: () => Promise.resolve({ data: null, error: null }),
        upsert: () => Promise.resolve({ data: null, error: null }),
        update: () => ({ eq: () => Promise.resolve({ data: null, error: null }) }),
        delete: () => ({ eq: () => Promise.resolve({ data: null, error: null }) }),
      }
    },
  } as never
}

describe('SAVE-VALIDATE-01 — savePlanForUser validates before it persists', () => {
  beforeEach(() => vi.spyOn(console, 'error').mockImplementation(() => {}))
  afterEach(() => vi.restoreAllMocks())

  it('1. a genuine engine plan carries generator_input, so the guard is REACHABLE', () => {
    const plan = generateRulePlan(BASE, 'paid')
    expect(plan.meta?.generator_input).toBeTruthy()
    // and it survives the JSON round trip through `plan_json`
    const round = JSON.parse(JSON.stringify(plan)) as Plan
    expect(round.meta?.generator_input).toBeTruthy()
  })

  it('2. an INVALID plan is refused in test rather than persisted', async () => {
    const plan = generateRulePlan(BASE, 'paid')
    // Break it the way a bad reshape would: invert the volume curve so a
    // week-on-week increase blows through §2's ramp cap.
    const broken = JSON.parse(JSON.stringify(plan)) as Plan
    for (const w of broken.weeks) w.weekly_km = (w.weekly_km ?? 0) * (w.n % 2 === 0 ? 4 : 1)
    await expect(savePlanForUser('u1', broken, stubSupabase())).rejects.toThrow(/invalid plan/i)
  })

  it('3. a VALID plan saves untouched — the guard must never block a good save', async () => {
    const plan = generateRulePlan(BASE, 'paid')
    await expect(savePlanForUser('u1', plan, stubSupabase())).resolves.toBeUndefined()
  })

  it('4. a legacy plan with no generator_input is SKIPPED, not guessed at', async () => {
    const plan = generateRulePlan(BASE, 'paid')
    const legacy = JSON.parse(JSON.stringify(plan)) as Plan
    for (const w of legacy.weeks) w.weekly_km = (w.weekly_km ?? 0) * (w.n % 2 === 0 ? 4 : 1)
    delete (legacy.meta as unknown as Record<string, unknown>).generator_input
    // Same broken plan as case 2. Without the input there is nothing to validate
    // against, so it saves — stated as behaviour, not hidden as an accident.
    await expect(savePlanForUser('u1', legacy, stubSupabase())).resolves.toBeUndefined()
  })

  it('5. an empty-weeks plan is skipped rather than validated into a false error', async () => {
    const plan = generateRulePlan(BASE, 'paid')
    const empty = JSON.parse(JSON.stringify(plan)) as Plan
    empty.weeks = []
    await expect(savePlanForUser('u1', empty, stubSupabase())).resolves.toBeUndefined()
  })
})

describe('SCHEMA-LIVE-01 — the canonical schema runs on the live save path', () => {
  beforeEach(() => vi.spyOn(console, 'error').mockImplementation(() => {}))
  afterEach(() => vi.restoreAllMocks())

  it('6. a conforming plan records NO drift event', async () => {
    const spy = vi.spyOn(ops, 'recordOpsEvent').mockResolvedValue(undefined)
    await savePlanForUser('u1', generateRulePlan(BASE, 'paid'), stubSupabase())
    expect(spy.mock.calls.filter(c => c[0] === 'plan_schema_drift')).toHaveLength(0)
  })

  it('7. a NON-conforming plan records plan_schema_drift — and still saves', async () => {
    // ⚠️ THIS IS THE LIVENESS PROOF FOR A CHECK THAT DELIBERATELY NEVER THROWS.
    // Without it the wiring would be indistinguishable from an unwired import:
    // silent in both cases. Break the shape the way PHASE-EMPTY-01 did — a
    // structural field the schema declares and the engine got wrong.
    const spy = vi.spyOn(ops, 'recordOpsEvent').mockResolvedValue(undefined)
    const plan = JSON.parse(JSON.stringify(generateRulePlan(BASE, 'paid')))
    delete (plan.meta as Record<string, unknown>).generator_input  // skip the validatePlan arm
    plan.weeks[0].sessions.tue = { type: 'not_a_session_type', label: 7, detail: null }
    await expect(savePlanForUser('u1', plan, stubSupabase())).resolves.toBeUndefined()
    const drift = spy.mock.calls.filter(c => c[0] === 'plan_schema_drift')
    expect(drift).toHaveLength(1)
    expect((drift[0][1] as { issues: number }).issues).toBeGreaterThan(0)
  })
})
