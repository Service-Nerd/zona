import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { resolveHrSave, hrGuardableAge } from './hrSaveResolution'
import { tanakaMaxHR } from './maxHrGuard'
import { GENERATION_CONFIG } from './generationConfig'

/**
 * PLAN-META-HR-DIVERGENCE-01 — the form's zones and the plan's zones are ONE computation.
 *
 * 🔴 The two defects this is the gate for, both silent:
 *   1. `HRZonesSection` resolved §50's guard to pick the zone table it SHOWS — including a
 *      "floored" note — then handed the caller the RAW typed max, which `applyHrToPlan` used to
 *      rewrite every session's `hr_target`. The form showed guarded zones and saved unguarded.
 *   2. `handleHrSave` stamped `max_hr_source: 'user_confirmed'` UNCONDITIONALLY, so editing only
 *      the RESTING HR promoted a device-observed FLOOR to a confirmed max — the one thing §50's
 *      asymmetry exists to prevent.
 *
 * 📐 Live 2026-11-08: 53 `user_settings` rows, 37 with a max, **24 `observed`**, **3 below their
 * Tanaka estimate** (the live floor case), 0 above the 15% tolerance, 5 with no `birth_year`.
 *
 * ⚠️ `tsc` could not have caught (1): a 2-argument callback is assignable to a 3-argument prop.
 */

const AGE = 40
const EST = tanakaMaxHR(AGE)           // 180
const TOL = GENERATION_CONFIG.MAX_HR_PLAUSIBILITY_DEVIATION_PCT / 100

describe('resolveHrSave — provenance', () => {
  it('a typed-over max is a confirmation, and §50 trusts it below the estimate', () => {
    const r = resolveHrSave({ typedMax: 168, storedMax: 190, storedSource: 'observed', age: AGE })
    expect(r.maxSource).toBe('user_confirmed')
    // Genuine low-max athletes: a confirmed max below Tanaka is trusted, by §50's asymmetry.
    expect(r.guardedMax).toBe(168)
    expect(r.floored).toBe(false)
  })

  it('🔴 an UNTOUCHED observed max is NOT promoted to a confirmation', () => {
    // THE DEFECT. Saving with the max unchanged used to stamp 'user_confirmed' and bake the
    // device floor into every session band. The max is the same number the form was handed.
    const r = resolveHrSave({ typedMax: 168, storedMax: 168, storedSource: 'observed', age: AGE })
    expect(r.maxSource).toBe('observed')
    // And §50 then does its job: an observed value below the estimate is a floor, so the
    // plan is zoned from the estimate instead of being dragged down to 168.
    expect(r.guardedMax).toBe(EST)
    expect(r.floored).toBe(true)
  })

  it('a stored max with NO provenance defaults to observed, the safe direction', () => {
    // An unattributed max is a floor, not a confirmation. Defaulting the other way would
    // trust every legacy row below the estimate — absence written as a confirmation.
    const r = resolveHrSave({ typedMax: 168, storedMax: 168, storedSource: undefined, age: AGE })
    expect(r.maxSource).toBe('observed')
    expect(r.guardedMax).toBe(EST)
  })

  it('a runner who has never set a max is confirming the one they just typed', () => {
    const r = resolveHrSave({ typedMax: 168, storedMax: null, storedSource: undefined, age: AGE })
    expect(r.maxSource).toBe('user_confirmed')
    expect(r.guardedMax).toBe(168)
  })
})

describe('resolveHrSave — the number the plan is built from', () => {
  it('🔴 an implausibly high typed max does not reach the plan, confirmed or not', () => {
    // The upper bound applies to a user_confirmed value too: above the tolerance it is a
    // sensor artefact, not an effort. Before this, `applyHrToPlan` got the raw number while
    // `effectiveMaxHR` guarded it for display — so the header and the band disagreed.
    const tooHigh = Math.ceil(EST * (1 + TOL)) + 5
    const r = resolveHrSave({ typedMax: tooHigh, storedMax: 180, storedSource: 'user_confirmed', age: AGE })
    expect(r.maxSource).toBe('user_confirmed')
    expect(r.guardedMax).toBe(EST)
    expect(r.floored).toBe(true)
  })

  it('a plausible typed max passes through untouched', () => {
    const r = resolveHrSave({ typedMax: 192, storedMax: 180, storedSource: 'observed', age: AGE })
    expect(r.guardedMax).toBe(192)
    expect(r.floored).toBe(false)
  })

  it('no guardable age → the typed max stands, and nothing is claimed to be floored', () => {
    // 5 of 53 live rows have no `birth_year`. Tanaka is meaningless without one, so the guard
    // is not applied rather than applied to a fabricated age.
    const r = resolveHrSave({ typedMax: 240, storedMax: null, storedSource: undefined, age: null })
    expect(r.guardedMax).toBe(240)
    expect(r.floored).toBe(false)
  })
})

describe('hrGuardableAge — one owner of "is there an age to guard against"', () => {
  const NOW = new Date('2026-11-08T12:00:00Z')
  it('a plausible birth year yields an age', () => {
    expect(hrGuardableAge(1986, NOW)).toBe(40)
  })
  it('null, zero and an out-of-window year yield null, not a fabricated age', () => {
    expect(hrGuardableAge(null, NOW)).toBeNull()
    expect(hrGuardableAge(undefined, NOW)).toBeNull()
    expect(hrGuardableAge(0, NOW)).toBeNull()        // falsy year is absence, not year 0
    expect(hrGuardableAge(2020, NOW)).toBeNull()     // age 6
    expect(hrGuardableAge(1900, NOW)).toBeNull()     // age 126
  })
  it('the window boundaries are inclusive', () => {
    expect(hrGuardableAge(2016, NOW)).toBe(10)
    expect(hrGuardableAge(1926, NOW)).toBe(100)
  })
})

describe('both producers call the owner — the guarantee is structural, not a convention', () => {
  const read = (p: string) => readFileSync(join(process.cwd(), p), 'utf8')
  /** Comments stripped: this repo has recorded a check matching its own explanatory comment
   *  nine times, and two of those were in the gate written to prevent it. */
  const code = (src: string) =>
    src.replace(/\/\*[\s\S]*?\*\//g, '').split('\n').filter(l => !l.trim().startsWith('//')).join('\n')

  it('the form and the handler both call resolveHrSave', () => {
    // ⚠️ A SOURCE ASSERTION, AND IT IS THE WEAKEST ARM HERE — `vitest.config.ts` is
    // `environment: 'node'` with no jsdom, so a React handler cannot be invoked. The arms
    // above are behavioural on the owner; this one only proves the owner is REACHED. It is
    // here because the defect was precisely that one side did not reach it.
    for (const f of ['components/dashboard/HRZonesSection.tsx', 'app/dashboard/DashboardClient.tsx']) {
      expect(code(read(f)), `${f} must resolve the save through the owner`).toContain('resolveHrSave(')
    }
  })

  it('the handler no longer hardcodes the provenance it writes', () => {
    const src = code(read('app/dashboard/DashboardClient.tsx'))
    // The unconditional stamp. `effectiveSource` comes from the owner; a literal on the
    // user_settings write is the defect returning.
    expect(src).not.toContain("max_hr_source: 'user_confirmed', updated_at")
    expect(src).toContain('max_hr_source: effectiveSource')
  })

  it('applyHrToPlan is handed the guarded max, not the raw one', () => {
    const src = code(read('app/dashboard/DashboardClient.tsx'))
    expect(src).not.toMatch(/applyHrToPlan\(plan as never, rhr, mhr\)/)
    expect(src).toMatch(/applyHrToPlan\(plan as never, rhr, guardedMax\)/)
  })
})
