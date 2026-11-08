import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { resolveHrSave, hrGuardableAge } from './hrSaveResolution'
import { tanakaMaxHR } from './maxHrGuard'
import { GENERATION_CONFIG } from './generationConfig'

/**
 * PLAN-META-HR-DIVERGENCE-01 — §50's plausibility ceiling reaches the PLAN, not only the screen.
 *
 * 🔴 THE DEFECT: `handleHrSave` passed the RAW typed max to `applyHrToPlan`, which rewrote every
 * session's `hr_target` and stamped `meta.hr_derived_max`, while `effectiveMaxHR` guarded the same
 * value for display. So an implausibly high max was rejected on the screen and baked into the plan.
 *
 * 🔴 AND WHAT THIS DELIBERATELY IS NOT. My first cut also made the provenance conditional on the
 * max having been edited. `/code-review` found that breaks the form's founder-approved affordance
 * — *"If {typed} really is your max, tap Save to confirm it"* — and `git log -S` settled it: that
 * copy and the unconditional `user_confirmed` stamp landed in the SAME commit (`c44e0e53`,
 * HR-MAX-01, 2026-08-31). **A save IS a confirmation. The display and the save differ on purpose
 * and the copy explains the difference.** Whether an UNEDITED save should also confirm is a §50
 * doctrine question → `HR-SAVE-UNEDITED-CONFIRMS-01` (Coaching Board).
 *
 * 📐 Live 2026-11-08: 53 `user_settings` rows, 37 with a max, 24 `observed`, 3 below their Tanaka
 * estimate, **0 above the 15% tolerance** — so this defect is latent, not realised. Said plainly.
 */

const AGE = 40
const EST = tanakaMaxHR(AGE)           // 180
const TOL = GENERATION_CONFIG.MAX_HR_PLAUSIBILITY_DEVIATION_PCT / 100

describe('resolveHrSave — the number the plan is built from', () => {
  it('🔴 an implausibly high max does not reach the plan, even confirmed', () => {
    // §50: above the tolerance a rate is a sensor artefact, not an effort. This is the arm the
    // whole item is for — the display already rejected it and the plan did not.
    const tooHigh = Math.ceil(EST * (1 + TOL)) + 5
    const r = resolveHrSave({ typedMax: tooHigh, age: AGE })
    expect(r.guardedMax).toBe(EST)
    expect(r.floored).toBe(true)
  })

  it('a below-estimate max is TRUSTED, because a save is a confirmation', () => {
    // ⚠️ The arm that pins the behaviour code review restored. Flooring this would re-break the
    // "tap Save to confirm it" affordance and leave a genuine low-max athlete no route at all.
    const r = resolveHrSave({ typedMax: 150, age: AGE })
    expect(r.guardedMax).toBe(150)
    expect(r.floored).toBe(false)
    expect(r.maxSource).toBe('user_confirmed')
  })

  it('a plausible max passes through untouched', () => {
    const r = resolveHrSave({ typedMax: 192, age: AGE })
    expect(r.guardedMax).toBe(192)
    expect(r.floored).toBe(false)
  })

  it('no guardable age → the typed max stands, and nothing is claimed to be floored', () => {
    // 5 of 53 live rows have no `birth_year`. Tanaka is meaningless without one, so the guard is
    // not applied rather than applied to a fabricated age.
    const r = resolveHrSave({ typedMax: 240, age: null })
    expect(r.guardedMax).toBe(240)
    expect(r.floored).toBe(false)
  })

  it('the provenance is unconditional, and that is asserted rather than assumed', () => {
    for (const typedMax of [150, 180, 192, 240]) {
      expect(resolveHrSave({ typedMax, age: AGE }).maxSource,
        'a save is a confirmation (§50 / HR-MAX-01); the form\'s copy promises it').toBe('user_confirmed')
    }
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
    expect(hrGuardableAge(0, NOW)).toBeNull()        // a falsy year is absence, not year 0
    expect(hrGuardableAge(2020, NOW)).toBeNull()     // age 6
    expect(hrGuardableAge(1900, NOW)).toBeNull()     // age 126
  })
  it('the window boundaries are inclusive', () => {
    expect(hrGuardableAge(2016, NOW)).toBe(10)
    expect(hrGuardableAge(1926, NOW)).toBe(100)
  })
})

describe('the handler reaches the owner — the guarantee is structural', () => {
  const read = (p: string) => readFileSync(join(process.cwd(), p), 'utf8')
  /** Comments stripped: this repo has recorded a check matching its own explanatory comment
   *  nine times, twice inside the gate written to prevent it. */
  const code = (src: string) =>
    src.replace(/\/\*[\s\S]*?\*\//g, '').split('\n').filter(l => !l.trim().startsWith('//')).join('\n')

  it('applyHrToPlan is handed the guarded max, not the raw one', () => {
    // ⚠️ A SOURCE ASSERTION, AND THE WEAKEST ARM HERE — `vitest.config.ts` is `environment:
    // 'node'` with no jsdom, so a React handler cannot be invoked. The arms above are behavioural
    // on the owner; this one only proves the owner is REACHED, which is what was missing.
    const src = code(read('app/dashboard/DashboardClient.tsx'))
    expect(src).not.toMatch(/applyHrToPlan\(plan as never, rhr, mhr\)/)
    expect(src).toMatch(/applyHrToPlan\(plan as never, rhr, guardedMax\)/)
    expect(src).toContain('resolveHrSave(')
  })

  it('🔴 the FORM keeps its own display rule, and must not be routed through the save owner', () => {
    // The display floors an unedited device max; the save trusts it. Collapsing the two is
    // exactly what code review reversed, so the divergence is pinned on purpose.
    const src = code(read('components/dashboard/HRZonesSection.tsx'))
    expect(src, 'the form must resolve DISPLAY through resolveMaxHr with its own displaySource')
      .toMatch(/resolveMaxHr\(mhrNum, age, displaySource\)/)
    expect(src, 'routing the form through resolveHrSave re-breaks the "tap Save to confirm it" affordance')
      .not.toContain('resolveHrSave(')
  })
})
