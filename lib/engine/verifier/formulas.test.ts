// ADR027-B3-VERIFIER — the checker's own maths gives the same numbers as the planner's, across a grid of runners.
// The two are separate on purpose (a mistake in one must not pass the other), so this is what stops them drifting.
import { describe, it, expect } from 'vitest'
import { paceGuide, racePace, bandForZoneLabel, zonesTouchedBy, bandForPaceAnchors, PACE_FRACTIONS } from './formulas'
import { buildPaceFromVDOT, VDOT_FRACTIONS } from '@/lib/plan/paceBands'
import { racePaceMinPerKm } from '@/lib/plan/aerobicEstimate'
import { hrBandForZoneString } from '@/lib/coaching/zoneRules'
import { zonesOverlappedBy, bandForAnchors } from '@/lib/plan/anchorBand'

const VDOTS = Array.from({ length: 141 }, (_, i) => 15 + i * 0.5)          // 15 .. 85
const MAXES = [150, 165, 178, 190, 205]
const RESTS: (number | null)[] = [null, 40, 52, 65, 80]
const ZONE_LABELS = ['Zone 1', 'Zone 2', 'Zone 1–2', 'Zone 3', 'Zone 3–4', 'Zone 4', 'Zone 4–5', 'Zone 5', 'Zone 2-3', 'no zone', '']

describe('ADR027-B3-VERIFIER — the checker\'s maths agrees with the planner\'s', () => {
  it('the fraction table is the same table', () => expect(PACE_FRACTIONS).toEqual(VDOT_FRACTIONS))

  it('🔴 paces, for every VDOT and training discount', () => {
    let n = 0
    for (const raw of VDOTS) for (const d of [0, 0.03, 0.07]) {
      const t = raw * (1 - d), mine = paceGuide(t, raw), theirs = buildPaceFromVDOT(t, raw)
      expect([mine.easy, mine.threshold, mine.cv, mine.interval, mine.marathon, mine.hm])
        .toEqual([theirs.minPerKmEasy, theirs.minPerKmQuality, theirs.minPerKmCV, theirs.minPerKmInterval, theirs.minPerKmMarathon, theirs.minPerKmHM])
      n++
    }
    expect(n).toBe(VDOTS.length * 3)
  })

  it('🔴 race pace, for every VDOT and distance', () => {
    for (const v of VDOTS) for (const km of [3, 5, 8, 10, 15, 21.0975, 30, 42.195, 50, 100]) expect(racePace(v, km)).toBe(racePaceMinPerKm(v, km))
  })

  it('🔴 the HR band of a zone label', () => {
    for (const z of ZONE_LABELS) for (const max of MAXES) for (const r of RESTS) expect(bandForZoneLabel(z, r, max)).toEqual(hrBandForZoneString(z, r, max))
    expect(bandForZoneLabel('Zone 3', 50, null)).toEqual(hrBandForZoneString('Zone 3', 50, null))
  })

  it('🔴 the zones a band touches, for every band', () => {
    let n = 0
    for (const max of MAXES) for (const r of RESTS) for (let lo = 90; lo <= 200; lo += 3) for (let hi = lo; hi <= 210; hi += 7) {
      expect(zonesTouchedBy(lo, hi, max, r)).toEqual(zonesOverlappedBy(lo, hi, max, r)); n++
    }
    expect(n).toBeGreaterThan(5000)
  })

  it('🔴 the HR band a pace anchor implies, single and combined', () => {
    const sets = [['T'], ['CV'], ['I'], ['E'], ['M'], [null], [], ['T', 'CV'], ['CV', 'I'], ['T', 'I'], ['T', 'E']]
    let derived = 0
    for (const a of sets) for (const v of [null, 3, 25, 40, 55, 70]) for (const max of [...MAXES, 0]) for (const r of [...RESTS, 210]) {
      const mine = bandForPaceAnchors(a, v, max, r), theirs = bandForAnchors(a, { vdot: v, maxHr: max, restingHr: r })
      expect(mine).toEqual(theirs)
      if (mine) derived++
    }
    expect(derived, 'the grid never produced a band, so it proves nothing').toBeGreaterThan(100)
  })
})
