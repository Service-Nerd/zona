import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  generatorInputFields, assertParsedShape, inputCoverage, MIN_DISTINCT_VALUES,
} from './sweepInputCoverage'

/**
 * Proposal #4 of the 2026-09-03 test-coverage set — fail the build when a
 * `GeneratorInput` field is never varied by the property sweep.
 *
 * The class this defends against has now bitten four times, and every instance
 * looked identical from the outside: the sweep reports "N plans, 0 violations"
 * while an entire branch is unreachable. `blocked_days` (misnamed), then
 * `fitness_level` (never absent, so §79's assessment path never ran), then
 * `max_weekday_mins` (45/60/90 while both real users chose 30), then
 * `target_time` (one value for every distance, giving a 100K runner a 27 sec/km
 * goal pace and voiding every goal-paced measurement above 10K).
 *
 * On its first run the gate found `weeks_at_current_volume` — declared since
 * M-02 and never once set by the sweep — which reaches §29's fresh-return path
 * and produced 1,426 real violations that had been invisible.
 */

const TYPES_SRC = readFileSync(join(process.cwd(), 'types/plan.ts'), 'utf8')

describe('generatorInputFields — parses the declaration, never a hand list', () => {
  it('reads the real interface and finds the fields the sweep must cover', () => {
    const fields = generatorInputFields(TYPES_SRC)
    // Spot-check the required ones plus every field that has historically been
    // the silent gap. If the parser breaks, these go missing and the gate would
    // otherwise pass vacuously.
    for (const f of ['race_date', 'race_distance_km', 'goal', 'days_available', 'age',
                     'fitness_level', 'max_weekday_mins', 'target_time',
                     'weeks_at_current_volume', 'foundation_decision', 'days_cannot_train']) {
      expect(fields, `${f} not parsed`).toContain(f)
    }
    expect(fields.length).toBeGreaterThanOrEqual(25)
    expect(new Set(fields).size, 'duplicate field names parsed').toBe(fields.length)
  })

  it('does not mistake a nested object field for a top-level key', () => {
    // `benchmark` is `{ type; distance_km; time }`. Its members are indented
    // deeper and must not be read as GeneratorInput keys.
    const fields = generatorInputFields(TYPES_SRC)
    expect(fields).toContain('benchmark')
    expect(fields).not.toContain('time')
  })

  it('returns [] when the interface is absent, and assertParsedShape then throws', () => {
    expect(generatorInputFields('export interface Something {\n  a: string\n}')).toEqual([])
    // The critical property: a broken parser must FAIL, not silently pass a gate
    // over zero fields. That is the same vacuous-check failure the gate exists for.
    expect(() => assertParsedShape([])).toThrow(/Parsed only 0/)
    expect(() => assertParsedShape(['a', 'b'])).toThrow(/restructured/)
  })
})

describe('inputCoverage', () => {
  const fields = ['a', 'b', 'c']

  it('flags a field held constant across every input', () => {
    const r = inputCoverage([{ a: 1, b: 1 }, { a: 2, b: 1 }], fields, {})
    expect(r.covered).toContain('a')
    expect(r.uncovered.map(u => u.field)).toEqual(expect.arrayContaining(['b', 'c']))
    expect(r.uncovered.find(u => u.field === 'b')!.sample).toBe('always 1')
    expect(r.uncovered.find(u => u.field === 'c')!.sample).toBe('never set')
  })

  it('counts ABSENCE as a distinct value — the §79 gap in one assertion', () => {
    // `fitness_level` present with all three levels but NEVER absent was the
    // real §79 defect: the engine's own assessment path was unreachable while
    // the field looked thoroughly varied.
    const alwaysPresent = inputCoverage(
      [{ a: 'beginner' }, { a: 'intermediate' }, { a: 'experienced' }], ['a'], {})
    expect(alwaysPresent.covered).toContain('a')   // three values IS varied

    const oneValueSometimesAbsent = inputCoverage([{ a: 'beginner' }, {}], ['a'], {})
    expect(oneValueSometimesAbsent.covered).toContain('a')  // absent counts too
  })

  it('treats an explicit undefined and a missing key as the same value', () => {
    const r = inputCoverage([{ a: undefined }, {}], ['a'], {})
    expect(r.uncovered.map(u => u.field)).toContain('a')
  })

  it('distinguishes structured values, not just primitives', () => {
    const r = inputCoverage(
      [{ a: ['knee'] }, { a: ['achilles'] }], ['a'], {})
    expect(r.covered).toContain('a')
  })

  it('honours exemptions and reports ones that have gone stale', () => {
    const r = inputCoverage([{ a: 1 }], ['a', 'b'], { a: 'reason', gone: 'reason' })
    expect(r.uncovered.map(u => u.field)).not.toContain('a')
    expect(r.exempt).toEqual(['a'])
    // An exemption for a field that no longer exists is the exemption list
    // rotting — it must be surfaced, not ignored.
    expect(r.staleExemptions).toEqual(['gone'])
  })

  it('MIN_DISTINCT_VALUES is 2 — one value is not variation', () => {
    expect(MIN_DISTINCT_VALUES).toBe(2)
  })
})
