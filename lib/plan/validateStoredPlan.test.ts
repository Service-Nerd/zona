import { describe, it, expect } from 'vitest'
import { validateStoredPlan, validateSavedPlan, isBaseBuildPlan, isMaintenancePlan } from './validateStoredPlan'
import { validateReshapedPlan, validatePlan, type Violation } from './invariants'
import { generateGetRunningPlan } from './getRunningPlan'
import { generateRulePlan } from './ruleEngine'
import type { GeneratorInput, Plan } from '@/types/plan'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { PINNED_PLAN_START_1012 as PINNED } from './__fixtures__/pinnedPlanStart'

// AUDIT-PLAN-KIND-01 (2026-10-09) — the right constitution for the right plan kind.
//
// Found while stamping `generator_input` on base-build plans
// (BASEBUILD-GENINPUT-01): the stamp opens `savePlanForUser`'s validate gate, and
// the gate ran the RACE-plan validator. It turned out the daily audit had been
// doing the same thing all along.
//
// 🔴 MEASURED AGAINST PRODUCTION BEFORE THE FIX:
//   (race)        32 plans  262 errors  mean  8.2
//   base_build     2 plans  101 errors  mean 50.5   ← 28% of the fleet's errors
// Every one of the 101 a phantom. `baseBuildValidate.ts`'s header had said so in
// writing — "a SEPARATE VALIDATOR, NOT AN EXEMPTION" — and nothing read it.

const mk = (over: Partial<GeneratorInput> = {}): GeneratorInput => ({
  race_distance_km: 42.195, race_date: '2027-04-25', days_available: 4,
  goal: 'finish', current_weekly_km: 8, longest_recent_run_km: 3,
  age: 32, injuries: [], recent_quality_training: 'none', training_age: '<6mo',
  ...over,
} as unknown as GeneratorInput)

const errs = (v: Violation[]) => v.filter(x => x.severity === 'error')
const baseBuild = (over: Partial<GeneratorInput> = {}): Plan =>
  generateGetRunningPlan(mk(over), PINNED, 29).plan

describe('AUDIT-PLAN-KIND-01 — the audit judges a base-build plan by §116', () => {
  it('the predicate narrows on the kind the producers actually write', () => {
    expect(isBaseBuildPlan(baseBuild())).toBe(true)
    expect(isBaseBuildPlan(generateRulePlan(mk({ race_distance_km: 10, current_weekly_km: 25,
      longest_recent_run_km: 8, training_age: '2-5yr' }), 'paid', PINNED))).toBe(false)
    expect(isBaseBuildPlan(null)).toBe(false)
  })

  // 🔴 THE DEFECT, AS A NUMBER. Not "fewer errors" — the race validator fires
  // dozens and §116's fires none, and the gap is the phantom count.
  it('a VALID base-build plan reports 0 errors, where the race validator reported dozens', () => {
    for (const cwk of [6, 8, 10, 12, 15]) {
      const plan = baseBuild({ current_weekly_km: cwk })
      const phantom = errs(validateReshapedPlan(plan))
      // The old behaviour, pinned — so this arm cannot pass by the phantoms
      // quietly going away for some unrelated reason.
      expect(phantom.length, `cwk=${cwk}: the race validator no longer fires; this arm is now vacuous`)
        .toBeGreaterThan(20)
      expect(phantom.map(v => v.code)).toContain('INV-PLAN-PREP-TIME-STATUS-ANNOTATED')

      expect(errs(validateStoredPlan(plan)).map(v => v.message), `cwk=${cwk}`).toEqual([])
      expect(errs(validateSavedPlan(plan, mk({ current_weekly_km: cwk }))).map(v => v.message), `cwk=${cwk}`).toEqual([])
    }
  })

  // §116's validator must still BITE. A dispatch that routes to a checker which
  // can never fire is the same green tick with nothing behind it.
  it('§116 still fires on a base-build plan that breaks it', () => {
    const plan = JSON.parse(JSON.stringify(baseBuild())) as Plan
    for (const w of plan.weeks) w.weekly_km = plan.weeks[0].weekly_km   // flatten the ramp
    expect(errs(validateStoredPlan(plan)).map(v => v.code)).toContain('INV-PLAN-ONRAMP-CURVE-CLIMBS')
    expect(errs(validateSavedPlan(plan, mk())).map(v => v.code)).toContain('INV-PLAN-ONRAMP-CURVE-CLIMBS')
  })

  it('a race plan is unchanged — the dispatch is additive, not a rewrite', () => {
    const i = mk({ race_distance_km: 21.1, race_date: '2027-03-21', current_weekly_km: 40,
      longest_recent_run_km: 14, training_age: '2-5yr', days_available: 5 })
    const plan = generateRulePlan(i, 'paid', PINNED)
    expect(validateStoredPlan(plan)).toEqual(validateReshapedPlan(plan))
    expect(validateSavedPlan(plan, i)).toEqual(validatePlan(plan, i))
  })

  // ⚠️ THE TWO POLICIES ARE NOT INTERCHANGEABLE, and this arm is why they are two
  // functions rather than one. `validateReshapedPlan` skips two race-week
  // invariants by design; reusing it on the save path would weaken that gate
  // silently, which is exactly the kind of same-shape-different-strictness slip
  // this repo has paid for.
  it('the save policy is STRICTER than the audit policy for a race plan', () => {
    const i = mk({ race_distance_km: 10, race_date: '2027-03-21', current_weekly_km: 25,
      longest_recent_run_km: 8, training_age: '2-5yr' })
    const plan = JSON.parse(JSON.stringify(generateRulePlan(i, 'paid', PINNED))) as Plan
    // Move race day out of the plan's final week. The invariant reads
    // `plan.meta.race_date`, so that is what has to move.
    plan.meta.race_date = '2028-01-01'
    ;(plan.meta.generator_input as GeneratorInput).race_date = '2028-01-01'

    expect(validateSavedPlan(plan, { ...i, race_date: '2028-01-01' }).map(v => v.code))
      .toContain('INV-PLAN-COVERS-RACE-DATE')
    expect(validateStoredPlan(plan).map(v => v.code))
      .not.toContain('INV-PLAN-COVERS-RACE-DATE')
  })
})

// AUDIT-MAINTENANCE-KIND-01 (2026-10-09) — the maintenance kind gets §75, and a
// plan that cannot be judged says so rather than reporting clean.
describe('AUDIT-MAINTENANCE-KIND-01 — the maintenance kind is dispatched', () => {
  /** A maintenance-shaped plan: §75 weeks, carrying the three stamped arguments. */
  const maint = (over: Record<string, unknown> = {}, weeklyKm = 30): Plan => {
    const race = generateRulePlan(mk({ race_distance_km: 10, current_weekly_km: 30,
      longest_recent_run_km: 12, training_age: '2-5yr' }), 'paid', PINNED)
    const p = JSON.parse(JSON.stringify(race)) as Plan
    ;(p.meta as unknown as Record<string, unknown>).plan_kind = 'maintenance'
    ;(p.meta as unknown as Record<string, unknown>).race_date = ''
    p.meta.source_base_weekly_km = 40
    p.meta.source_run_days_per_week = 4
    p.meta.source_injured = false
    Object.assign(p.meta as unknown as Record<string, unknown>, over)
    // Two §75 maintenance weeks, under the base-volume ceiling, all easy.
    p.weeks = [1, 2].map(n => ({
      n, label: `Maintenance ${n}`, theme: 'Ticking over.', type: 'normal',
      phase: 'maintenance_base', weekly_km: weeklyKm, long_run_hrs: null,
      sessions: {
        mon: { type: 'rest', label: 'Rest' },
        tue: { type: 'easy', label: 'Easy', distance_km: 6, duration_mins: 42, zone: 'Zone 2' },
        wed: { type: 'rest', label: 'Rest' },
        thu: { type: 'easy', label: 'Easy', distance_km: 6, duration_mins: 42, zone: 'Zone 2' },
        fri: { type: 'rest', label: 'Rest' },
        sat: { type: 'easy', label: 'Easy', distance_km: 6, duration_mins: 42, zone: 'Zone 2' },
        sun: { type: 'easy', label: 'Long', distance_km: 12, duration_mins: 84, zone: 'Zone 2', role: 'long_run' },
      },
    })) as unknown as Plan['weeks']
    return p
  }

  it('the predicate narrows on the kind the route actually writes', () => {
    expect(isMaintenancePlan(maint())).toBe(true)
    expect(isMaintenancePlan(generateRulePlan(mk({ race_distance_km: 10, current_weekly_km: 25,
      longest_recent_run_km: 8, training_age: '2-5yr' }), 'paid', PINNED))).toBe(false)
    expect(isMaintenancePlan(null)).toBe(false)
  })

  // 🔴 THE DEFECT. The race validator asks a maintenance plan about its taper,
  // its peak and its race week — a plan that has none of them by design.
  it('a maintenance plan is judged by §75, not by the race constitution', () => {
    const p = maint()
    const byRace = errs(validateReshapedPlan(p))
    // Pin the old behaviour, so this arm cannot pass by the phantoms going away
    // for some unrelated reason.
    expect(byRace.length, 'the race validator no longer fires — this arm is vacuous')
      .toBeGreaterThan(5)

    const codes = errs(validateStoredPlan(p)).map(v => v.code)
    // Whatever §75 says, it must not be the race-plan tail.
    expect(codes).not.toContain('INV-PLAN-PREP-TIME-STATUS-ANNOTATED')
    expect(codes).not.toContain('INV-PLAN-COVERS-RACE-DATE')
    expect(codes.every(c => c.startsWith('INV-MAINT-')), `got ${codes.join(', ')}`).toBe(true)
  })

  // §75 must still BITE — a dispatch to a checker that can never fire is the
  // green tick with nothing behind it.
  it('§75 fires on a maintenance plan that breaches its base-volume ceiling', () => {
    // VOLUME_CEILING_PCT_OF_BASE is 100, so a week above base must be caught.
    const p = maint({}, 80)   // 80 km weeks against a 40 km base
    const codes = errs(validateStoredPlan(p)).map(v => v.code)
    expect(codes.join(','), 'no INV-MAINT-* fired on a plan at 2x its base volume')
      .toMatch(/INV-MAINT-/)
  })

  // 🔴 THE SAFETY ARGUMENT, AND IT IS THE POINT OF THE `null`. A plan without the
  // stamp must NOT report clean — an empty array would read as "this maintenance
  // plan is fine", which is the silent pass this repo keeps paying for.
  it('a plan with NO stamp falls through to the race validator, never to clean', () => {
    const p = maint()
    delete p.meta.source_base_weekly_km
    const v = errs(validateStoredPlan(p))
    expect(v.length, 'an unstamped maintenance plan reported CLEAN').toBeGreaterThan(0)
    // It is the RACE validator talking — loud and imperfect, the safer wrong
    // answer. Asserted as "not §75" rather than by naming one code: the first cut
    // named `INV-PLAN-PREP-TIME-STATUS-ANNOTATED`, which does not fire on this
    // fixture, so the arm failed while the behaviour was correct.
    expect(v.some(x => !x.code.startsWith('INV-MAINT-')),
      `only §75 codes came back: ${v.map(x => x.code).join(', ')}`).toBe(true)
  })

  it('a zero or negative base volume is treated as no stamp at all', () => {
    for (const bad of [0, -5]) {
      const p = maint()
      p.meta.source_base_weekly_km = bad
      const v = errs(validateStoredPlan(p))
      expect(v.some(x => !x.code.startsWith('INV-MAINT-')),
        `base ${bad} was accepted as a ceiling`).toBe(true)
    }
  })

  // The SAVE policy dispatches too — the audit and the save path must not
  // disagree about what kind of plan this is.
  it('the save policy dispatches on the same predicate', () => {
    const p = maint()
    const codes = errs(validateSavedPlan(p, mk())).map(v => v.code)
    expect(codes.every(c => c.startsWith('INV-MAINT-')), `got ${codes.join(', ')}`).toBe(true)
  })

  // 🔴 FIX THE PAIR. A meta field must be in BOTH the type and the Zod schema, or
  // a re-parse strips it. I shipped exactly that defect earlier today on
  // `plan_kind`, and `planKindsAgree.test.ts` does not cover these three.
  it('all three stamped fields are registered in the Zod schema', () => {
    const src = readFileSync(join(__dirname, 'schema.ts'), 'utf8')
    for (const f of ['source_base_weekly_km', 'source_run_days_per_week', 'source_injured']) {
      expect(src, `${f} is on PlanMeta but not in PlanMetaSchema — a re-parse would strip it`)
        .toMatch(new RegExp(`\\b${f}\\s*:`))
    }
  })

  it('the route stamps them, and from the only place all three exist', () => {
    const src = readFileSync(join(__dirname, '..', '..', 'app', 'api',
      'maintenance-block', 'route.ts'), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .split('\n').map(l => l.replace(/\/\/.*$/, '')).join('\n')
    expect(src).toMatch(/source_base_weekly_km:\s*baseWeeklyKm/)
    expect(src).toMatch(/source_run_days_per_week:\s*runDaysPerWeek/)
    expect(src).toMatch(/source_injured:/)
  })
})
