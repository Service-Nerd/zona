import { describe, it, expect } from 'vitest'
import { canonicalJson, jsonEquivalent } from './canonicalJson'

/**
 * The gate for the check that reverted a production write.
 *
 * ⚠️ THE ARMS THAT MATTER ARE THE *NEGATIVE* ONES. Making a comparison
 * order-independent is one line and trivially "works"; the risk is that it becomes
 * weaker than the strict string compare it replaced and then passes on data that has
 * actually changed. Every arm below that asserts `false` is guarding that direction.
 */
describe('canonicalJson — jsonb reorders keys, so a raw stringify lies', () => {
  it('ignores top-level key order (the jsonb normalisation that caused the revert)', () => {
    // Declaration order vs jsonb order (length, then bytewise), the real case.
    const written = { race_distance_km: 42.2, goal: 'finish', age: 26, race_date: '2027-04-24' }
    const fromDb  = { age: 26, goal: 'finish', race_date: '2027-04-24', race_distance_km: 42.2 }
    expect(JSON.stringify(written) === JSON.stringify(fromDb), 'fixture no longer reproduces the defect').toBe(false)
    expect(jsonEquivalent(written, fromDb)).toBe(true)
  })

  it('ignores NESTED key order too — `benchmark` is an object', () => {
    expect(jsonEquivalent(
      { benchmark: { time: '2:09:00', type: 'race', distance_km: 21.1 } },
      { benchmark: { type: 'race', distance_km: 21.1, time: '2:09:00' } },
    )).toBe(true)
  })

  // ── NOT WEAKER THAN THE STRING COMPARE ────────────────────────────────────
  it('still catches a CHANGED value', () => {
    expect(jsonEquivalent({ a: 1, b: 2 }, { b: 2, a: 99 })).toBe(false)
  })

  it('still catches a MISSING key', () => {
    expect(jsonEquivalent({ a: 1, b: 2 }, { a: 1 })).toBe(false)
  })

  it('still catches an EXTRA key', () => {
    expect(jsonEquivalent({ a: 1 }, { a: 1, b: 2 })).toBe(false)
  })

  it('still catches a changed TYPE — "5" is not 5', () => {
    expect(jsonEquivalent({ current_weekly_km: 5 }, { current_weekly_km: '5' })).toBe(false)
  })

  it('still catches null vs absent, which a stamp builder can confuse', () => {
    expect(jsonEquivalent({ a: null }, {})).toBe(false)
  })

  /**
   * ⚠️ ARRAY ORDER IS DATA AND MUST NOT BE SORTED. `days_cannot_train` and
   * `injury_history` are the live cases. If the canonicaliser sorted arrays, a real
   * change to a runner's stated inputs would read as identical.
   */
  it('does NOT ignore array order', () => {
    expect(jsonEquivalent(
      { days_cannot_train: ['monday', 'wednesday'] },
      { days_cannot_train: ['wednesday', 'monday'] },
    )).toBe(false)
  })

  it('canonicalJson is deterministic for the same document', () => {
    const a = canonicalJson({ z: 1, a: { y: 2, b: 3 } })
    const b = canonicalJson({ a: { b: 3, y: 2 }, z: 1 })
    expect(a).toBe(b)
    expect(a).toBe('{"a":{"b":3,"y":2},"z":1}')
  })
})
