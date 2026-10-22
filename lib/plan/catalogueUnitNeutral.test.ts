import { describe, it, expect } from 'vitest'
import { V1_SESSION_CATALOGUE } from './sessionCatalogueData'

/**
 * 🔴 REP-UNITS-KM-01 (§19 Am., Coaching Board 2026-10-22). The engine prescribes in metres and does not know the
 * runner's units, so no catalogue row may name an imperial unit: "Mile repeats" reached 46 km runners of 49.
 */
// Distance units only: "feet" is a body part in this catalogue ("Quick feet", "Time on feet").
const IMPERIAL = /\b(miles?|mi|yards?|yds?)\b/i

describe('the catalogue names no unit the engine does not prescribe in', () => {
  it('the catalogue is not empty', () => {
    expect(V1_SESSION_CATALOGUE.length).toBeGreaterThan(20)
  })
  it('🔴 no row name or purpose names an imperial unit', () => {
    const bad = V1_SESSION_CATALOGUE
      .filter(r => IMPERIAL.test(r.name) || IMPERIAL.test(r.purpose ?? ''))
      .map(r => `${r.id}: ${r.name} / ${r.purpose}`)
    expect(bad).toEqual([])
  })
})
