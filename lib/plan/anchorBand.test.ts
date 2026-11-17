import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { anchorHrBand, zoneStringForBand, zonesOverlappedBy, vo2Reserve, isBandableAnchor } from './anchorBand'
import { VDOT_FRACTIONS } from './paceBands'
import { computeZones } from './zones'
import { GENERATION_CONFIG } from './generationConfig'

/**
 * ADR-026 R1/R2 — the anchor-derived HR band.
 *
 * 📐 THE BOARD'S OWN TABLE IS THE FIXTURE, not numbers I chose. ADR-026 §4 publishes
 * three personas computed by calling the real producers, and §5 publishes the ruled
 * interval floor for four. If this file's arithmetic disagrees with the ruling, the
 * ruling is what shipped and the code is wrong.
 *
 * ⚠️ EVERY ARM BELOW WAS MADE TO GO RED BEFORE BEING TRUSTED GREEN. The ones worth
 * naming, because they are the mistakes that were actually available:
 *   · dividing by VDOT instead of VDOT RESERVE gives 83–88% HRR → 162–169, not 160–167
 *   · taking `I`'s own floor (0.95) instead of the CV ceiling gives 178, not 173, and
 *     leaves 173–178 prescribed by nothing
 *   · a half-open overlap test in `zoneStringForBand` drops the zone a band ends exactly
 *     on, which is every band here, because `z2Top` IS `z3Low` by construction
 */

// ADR-026 §4/§5 — persona, then the ruled numbers.
const PERSONAS = [
  { name: 'max 185, rest 48, VDOT 41.0', maxHr: 185, restingHr: 48, vdot: 41.0, T: [160, 167], intervalFloor: 173 },
  { name: 'max 190, rest 50, VDOT 44.6', maxHr: 190, restingHr: 50, vdot: 44.6, T: [164, 172], intervalFloor: 178 },
  { name: 'max 191, rest 60, VDOT 20.2', maxHr: 191, restingHr: 60, vdot: 20.2, T: [164, 172], intervalFloor: 178 },
  { name: 'max 190, rest 65, VDOT 16.2', maxHr: 190, restingHr: 65, vdot: 16.2, T: null,       intervalFloor: 177 },
] as const

describe('anchorHrBand — ADR-026 R1', () => {
  it('🔑 reproduces the BOARD\'S OWN threshold band, persona by persona', () => {
    for (const p of PERSONAS) {
      if (!p.T) continue
      const b = anchorHrBand({ anchor: 'T', vdot: p.vdot, maxHr: p.maxHr, restingHr: p.restingHr })
      expect(b, p.name).not.toBeNull()
      expect([b!.lo, b!.hi], `${p.name} threshold band`).toEqual([...p.T])
    }
  })

  it('🔑 reproduces the ruled INTERVAL FLOOR — the CV ceiling, not I\'s own floor', () => {
    // ADR-026 §5's table. Falsified by using VDOT_FRACTIONS.I[0]: gives 178/183/183/182.
    for (const p of PERSONAS) {
      const b = anchorHrBand({ anchor: 'I', vdot: p.vdot, maxHr: p.maxHr, restingHr: p.restingHr })
      expect(b!.lo, `${p.name} interval floor`).toBe(p.intervalFloor)
      expect(b!.hi, `${p.name} interval top is max HR`).toBe(p.maxHr)
    }
  })

  it('🔴 T · CV · I are CONTIGUOUS — no gap and no overlap, for every persona', () => {
    // This is the whole of condition 1. The overlap it replaced was 9–10 bpm, which
    // EXCEEDED the width of the threshold band itself.
    for (const p of PERSONAS) {
      const arg = { vdot: p.vdot, maxHr: p.maxHr, restingHr: p.restingHr }
      const t = anchorHrBand({ ...arg, anchor: 'T' })!
      const cv = anchorHrBand({ ...arg, anchor: 'CV' })!
      const i = anchorHrBand({ ...arg, anchor: 'I' })!
      expect(cv.lo, `${p.name}: CV floor is T ceiling`).toBe(t.hi)
      expect(i.lo, `${p.name}: interval floor is CV ceiling`).toBe(cv.hi)
    }
  })

  it('🔴 the threshold FLOOR clears the easy CEILING — the defect ADR-026 exists for', () => {
    // Before: `qualityHR` was z3Low–z3Top and `z3Low` IS `z2Top`, so the floor WAS the
    // ceiling — a gap of exactly 0 for every runner. Falsified by reverting to z3Low.
    for (const p of PERSONAS) {
      const z = computeZones(p.maxHr, p.restingHr)
      const t = anchorHrBand({ anchor: 'T', vdot: p.vdot, maxHr: p.maxHr, restingHr: p.restingHr })!
      expect(t.lo, `${p.name}: new floor above the easy ceiling`).toBeGreaterThan(z.zone2Ceiling!)
      const old = Number(z.qualityHR!.match(/^(\d+)/)![1])
      expect(old, `${p.name}: the OLD floor was the easy ceiling`).toBe(z.zone2Ceiling!)
    }
  })

  it('🔴 narrows Seiler\'s "weather forecast" — the band is ~7–8 bpm, not ~14', () => {
    for (const p of PERSONAS) {
      const z = computeZones(p.maxHr, p.restingHr)
      const [oLo, oHi] = z.qualityHR!.match(/(\d+)–(\d+)/)!.slice(1).map(Number)
      const t = anchorHrBand({ anchor: 'T', vdot: p.vdot, maxHr: p.maxHr, restingHr: p.restingHr })!
      expect(t.hi - t.lo, `${p.name}: narrower than today`).toBeLessThan(oHi - oLo)
      expect(t.hi - t.lo, `${p.name}: and not collapsed to a point`).toBeGreaterThanOrEqual(5)
    }
  })

  it('🔑 the LABEL is read off the band, and it DIFFERS BY RUNNER on the same session', () => {
    // ADR-026 R2's claim, which a hardcoded 'Zone 3' cannot express. Not an assertion
    // that any particular runner gets any particular string — an assertion that the
    // string is a function of the runner, which is the thing being bought.
    const labels = new Set(PERSONAS.map(p =>
      anchorHrBand({ anchor: 'T', vdot: p.vdot, maxHr: p.maxHr, restingHr: p.restingHr })!.zone))
    expect(labels.size, `one T-pace session, ${labels.size} distinct labels: ${Array.from(labels).join(' / ')}`).toBeGreaterThan(1)
  })

  it('🔴 EASY IS EXCLUDED BY RULING — and this arm records WHY, by computing it', () => {
    // ADR-026 §5: E's fraction gives 55–72% HRR and 71.6% breaches §12's 70% Z2 ceiling.
    // If someone makes E bandable, this goes red and names the principle.
    expect(isBandableAnchor('E')).toBe(false)
    expect(anchorHrBand({ anchor: 'E', vdot: 41, maxHr: 185, restingHr: 48 })).toBeNull()
    const top = vo2Reserve(VDOT_FRACTIONS.E[1], 41) * 100
    expect(top, 'E\'s own top fraction breaches §12\'s Z2 ceiling, which is why it is excluded')
      .toBeGreaterThan(GENERATION_CONFIG.ZONES.Z2.karvonen_pct[1])
  })

  it('🔴 M and HM are excluded — the segmented long run is out of scope (§84 Am. 1)', () => {
    for (const a of ['M', 'HM', 'goal', 'R', 'race_5K', null, undefined, '']) {
      expect(anchorHrBand({ anchor: a, vdot: 41, maxHr: 185, restingHr: 48 }), `anchor ${a}`).toBeNull()
    }
  })

  it('🔴 REFUSES rather than guessing when the band cannot be derived — 35.2% of live sessions', () => {
    const ok = { anchor: 'T' as const, vdot: 41, maxHr: 185, restingHr: 48 }
    expect(anchorHrBand(ok)).not.toBeNull()
    // No HR reserve → no %HRR → no band. A `0` is absent, not a measurement.
    expect(anchorHrBand({ ...ok, restingHr: 0 }), 'resting HR 0').toBeNull()
    expect(anchorHrBand({ ...ok, restingHr: null }), 'no resting HR').toBeNull()
    expect(anchorHrBand({ ...ok, restingHr: -5 }), 'negative resting HR').toBeNull()
    expect(anchorHrBand({ ...ok, maxHr: 0 }), 'no max HR').toBeNull()
    expect(anchorHrBand({ ...ok, maxHr: null }), 'null max HR').toBeNull()
    expect(anchorHrBand({ ...ok, vdot: null }), 'no VDOT').toBeNull()
    expect(anchorHrBand({ ...ok, vdot: 0 }), 'zero VDOT').toBeNull()
    expect(anchorHrBand({ ...ok, vdot: 3.5 }), 'VDOT at resting VO2 — division by zero').toBeNull()
    expect(anchorHrBand({ ...ok, vdot: 2 }), 'VDOT below resting VO2').toBeNull()
    expect(anchorHrBand({ ...ok, restingHr: 185 }), 'resting = max, no reserve').toBeNull()
    expect(anchorHrBand({ ...ok, restingHr: 200 }), 'resting above max').toBeNull()
    expect(anchorHrBand({ ...ok, vdot: NaN }), 'NaN VDOT').toBeNull()
    expect(anchorHrBand({ ...ok, maxHr: Infinity }), 'infinite max').toBeNull()
  })

  it('🔑 %VO2R, not %VO2max — the denominator is worth ~2 bpm of prescription', () => {
    // The arm that catches the single likeliest arithmetic slip in the module.
    const vdot = 41
    expect(vo2Reserve(VDOT_FRACTIONS.T[0], vdot)).toBeCloseTo((0.83 * 41 - 3.5) / (41 - 3.5), 10)
    const wrong = VDOT_FRACTIONS.T[0]                       // %VO2max
    expect(vo2Reserve(VDOT_FRACTIONS.T[0], vdot)).not.toBeCloseTo(wrong, 3)
    expect(vo2Reserve(1.0, vdot), 'the identity: 100% of VDOT is 100% of reserve').toBeCloseTo(1, 10)
  })

  it('🔴 an overlap must have WIDTH, because every zone boundary is SHARED', () => {
    // 🔴 THIS ARM ASSERTED THE OPPOSITE UNTIL 2026-11-17 AND THE OPPOSITE WAS WRONG. It read
    // "overlaps INCLUSIVELY, because every boundary is shared" — and inclusive is exactly what
    // makes a shared boundary poisonous: `z2Top` IS `z3Low`, so a band ending on it was reported
    // as touching BOTH zones. Zone 3's own band came out as "Zone 2–4", and when
    // `INV-PLAN-DISPLAY-ZONE-MATCHES-WORK` started reading this owner (ADR-026 R2) it fired on
    // the engine's own correct output. A single shared endpoint is not a zone the work reaches.
    const maxHr = 185, restingHr = 48, hrr = maxHr - restingHr
    const k = (p: number) => Math.round(restingHr + (p / 100) * hrr)
    const z2Top = k(GENERATION_CONFIG.ZONES.Z2.karvonen_pct[1])
    const z3Top = k(GENERATION_CONFIG.ZONES.Z3.karvonen_pct[1])
    // A zone's OWN band names only that zone — the case the inclusive rule got wrong.
    expect(zoneStringForBand(z2Top, z3Top, maxHr, restingHr)).toBe('Zone 3')
    expect(zoneStringForBand(k(62), k(66), maxHr, restingHr)).toBe('Zone 2')
    // A band with real width across three zones still names all three.
    expect(zoneStringForBand(k(65), k(84), maxHr, restingHr)).toBe('Zone 2–4')
    // ⚠️ A ZERO-WIDTH BAND ON A SHARED BOUNDARY STILL GETS AN ANSWER, never an empty string: the
    // strict test matches nothing there, so the owner falls back to the zone that boundary opens.
    expect(zoneStringForBand(z2Top, z2Top, maxHr, restingHr)).not.toBe('')
  })

  it('zonesOverlappedBy answers on the %MaxHR branch too, where no reserve exists', () => {
    // §14's second formula. The invariant reads this owner for EVERY plan, and 65.3% of cohort
    // quality sessions have no derivable anchor band — but they still have a zone STRING that
    // has to be checkable, and 14 of 43 live plans carry no resting HR at all.
    expect(zonesOverlappedBy(150, 160, 190, null).length).toBeGreaterThan(0)
    expect(zonesOverlappedBy(150, 160, 190, 0).length).toBeGreaterThan(0)
    expect(zonesOverlappedBy(150, 160, 190, null)).not.toEqual(zonesOverlappedBy(150, 160, 190, 50))
  })

  it('🔴 the fractions have ONE owner — a second copy here would be the drift', () => {
    // The module must read `VDOT_FRACTIONS`, not restate 0.83/0.88. Source-asserted
    // because a behavioural arm cannot tell one copy of 0.83 from another.
    const src = readFileSync('lib/plan/anchorBand.ts', 'utf8')
    expect(src, 'anchorBand stopped reading the shared fractions').toContain("from './paceBands'")
    const literals = src.replace(/^\s*(\/\/|\*|\/\*).*$/gm, '').match(/0\.(59|74|83|88|92|95|79|84)\b/g) ?? []
    expect(literals, `a Daniels fraction is written out in anchorBand.ts: ${literals.join(' ')}`).toEqual([])
    const paces = readFileSync('lib/plan/paceBands.ts', 'utf8')
    expect(paces, 'buildPaceFromVDOT stopped reading the shared fractions').toContain('VDOT_FRACTIONS.T[0]')
  })
})

describe('anchorHrBand — the multi-anchor union (R1 amendment, 2026-11-17)', () => {
  const R = { vdot: 41, maxHr: 185, restingHr: 48 } as const

  it('🔑 tempo_over_under (CV+T) gets the band that SPANS both — no exception needed', () => {
    const t = anchorHrBand({ ...R, anchor: 'T' })!
    const cv = anchorHrBand({ ...R, anchor: 'CV' })!
    const u = anchorHrBand({ ...R, anchor: ['T', 'CV'] })!
    expect([u.lo, u.hi]).toEqual([t.lo, cv.hi])
    expect([u.lo, u.hi], 'the ruled over-under band at VDOT 41 / 185 / 48').toEqual([160, 173])
    // Order must not matter: a row's step order is not a prescription.
    expect(anchorHrBand({ ...R, anchor: ['CV', 'T'] })).toEqual(u)
  })

  it('🔴 progressive_tempo (E+T) gets NO band, which is how its Z2–Z3 ramp SURVIVES', () => {
    // ADR-026 §5 requires this in as many words. All-or-nothing is what delivers it:
    // banding only the bandable anchor would prescribe an HR for part of a session.
    expect(anchorHrBand({ ...R, anchor: ['E', 'T'] }), 'E is unbandable, so the row is').toBeNull()
    expect(anchorHrBand({ ...R, anchor: ['T', 'M'] }), 'one unbandable anchor forfeits the band').toBeNull()
    expect(anchorHrBand({ ...R, anchor: ['T', 'goal'] })).toBeNull()
    expect(anchorHrBand({ ...R, anchor: [] }), 'no anchors is not a band').toBeNull()
    expect(anchorHrBand({ ...R, anchor: [null] })).toBeNull()
  })

  it('a single-element array is identical to the bare anchor', () => {
    expect(anchorHrBand({ ...R, anchor: ['T'] })).toEqual(anchorHrBand({ ...R, anchor: 'T' }))
  })

  it('🔴 a union still refuses when the band cannot be derived at all', () => {
    expect(anchorHrBand({ ...R, restingHr: 0, anchor: ['T', 'CV'] })).toBeNull()
    expect(anchorHrBand({ ...R, vdot: null, anchor: ['T', 'CV'] })).toBeNull()
  })
})
