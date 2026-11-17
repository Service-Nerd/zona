// MAXHR-AGE-ABSENT-01 — the gate for §50 Amendment (Coaching Board 2026-11-17).
//
// 🔴 WHY EVERY CASE IS CONSTRUCTED HERE RATHER THAN DRAWN FROM A CORPUS: measured,
// **0 of 41,472 `cohortGrid` rows carry no age**, and `targetedGrid` and every fixture set one
// too. So all eight coaching gates are structurally blind to the runner this item is about —
// `COHORT-GRID-UNSET-LEVEL-01`'s class, stated out loud. The first arm asserts that blindness
// so the claim is measured rather than assumed.
//
// THE DEFECT: `GeneratePlanScreen.tsx:1024` satisfied a REQUIRED `input.age` with a hardcoded
// `: 30` for any runner who skipped the optional birth-year step. §50's whole asymmetry is
// relative to the Tanaka estimate and §3's masters cadence is `age >= 45`, so one literal moved
// the easy ceiling AND the deload frequency. 16 of 56 live runners have no age.

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { generateRulePlan } from './ruleEngine'
import { validatePlan } from './invariants'
import { buildHRZonesWithFallback } from './hrZones'
import { mastersCadenceApplies } from './mastersCadence'
import { computeZones } from './zones'
import { tanakaMaxHR } from './maxHrGuard'
import { cohortGrid } from './cohortGrid'
import { GENERATION_CONFIG } from './generationConfig'
import type { GeneratorInput, Session } from '@/types/plan'

const PLAN_START = '2026-11-17'
const BASE = {
  athlete_name: 'A', race_name: 'T', primary_metric: 'distance',
  race_distance_km: 10, race_date: '2027-03-28', goal: 'finish',
  current_weekly_km: 30, longest_recent_run_km: 10,
  user_declared_level: 'intermediate', recent_quality_training: 'occasional',
  hard_session_relationship: 'neutral', injury_history: [], days_available: 4,
  training_age: '1-3y', resting_hr: 50,
} as unknown as GeneratorInput

const gen = (extra: Partial<GeneratorInput>) =>
  generateRulePlan({ ...BASE, ...extra } as GeneratorInput, 'trial', PLAN_START, undefined, PLAN_START)
const sessionsOf = (p: ReturnType<typeof gen>) =>
  p.weeks.flatMap(w => Object.values(w.sessions)).filter(Boolean) as Session[]

describe('MAXHR-AGE-ABSENT-01 — the engine does not invent an age', () => {
  it('NO corpus can build an ageless runner, so these cases must be constructed', () => {
    const ageless = cohortGrid().filter(g => typeof (g as { age?: number }).age !== 'number')
    expect(ageless.length, 'cohortGrid gained an ageless row — the gates can see this now and this file should say so').toBe(0)
  })

  it('an ageless plan GENERATES — §50: the engine never refuses for missing HR inputs', () => {
    for (const extra of [{}, { max_hr: 185 }, { resting_hr: undefined }] as Partial<GeneratorInput>[]) {
      const p = gen({ ...extra, age: undefined })
      expect(p.weeks.length).toBeGreaterThan(5)
    }
  })

  it('records NO age it was not given, and says what it could not do', () => {
    const p = gen({ age: undefined })
    expect(p.meta.age, 'the plan invented an age').toBeUndefined()
    expect(p.meta.hr_assumption_note, '§50 closes the SILENCE hole too').toBeTruthy()
    expect(validatePlan(p, { ...BASE, age: undefined } as GeneratorInput).filter(v => v.severity === 'error')).toEqual([])
  })

  it('CAN FIRE: a plan that records an age its input never carried', () => {
    // FALSIFICATION. The invariant's whole job: an age of 30 is plausible on its own and says
    // nothing — the violation is the DISAGREEMENT between meta and input.
    const p = gen({ age: undefined })
    const forged = JSON.parse(JSON.stringify(p)) as typeof p
    ;(forged.meta as unknown as Record<string, unknown>).age = 30
    const v = validatePlan(forged, { ...BASE, age: undefined } as GeneratorInput)
      .filter(x => x.code === 'INV-PLAN-NO-INVENTED-AGE')
    expect(v.length).toBeGreaterThan(0)
    expect(v[0].severity).toBe('error')
    expect(v[0].message).toMatch(/records age 30 but its input carried none/)
  })

  it('CAN FIRE: meta and input disagreeing about the age — the `?? 40` defect', () => {
    // 🔑 THE ARM THAT MADE THIS INVARIANT WAKEABLE AT ALL. Its absent-age arms cannot be reached
    // from the liveness harness — a mutation gets the PLAN and every corpus input has an age — so
    // without this the invariant would have landed unproven and been baselined with a reason.
    // It is also the stronger check: `storedPlanInput`'s `age: m.age ?? 40` made meta and input
    // DISAGREE (Tanaka 187 vs 177) rather than one be absent, and an absent-only check was blind
    // to the second of the four literals.
    const p = gen({ age: 40 })
    const drifted = JSON.parse(JSON.stringify(p)) as typeof p
    ;(drifted.meta as unknown as Record<string, unknown>).age = 99
    const v = validatePlan(drifted, { ...BASE, age: 40 } as GeneratorInput)
      .filter(x => x.code === 'INV-PLAN-NO-INVENTED-AGE')
    expect(v.length).toBeGreaterThan(0)
    expect(v[0].message).toMatch(/records age 99 but its input carried 40/)
    // And it does NOT fire when they agree, or the arm would fire on every plan.
    expect(validatePlan(p, { ...BASE, age: 40 } as GeneratorInput)
      .filter(x => x.code === 'INV-PLAN-NO-INVENTED-AGE')).toEqual([])
  })

  it('CAN FIRE: an ageless plan that goes silent about it', () => {
    const p = gen({ age: undefined })
    const silent = JSON.parse(JSON.stringify(p)) as typeof p
    delete (silent.meta as unknown as Record<string, unknown>).hr_assumption_note
    const v = validatePlan(silent, { ...BASE, age: undefined } as GeneratorInput)
      .filter(x => x.code === 'INV-PLAN-NO-INVENTED-AGE')
    expect(v.length).toBeGreaterThan(0)
  })

  it('§50 CASE 1 — a max with no age is used AS GIVEN, never floored against an invented estimate', () => {
    // 🔴 THE INVERSION THE OLD CODE PRODUCED: a stored 176 was floored UP to 187 "because the
    // runner is 30". §50's asymmetry rests on a recorded max being a LOWER bound.
    const hr = buildHRZonesWithFallback({ ...BASE, age: undefined, max_hr: 176 } as GeneratorInput)
    expect(hr.method).toBe('max_unguarded_no_age')
    expect(hr.derived_max, 'the runner’s own max, not Tanaka(30) = 187').toBe(176)
    expect(hr.assumption_note).toMatch(/cannot sanity-check/)
    // And with an age it is still floored, so the guard is not disabled for everyone.
    const guarded = buildHRZonesWithFallback({ ...BASE, age: 30, max_hr: 176, max_hr_source: 'observed' } as GeneratorInput)
    expect(guarded.method).toBe('age_estimate_max_floor')
    expect(guarded.derived_max).toBe(tanakaMaxHR(30))
  })

  it('§50 CASE 2 — no age and no max means NO NUMBER, and no zone label either (§14 Am. 2)', () => {
    const hr = buildHRZonesWithFallback({ ...BASE, age: undefined, resting_hr: undefined } as GeneratorInput)
    expect(hr.method).toBe('no_hr_no_age')
    expect(hr.derived_max, 'absent, never zero — the escape hatch the checker reads').toBeNull()
    expect(hr.zones.zone2Ceiling).toBeUndefined()
    expect(hr.zones.easyHR).toBeUndefined()

    const p = gen({ age: undefined, resting_hr: undefined, max_hr: undefined })
    const ss = sessionsOf(p)
    expect(ss.length).toBeGreaterThan(20)
    expect(ss.filter(s => typeof s.hr_target === 'string'), 'a target with nothing behind it').toEqual([])
    // ⚠️ "A zone without an hr_target is a label about nothing" (§14 Am. 2) — EXCEPT §40b's
    // effort-governed rows, which declare their zones on the row and prescribe an RPE instead.
    // That exception is named, not swept: the assertion is that nothing ELSE claims a zone.
    const zoneClaims = ss.filter(s => typeof s.zone === 'string')
    for (const s of zoneClaims) {
      expect(s.rpe_target, `${s.label} claims zone ${s.zone} with no target and no RPE`).toBeGreaterThan(0)
      expect(String(s.label)).toMatch(/hill|climb|hike/i)
    }
  })

  it('§3 — an absent age takes the MASTERS cadence, the cautious side (Willy, binding)', () => {
    expect(mastersCadenceApplies(undefined), 'ignorance resolved to the LESS protective cadence').toBe(true)
    expect(mastersCadenceApplies(null)).toBe(true)
    expect(mastersCadenceApplies(GENERATION_CONFIG.MASTERS_AGE_THRESHOLD)).toBe(true)
    expect(mastersCadenceApplies(GENERATION_CONFIG.MASTERS_AGE_THRESHOLD - 1)).toBe(false)
    expect(mastersCadenceApplies(30)).toBe(false)
    // ⚠️ `undefined >= 45` is FALSE in JavaScript, so the old code did not choose the standard
    // cadence — it fell into it. This asserts a choice was made.
    expect(((undefined as unknown as number) >= GENERATION_CONFIG.MASTERS_AGE_THRESHOLD)).toBe(false)
  })

  it('the cost the fabrication carried, asserted so the number cannot quietly change', () => {
    // A 60-year-old priced at 30 was told easy <= 150 bpm when 150 is ABOVE the top of their own
    // Zone 3 — §12 breached in fact, and §1's grey zone arriving through the easy cap.
    const assumed = computeZones(tanakaMaxHR(30))
    const real60 = computeZones(tanakaMaxHR(60))
    expect(assumed.zone2Ceiling).toBe(150)
    expect(real60.zone2Ceiling).toBe(133)
    const own3Top = Number(real60.qualityHR!.match(/–(\d+)/)![1])
    expect(assumed.zone2Ceiling!, 'the invented easy cap sat above their own Zone 3').toBeGreaterThan(own3Top)
  })

  it('no literal age survives in the four producers that had one', () => {
    // 🔴 FOUR DISAGREEING LITERALS EXISTED AND ONLY ONE WAS EVER SEEN BY A RUNNER:
    //   30 — `GeneratePlanScreen` (generation)        40 — `storedPlanInput` (re-validation)
    //   35 — the birth-year wheel (ON SCREEN)          0 — `planShapeInvariants` (the checker)
    // So the screen showed 35, the plan was built on 30, and re-checking it used 40.
    //
    // ⚠️ A SOURCE ARM, AND IT IS HERE BECAUSE THE BEHAVIOURAL ARMS CANNOT SEE A REPLACEMENT
    // LITERAL. Re-adding `: 30` to the wizard changes no engine behaviour that the other arms
    // reach — `GeneratePlanScreen` is a component and the suite is `environment: 'node'`, so
    // nothing renders it. Without this, the defect could walk straight back in.
    // ⚠️ COMMENTS STRIPPED, AND IT CAUGHT ME ON THE FIRST RUN. The comment I wrote recording
    // the deleted `(plan.meta.age ?? 0)` matched the pattern looking for it — which is
    // `HOOK-RGBA-COMMENTS-01` exactly, a class this repo has recorded twice: searching for the
    // hardcoded value finds the comment ABOUT the hardcoded value. 🔻 Line comments only; a
    // literal inside a block comment or a template would still match, which is a declared
    // limit rather than a missed case (the repo's own `strip-comments.py` is a shell-hook tool
    // and lexing TS properly needs a parser, not a heuristic).
    const code = (src: string) => src.split('\n').filter(l => !l.trimStart().startsWith('//')).join('\n')
    const wizard = code(readFileSync(join(process.cwd(), 'app', 'dashboard', 'GeneratePlanScreen.tsx'), 'utf8'))
    expect(wizard, 'the wizard is fabricating an age again').toMatch(/hrGuardableAge\(birthYear\)/)
    expect(/birthYear !== null \?[^\n]*:\s*\d+/.test(wizard), 'a numeric age fallback came back').toBe(false)
    const stored = code(readFileSync(join(process.cwd(), 'lib', 'plan', 'storedPlanInput.ts'), 'utf8'))
    expect(/age:\s*m\.age\s*\?\?\s*\d+/.test(stored), 'storedPlanInput is inventing an age again').toBe(false)
    const shape = code(readFileSync(join(process.cwd(), 'lib', 'plan', 'planShapeInvariants.ts'), 'utf8'))
    expect(/plan\.meta\.age\s*\?\?\s*\d+/.test(shape), 'the checker is defaulting an age again').toBe(false)
    // The wheel's 35 survives as a NAMED config constant, and it is a scroll position, not an age.
    expect(GENERATION_CONFIG.WIZARD_BIRTH_YEAR_WHEEL_ANCHOR_AGE).toBe(35)
    expect(wizard).toMatch(/WIZARD_BIRTH_YEAR_WHEEL_ANCHOR_AGE/)
  })
})
