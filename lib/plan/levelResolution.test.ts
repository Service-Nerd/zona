import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { resolveLevels, assessFitness } from './fitnessAssessment'
import { generateRulePlan, derivedLevelsFor, vdotFor } from './ruleEngine'
import { runEngine } from './engine'
import { GENERATION_CONFIG } from './generationConfig'
import { PINNED_PLAN_START_1012 as PINNED } from './__fixtures__/pinnedPlanStart'
import type { GeneratorInput } from '@/types/plan'

// REFUSAL-TELEMETRY-LEVEL-01 (2026-10-09) — §79's four levels have ONE producer,
// and a caller that is not generating a plan can reach it.
//
// ── WHY ──────────────────────────────────────────────────────────────────────
// REFUSAL-TELEMETRY-01 records the inputs behind every designed refusal, so we
// can see WHICH runners the engine turns away. It recorded
// `fitness_level: input.fitness_level` — the API-level STRUCTURAL override the
// wizard never sends. `types/plan.ts` says so in as many words: "do NOT repurpose
// it for the wizard's user selection; that is `user_declared_level`".
//
// MEASURED: 20 `plan_refused_by_design` events in production, **0 carrying any
// level**. The key was absent entirely — JSON drops `undefined` — so the field
// was inert from the day it shipped and nothing looked like it was wrong.
//
// Copying the engine's fifteen lines into the route would have been the
// `deloadCadence` defect by hand. So they moved into `resolveLevels` and both
// callers use it.

const mk = (over: Partial<GeneratorInput> = {}): GeneratorInput => ({
  race_distance_km: 10, race_date: '2027-03-21', days_available: 4, goal: 'finish',
  current_weekly_km: 30, longest_recent_run_km: 12, age: 35, injuries: [],
  recent_quality_training: 'regular', training_age: '2-5yr',
  ...over,
} as unknown as GeneratorInput)

describe('resolveLevels — the single owner of §79\'s four levels', () => {
  it('with no declaration it is the assessment, unchanged', () => {
    const i = mk()
    const a = assessFitness(i.current_weekly_km, i.longest_recent_run_km, undefined, true)
    const l = resolveLevels(i)
    expect(l.structural).toBe(a.structural)
    expect(l.intensity).toBe(a.intensity)
    expect(l.declared).toBeUndefined()
  })

  // 🔴 THE ASYMMETRY. This is the rule the engine must not lose, and the measured
  // defect behind it: a 10K runner at 15 km/wk declaring `experienced` went week 1
  // 13 -> 20 km and peak 18 -> 35 when a declaration was allowed to set structure.
  it('an UPWARD declaration moves intensity only; structure stays on the assessment', () => {
    expect(GENERATION_CONFIG.USER_DECLARED_LEVEL_BINDS_STRUCTURE_DOWNWARD_ONLY).toBe(true)
    const i = mk({ current_weekly_km: 15, longest_recent_run_km: 6, training_age: '<6mo' })
    const base = resolveLevels(i)
    const up = resolveLevels({ ...i, user_declared_level: 'experienced' })
    expect(base.structural, 'fixture must assess BELOW experienced or this arm is vacuous')
      .not.toBe('experienced')
    expect(up.intensity).toBe('experienced')
    expect(up.structural).toBe(base.structural)
  })

  it('a DOWNWARD declaration binds BOTH — volunteered caution is credible', () => {
    const i = mk({ current_weekly_km: 55, longest_recent_run_km: 22, training_age: '5yr+' })
    const base = resolveLevels(i)
    expect(base.structural, 'fixture must assess ABOVE beginner or this arm is vacuous')
      .not.toBe('beginner')
    const down = resolveLevels({ ...i, user_declared_level: 'beginner' })
    expect(down.structural).toBe('beginner')
    expect(down.intensity).toBe('beginner')
  })

  it('the API-level fitness_level override stands in for the assessment, both axes', () => {
    const i = mk({ current_weekly_km: 12, longest_recent_run_km: 4, fitness_level: 'experienced' })
    const l = resolveLevels(i)
    expect(l.assessedStructural).toBe('experienced')
    expect(l.assessedIntensity).toBe('experienced')
  })
})

describe('derivedLevelsFor — the refusal path reaches the ENGINE\'s answer', () => {
  // 🔴 THE ARM THAT MATTERS: the engine and the telemetry must agree. If they ever
  // disagree, the refusal record describes a plan that would not have been built.
  it('agrees with the levels the engine actually built the plan at, across cohorts', () => {
    const cohorts: Partial<GeneratorInput>[] = [
      {},
      { user_declared_level: 'experienced' },
      { user_declared_level: 'beginner', current_weekly_km: 55, longest_recent_run_km: 22, training_age: '5yr+' },
      { current_weekly_km: 10, longest_recent_run_km: 4, training_age: '<6mo', recent_quality_training: 'none' },
      { benchmark: { type: 'race', distance_km: 5, time: '0:19:30' } } as Partial<GeneratorInput>,
      { benchmark: { type: 'race', distance_km: 5, time: '0:33:00' }, current_weekly_km: 50 } as Partial<GeneratorInput>,
      { fitness_level: 'experienced', current_weekly_km: 12, longest_recent_run_km: 4 },
    ]
    for (const over of cohorts) {
      const i = mk(over)
      const plan = generateRulePlan(i, 'paid', PINNED)
      const l = derivedLevelsFor(i)
      expect(plan.meta.fitness_level, JSON.stringify(over)).toBe(l.structural)
      // ⚠️ `fitness_intensity_level` is OMITTED from meta when it equals the
      // structural level (`...(intensityFitness !== fitness ? {…} : {})`), so an
      // absent field means "the same", not "unknown". Comparing it raw gives a
      // false failure on every cohort where the two agree — which is most of them.
      expect(plan.meta.fitness_intensity_level ?? plan.meta.fitness_level, JSON.stringify(over))
        .toBe(l.intensity)
    }
  })

  it('reaches a level for a WIZARD input, which is the case that recorded nothing', () => {
    // The wizard sends `user_declared_level` and never `fitness_level`. The old
    // telemetry read the latter, so this is the exact shape that logged `undefined`.
    const i = mk({ user_declared_level: 'intermediate', fitness_level: undefined })
    const l = derivedLevelsFor(i)
    expect(i.fitness_level).toBeUndefined()           // the old field: nothing to record
    expect(l.declared).toBe('intermediate')           // what the runner said
    expect(l.assessedStructural).toBeTruthy()         // what the engine assessed
    expect(l.structural).toBeTruthy()
    expect(l.intensity).toBe('intermediate')
  })

  it('vdotFor is the only VDOT producer, and tolerates a missing or junk benchmark', () => {
    expect(vdotFor({}).vdot).toBeUndefined()
    expect(vdotFor({ benchmark: { type: 'race', distance_km: 5, time: '0:00:00' } as never }).vdot)
      .toBeUndefined()
    const good = vdotFor({ benchmark: { type: 'race', distance_km: 5, time: '0:21:30' } as never })
    expect(good.vdot).toBeGreaterThan(0)
    // Discounted below raw (§10/§42) — so a caller cannot mistake one for the other.
    expect(good.vdot!).toBeLessThan(good.vdotRaw!)
    expect(good.discountPct).toBeGreaterThan(0)
  })
})

describe('the refusal telemetry records the levels it claims to', () => {
  /**
   * ENGINE-ENTRY-01 (2026-10-15) — THIS WAS A SOURCE ASSERTION AND ITS STATED LIMIT
   * IS GONE. It read: *"the refusal path needs auth, a request and a Supabase write,
   * so there is no unit-testable seam."* That was true of the ROUTE. `runEngine`
   * COMPUTES the telemetry payload and returns it — recording it is the caller's —
   * so the payload is a value this test inspects directly.
   *
   * 🔑 The old arm could only prove the right source text was present. It could not
   * prove the payload carries usable levels, which is the thing that was broken: 20
   * production events, **0 carrying any level**.
   */
  const refuse = (extra: Record<string, unknown>) => {
    const input = {
      race_distance_km: 42.2, race_date: '2026-12-28', goal: 'finish',
      current_weekly_km: 6, longest_recent_run_km: 3, days_available: 3,
      training_age: '<6mo', age: 38, injury_history: [],
      recent_quality_training: 'none', hard_session_relationship: 'neutral',
      ...extra,
    } as unknown as GeneratorInput
    const outcome = runEngine({
      input, tier: 'paid', displayUnits: 'km',
      planStart: '2026-10-05', today: '2026-10-05',
    })
    expect(outcome.kind, 'this input must be refused for the arm to mean anything').toBe('refusal')
    if (outcome.kind !== 'refusal') throw new Error('unreachable')
    expect(outcome.telemetry, 'a designed refusal must be recordable').not.toBeNull()
    return { input, detail: outcome.telemetry!.detail }
  }

  /** What the WIZARD sends. `fitness_level` is the API-level override it never sets. */
  const WIZARD = { user_declared_level: 'experienced' }

  it('the payload carries all four derived levels, not undefined', () => {
    const { detail } = refuse(WIZARD)
    for (const k of ['fitness_level_declared', 'fitness_level_assessed',
                     'fitness_level_structural', 'fitness_level_intensity']) {
      expect(detail, `the refusal event lost ${k}`).toHaveProperty(k)
    }
    // Present is not enough — undefined is the exact state the 20 events were in.
    expect(detail.fitness_level_assessed).toBeTruthy()
    expect(detail.fitness_level_structural).toBeTruthy()
    expect(detail.fitness_level_intensity).toBeTruthy()
  })

  it('🔴 the bare `fitness_level` key does not come back — that WAS the defect', () => {
    expect(refuse(WIZARD).detail, 'REFUSAL-TELEMETRY-LEVEL-01 returning')
      .not.toHaveProperty('fitness_level')
  })

  it('records what the runner SAID and what the engine ASSESSED, and they disagree', () => {
    // The whole value of the event: a refusal where the two differ is the
    // interesting one. A 6 km/week first-timer who calls themselves experienced.
    const { detail } = refuse(WIZARD)
    expect(detail.fitness_level_declared).toBe('experienced')
    expect(detail.fitness_level_structural, 'a 6 km/week first-timer is not structurally experienced')
      .toBe('beginner')
    expect(detail.fitness_level_assessed).toBe('beginner')
    // The wizard sends no API override, so it is recorded as absent rather than guessed.
    expect(detail.fitness_level_api_override).toBeNull()
  })

  it('agrees with derivedLevelsFor itself, so producer and event cannot drift', () => {
    const { input, detail } = refuse(WIZARD)
    const l = derivedLevelsFor(input)
    expect(detail.fitness_level_declared).toBe(l.declared ?? null)
    expect(detail.fitness_level_assessed).toBe(l.assessedStructural)
    expect(detail.fitness_level_structural).toBe(l.structural)
    expect(detail.fitness_level_intensity).toBe(l.intensity)
  })

  /**
   * ⚠️ MEASURED, NOT ASSUMED, AND IT CORRECTED AN EARLIER VERSION OF THIS ARM.
   * I first asserted `assessed` could never equal the API override. It can: with
   * `fitness_level` set, `derivedLevelsFor` returns the override for **all four**
   * levels and the engine's genuine read sits in `assessment.structural`, which the
   * event does not carry. So when the override IS present the telemetry cannot tell
   * SAID from ASSESSED.
   *
   * 🔻 A LATENT GAP, NOT A LIVE DEFECT — the wizard sends `user_declared_level` and
   * never `fitness_level`, which is the entire finding of REFUSAL-TELEMETRY-LEVEL-01.
   * Pinned here so it is visible, and so that if a caller ever does set the override
   * the limitation is already written down rather than rediscovered.
   */
  it('pins the API-override case: all four collapse to the override', () => {
    const { detail } = refuse({ fitness_level: 'experienced' })
    expect(detail.fitness_level_api_override).toBe('experienced')
    expect(detail.fitness_level_assessed).toBe('experienced')
    expect(detail.fitness_level_structural).toBe('experienced')
    // And the honest consequence: nothing in the event holds the engine's own read.
    expect(detail.fitness_level_declared).toBeNull()
  })
})
