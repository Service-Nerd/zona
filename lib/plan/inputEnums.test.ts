// §55 — a present-but-unrecognised enum value must be REJECTED, not ignored.
//
// §55's principle is "reject nonsense values", and the function validated
// numeric ranges only. Two distinct failures came from that:
//
//   1. LOUD — `fitness_level: 'advanced'` (not a value; the union is
//      beginner/intermediate/experienced) indexes a config table that has no
//      such key, and the engine dies inside `buildFallbackPace` with
//      "Cannot read properties of undefined (reading 'minPerKmQuality')". The
//      API returns a 500 naming no field. That is verbatim the failure the
//      volume-field validation was added to stop, one type away.
//
//   2. SILENT, and worse — a bad `recent_quality_training` or
//      `hard_session_relationship` matches nothing, falls to a default, and the
//      runner gets a real plan built from an input the engine discarded. Found
//      because two measurement scripts had been passing 'occasionally' and
//      'regularly' (neither exists) and every plan generated cleanly.

import { describe, it, expect } from 'vitest'
import { validateInputFields, InputEnumError } from './inputs'
import type { GeneratorInput } from '@/types/plan'

const base = {
  athlete_name: 'A', age: 35, race_name: 'T', primary_metric: 'distance',
  race_distance_km: 10, race_date: '2026-08-17', goal: 'finish',
  current_weekly_km: 30, longest_recent_run_km: 12,
  days_available: 4, days_cannot_train: [],
} as unknown as GeneratorInput

const withField = (field: string, value: unknown) =>
  ({ ...(base as object), [field]: value }) as unknown as GeneratorInput

describe('enum inputs are validated', () => {
  it('accepts the baseline (guards the guard)', () => {
    // If the baseline itself threw, every rejection below would pass for the
    // wrong reason.
    expect(() => validateInputFields(base)).not.toThrow()
  })

  it.each([
    ['fitness_level', 'advanced'],            // the one that crashed the engine
    ['recent_quality_training', 'occasionally'], // the one that failed silently
    ['hard_session_relationship', 'regularly'],  // ditto
    ['goal', 'pb'],
    ['terrain', 'sand'],
    ['preferred_long_run_day', 'wed'],
    ['foundation_decision', 'maybe'],
  ])('rejects %s=%s', (field, value) => {
    expect(() => validateInputFields(withField(field, value))).toThrow(InputEnumError)
  })

  // UX-BEGINNER-01 — the CONTRACT changed on 2026-09-11 and this test with it.
  // The structured data must still carry the detail (the client highlights the
  // input, the logs name the field); the PROSE must not, because a runner read
  // "longest_recent_run_km=0" and that is what started this.
  it('carries the detail structurally but never leaks it into the prose', () => {
    try {
      validateInputFields(withField('fitness_level', 'advanced'))
      throw new Error('should have thrown')
    } catch (e) {
      expect(e).toBeInstanceOf(InputEnumError)
      const err = e as InputEnumError
      // Structured: intact, for the client and the logs.
      expect(err.field).toBe('fitness_level')
      expect(err.allowed).toContain('experienced')
      // Prose: no field name, no internal value, no allowed set.
      expect(err.message).not.toContain('fitness_level')
      expect(err.message).not.toContain('advanced')
      expect(err.message).not.toContain('experienced')
    }
  })

  it.each([
    ['fitness_level', 'experienced'],
    ['recent_quality_training', 'occasional'],
    ['hard_session_relationship', 'overdo'],
    ['terrain', 'trail'],
  ])('accepts the real value %s=%s', (field, value) => {
    expect(() => validateInputFields(withField(field, value))).not.toThrow()
  })

  // ABSENT is not an error. The engine has documented behaviour for "not
  // supplied" — §79 runs its own assessment when fitness_level is absent — so
  // rejecting undefined would break every plan that relies on it.
  it.each([undefined, null, ''])('treats %s as absent, not invalid', value => {
    expect(() => validateInputFields(withField('fitness_level', value))).not.toThrow()
  })
})
