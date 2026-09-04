import { describe, it, expect } from 'vitest'
import { zonesFromZoneString, hrBandForZoneString } from './zoneRules'

/**
 * §84 — the display reads `session.zone` (a single zone or a range), never the
 * coarse `session.type` slot. These lock the parse + band derivation the header
 * relies on.
 */

describe('zonesFromZoneString', () => {
  it('parses a single zone', () => {
    expect(zonesFromZoneString('Zone 3')).toEqual([3])
  })
  it('parses an en-dash range (what the engine writes)', () => {
    expect(zonesFromZoneString('Zone 3–4')).toEqual([3, 4])
    expect(zonesFromZoneString('Zone 4–5')).toEqual([4, 5])
    expect(zonesFromZoneString('Zone 2–3')).toEqual([2, 3])
  })
  it('parses a plain-hyphen range too', () => {
    expect(zonesFromZoneString('Zone 4-5')).toEqual([4, 5])
  })
  it('is empty for missing / unparseable input (caller falls back to type)', () => {
    expect(zonesFromZoneString(undefined)).toEqual([])
    expect(zonesFromZoneString(null)).toEqual([])
    expect(zonesFromZoneString('Race effort')).toEqual([])
  })
})

describe('hrBandForZoneString', () => {
  const RHR = 48, MAX = 188 // hrr = 140

  it('spans the range floor-to-peak with Karvonen when RHR is known', () => {
    // Z4 low = 80% → 48 + 0.80*140 = 160; Z5 high = 100% → 48 + 1.0*140 = 188
    expect(hrBandForZoneString('Zone 4–5', RHR, MAX)).toEqual({ lo: 160, hi: 188 })
  })
  it('handles a single zone', () => {
    // Z3 = 70–80% → 48 + 0.70*140 = 146 ; 48 + 0.80*140 = 160
    expect(hrBandForZoneString('Zone 3', RHR, MAX)).toEqual({ lo: 146, hi: 160 })
  })
  it('falls back to %MaxHR when RHR is absent', () => {
    // Z3 maxhr_pct 80–87 of 188 → 150 – 164 (rounded)
    expect(hrBandForZoneString('Zone 3', null, MAX)).toEqual({ lo: 150, hi: 164 })
  })
  it('is null without max HR or zone', () => {
    expect(hrBandForZoneString('Zone 3', RHR, null)).toBeNull()
    expect(hrBandForZoneString(undefined, RHR, MAX)).toBeNull()
  })
})
