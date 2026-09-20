// RACE-KEY-TWO-OWNERS-01 — one owner for "what do we call this distance".
//
// There were THREE copies and two of them were in `invariants.ts`, which
// therefore disagreed with the producer AND with itself:
//
//   producer   generationConfig.ts   <=6  / <=12 / <=22   / <=43   / <=55
//   checker A  invariants.ts         <=5  / <=10 / <=21.2 / <=42.5 / <=50.5
//   checker B  invariants.ts (§49)   <=6  / <=12 / <=22   / <=43   / <=55
//
// ⚠️ THIS IS NOT THE `deloadCadence` MISTAKE. That rule forbids a checker
// sharing the producer's PREDICATE, because a checker re-using a decision
// cannot catch the decision being wrong. A distance KEY is not a decision, it
// is a vocabulary mapping with one right answer — and the coaching judgements
// keyed by it (cap minutes, taper weeks) stay independently checked.

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { raceDistanceKey } from './generationConfig'

const WIZARD_DISTANCES = [5, 10, 21.1, 42.2, 50, 100] as const

describe('RACE-KEY-TWO-OWNERS-01 — one owner, and no copy may return', () => {
  it('THE GUARD: invariants.ts contains no inline distance-bucket ladder', () => {
    const src = readFileSync('lib/plan/invariants.ts', 'utf8')
    // Any re-implementation has to write one of these boundaries as a literal.
    for (const frag of ['<= 21.2', '<= 42.5', '<= 50.5', "<= 22) return", "<= 43) return", "<= 55) return"]) {
      expect(src).not.toContain(frag)
    }
  })

  it('the producer is exported and is the only implementation', () => {
    const cfg = readFileSync('lib/plan/generationConfig.ts', 'utf8')
    expect(cfg).toContain('export function raceDistanceKey')
  })
})

describe('RACE-KEY-TWO-OWNERS-01 — the mapping itself', () => {
  it('every distance the wizard can emit maps as expected', () => {
    expect(WIZARD_DISTANCES.map(raceDistanceKey))
      .toEqual(['5K', '10K', 'HM', 'MARATHON', '50K', '100K'])
  })

  it('the boundaries are inclusive-below, as the config documents', () => {
    expect(raceDistanceKey(6)).toBe('5K');        expect(raceDistanceKey(6.1)).toBe('10K')
    expect(raceDistanceKey(12)).toBe('10K');      expect(raceDistanceKey(12.1)).toBe('HM')
    expect(raceDistanceKey(22)).toBe('HM');       expect(raceDistanceKey(22.1)).toBe('MARATHON')
    expect(raceDistanceKey(43)).toBe('MARATHON'); expect(raceDistanceKey(43.1)).toBe('50K')
    expect(raceDistanceKey(55)).toBe('50K');      expect(raceDistanceKey(55.1)).toBe('100K')
  })

  it('THE LATENT BANDS: the five ranges where the old checker disagreed', () => {
    // Recorded so the cost of the bug is visible if anyone reconsiders the
    // boundaries. In each of these the engine built one distance's plan and the
    // validator judged it as another.
    const oldChecker = (km: number) =>
      km <= 5 ? '5K' : km <= 10 ? '10K' : km <= 21.2 ? 'HM' : km <= 42.5 ? 'MARATHON' : km <= 50.5 ? '50K' : '100K'
    let diverging = 0
    for (let x = 10; x <= 1200; x++) {
      const km = x / 10
      if (raceDistanceKey(km) !== oldChecker(km)) diverging++
    }
    expect(diverging).toBe(88)
    // …and none of them is reachable from the product today.
    for (const km of WIZARD_DISTANCES) expect(raceDistanceKey(km)).toBe(oldChecker(km))
  })
})
