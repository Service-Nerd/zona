import { describe, it, expect } from 'vitest'
import { raceLabelFor, type RaceThresholdKey } from './raceLabel'
import { GENERATION_CONFIG } from './generationConfig'

// REFUSAL-COPY-02 had no direct test. The module exists to stop a CONFIG KEY
// being shouted at a runner who has just been refused a plan ("2 days/week is
// not enough for a MARATHON"), and the way that regresses is not a wrong
// label — it is a NEW threshold key landing in config with no label beside it,
// so `raceLabelFor` returns undefined and the refusal reads "for a undefined".
//
// ⚠️ THE KEY LIST IS READ FROM THE CONFIG, NEVER TYPED OUT HERE. A checker that
// iterates the same hand-written array it protects is blind to that array —
// this repo's own recorded lesson. `PREP_TIME_THRESHOLDS` is the producer, so
// adding a distance there is what must make this test go red.

const KEYS = Object.keys(GENERATION_CONFIG.PREP_TIME_THRESHOLDS) as RaceThresholdKey[]

describe('raceLabelFor', () => {
  it('1. covers every race key the config declares — this is the regression', () => {
    expect(KEYS.length).toBeGreaterThan(0)
    for (const key of KEYS) {
      const label = raceLabelFor(key)
      expect(label, `no runner-facing label for config key '${key}'`).toBeTruthy()
      expect(typeof label).toBe('string')
    }
  })

  it('2. never returns a SHOUTED identifier — the defect it was written for', () => {
    for (const key of KEYS) {
      const label = raceLabelFor(key)
      // '5K' and '50K ultra' legitimately carry the key; 'MARATHON' must not.
      if (/^[A-Z]{3,}$/.test(key)) expect(label).not.toBe(key)
      expect(label).not.toMatch(/[A-Z]{4,}/)
    }
  })

  it('3. is article-ready and lower case, because every caller reads "for a {label}"', () => {
    expect(raceLabelFor('HM')).toBe('half marathon')
    expect(raceLabelFor('MARATHON')).toBe('marathon')
    expect(`not enough for a ${raceLabelFor('MARATHON')}`).toBe('not enough for a marathon')
  })
})
