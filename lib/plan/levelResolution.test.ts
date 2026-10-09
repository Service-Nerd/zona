import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { resolveLevels, assessFitness } from './fitnessAssessment'
import { generateRulePlan, derivedLevelsFor, vdotFor } from './ruleEngine'
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
  const ROUTE = readFileSync(join(__dirname, '..', '..', 'app', 'api', 'generate-plan', 'route.ts'), 'utf8')

  // A source assertion, and its limits are stated: the refusal path needs auth, a
  // request and a Supabase write, so there is no unit-testable seam. What CAN be
  // asserted is that the event is built from the owner and not from the field that
  // was always undefined.
  it('builds the level fields from derivedLevelsFor, not from input.fitness_level', () => {
    const i = ROUTE.indexOf("recordOpsEvent('plan_refused_by_design'")
    expect(i, 'the refusal event moved — re-point this check').toBeGreaterThan(0)
    // ⚠️ COMMENTS STRIPPED BEFORE MATCHING. The first version of this arm matched
    // the whole slice and failed on the EXPLANATORY COMMENT directly above the
    // fix, which quotes the defective line verbatim. That is the
    // "ownership arm matching its own comment" class CLAUDE.md records three
    // instances of; a check that cannot tell prose from code is not a check.
    const block = ROUTE.slice(i, i + 3000)
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .split('\n').map(l => l.replace(/\/\/.*$/, '')).join('\n')
    expect(block).toContain('derivedLevelsFor(input)')
    expect(block).toContain('fitness_level_declared')
    expect(block).toContain('fitness_level_assessed')
    // 🔴 The defect, pinned: the bare field must not be the recorded level again.
    expect(block).not.toMatch(/\bfitness_level:\s*input\.fitness_level\b/)
  })
})
