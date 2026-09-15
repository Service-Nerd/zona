import { describe, it, expect } from 'vitest'
import { validateInputFields, InputFieldError } from './inputs'
import type { GeneratorInput } from '@/types/plan'

/**
 * §55 — critical physiological inputs are REJECTED, not silently substituted.
 *
 * Case 04 (2026-04-28 review): `resting_hr: 0` got past validation, and the
 * engine still computed a Zone 2 ceiling at 140 bpm from an undisclosed
 * fallback. Two failures in one — a sentinel zero accepted as a real resting HR,
 * and a silent estimate hiding it. §55 fixes the first; §50 the second.
 *
 * Why a TEST and not an invariant: §55 runs BEFORE generation and its whole
 * point is that no plan exists. `validatePlan` only ever sees inputs that
 * already passed here, so an invariant would be structurally unable to fail.
 *
 * `beginnerInputs.test.ts` and `inputEnums.test.ts` cover the volume floor and
 * the enum set; neither touches §55's own table.
 */
const OK: GeneratorInput = {
  race_date: '2026-07-20', race_distance_km: 10, goal: 'finish',
  days_available: 4, age: 35, current_weekly_km: 25, longest_recent_run_km: 10,
} as GeneratorInput

const throwsOn = (patch: Partial<GeneratorInput>, field: string) => {
  let caught: unknown
  try { validateInputFields({ ...OK, ...patch } as GeneratorInput) } catch (e) { caught = e }
  expect(caught, `${field} ${JSON.stringify(patch)} was ACCEPTED`).toBeInstanceOf(InputFieldError)
  expect((caught as InputFieldError).field).toBe(field)
  return caught as InputFieldError
}

describe('§55 — the baseline passes (guards the guard)', () => {
  it('accepts a plausible runner', () => {
    expect(() => validateInputFields(OK)).not.toThrow()
  })
})

describe('§55 — age is required and bounded 13-90', () => {
  it('rejects below the floor and above the ceiling', () => {
    throwsOn({ age: 12 }, 'age')
    throwsOn({ age: 91 }, 'age')
  })
  it('accepts both boundary values — the range is inclusive', () => {
    expect(() => validateInputFields({ ...OK, age: 13 })).not.toThrow()
    expect(() => validateInputFields({ ...OK, age: 90 })).not.toThrow()
  })
  it('rejects a missing age rather than estimating one', () => {
    // Age is the only input HR zones cannot be derived without (§50's Tanaka
    // fallback needs it), so absence is a refusal, not a fallback.
    throwsOn({ age: undefined } as Partial<GeneratorInput>, 'age')
  })
})

describe('§55 — resting_hr and max_hr are optional, but not nonsense', () => {
  it('accepts their ABSENCE — §50 estimates and surfaces the caveat', () => {
    expect(() => validateInputFields({ ...OK, resting_hr: undefined, max_hr: undefined })).not.toThrow()
  })

  it('rejects a sentinel ZERO, which is the Case-04 defect itself', () => {
    // The distinction §55 exists for: a runner who typed 0 (or left a defaulted
    // form) must be TOLD their data was rejected. A runner who entered nothing
    // gets an estimate. Conflating them breaks both flows.
    throwsOn({ resting_hr: 0 }, 'resting_hr')
    throwsOn({ max_hr: 0 }, 'max_hr')
  })

  it('rejects out-of-range values on both fields', () => {
    throwsOn({ resting_hr: 29 }, 'resting_hr')
    throwsOn({ resting_hr: 101 }, 'resting_hr')
    throwsOn({ max_hr: 119 }, 'max_hr')
    throwsOn({ max_hr: 221 }, 'max_hr')
  })

  it('accepts the boundaries', () => {
    expect(() => validateInputFields({ ...OK, resting_hr: 30, max_hr: 120 })).not.toThrow()
    expect(() => validateInputFields({ ...OK, resting_hr: 100, max_hr: 220 })).not.toThrow()
  })
})

describe('§55 — the error carries what the API route needs for its 422', () => {
  it('names the field, the offending value and the range', () => {
    // The route returns all three to the runner. An error that only said
    // "invalid input" would satisfy the principle's letter and help nobody.
    const e = throwsOn({ resting_hr: 250 }, 'resting_hr')
    expect(e.value).toBe(250)
    expect(e.range).toEqual({ min: 30, max: 100 })
    expect(e.message.length).toBeGreaterThan(20)
    expect(e.message).not.toMatch(/resting_hr/)   // copy, not a column name (UX-BEGINNER-01)
  })
})
