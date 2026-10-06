import { describe, it, expect } from 'vitest'
import { applyRacePaceSegmentDuration } from './ruleEngine'
import { V1_SESSION_CATALOGUE } from './sessionCatalogueData'
import type { Session, Week } from '@/types/plan'
import type { PaceGuide } from './paceBands'

// §25 Amendment 2 — `race_pace_pct` is a share of the long run's DURATION.
//
// MKT-PLAN-SEGMENT-ENGINE-BASIS-01. `sessionComposer.ts` already read the dose on
// the time basis; `applyRacePaceSegmentDuration` read the SAME declared number as
// a share of DISTANCE. Two producers, one number, opposite meanings.
//
// WHY THIS IS A BEHAVIOURAL TEST WITH INJECTED PACES rather than a plan-level
// identity: a generated plan does not carry its pace guide at all (`minPerKmEasy`
// appears nowhere in the plan JSON, and `pace_target` is a DISPLAY RANGE —
// "7:00-8:20 /km" against an actual 8.58 used for sizing). Reconstructing the
// paces would mean re-deriving VDOT here, i.e. the checker computing the answer
// the same way the producer did, which is how a checker stops being able to
// disagree. So the paces are given, and the arithmetic is pinned.
const row = V1_SESSION_CATALOGUE.find(r => r.id === 'hm_pace_long_run')
const mss = row?.main_set_structure as { race_pace_pct: number; race_pace_zone: string }

// The spread matters. At easy 6:00 / HM 5:00 the two bases differ by only 0.85
// min on a 20 km session, which `Math.round` can erase — a fixture that cannot
// tell the two formulas apart cannot test which one is in use. These are a real
// ~1:35 half-marathon runner's paces and separate the bases by ~5 min.
const PACE: PaceGuide = {
  minPerKmEasy: 7.0,
  minPerKmHM: 4.5,
  minPerKmMarathon: 4.8,
} as PaceGuide

function longRunWeek(distKm: number, startingMins: number): Week {
  const s = {
    type: 'easy', role: 'long_run', label: 'Long run with HM-pace finish',
    distance_km: distKm, duration_mins: startingMins,
    lr_segment_pace: '4:30 /km', catalogue_id: 'hm_pace_long_run',
  } as unknown as Session
  return { n: 9, phase: 'peak', type: 'build', weekly_km: distKm, sessions: { sun: s } } as unknown as Week
}

describe('§25 Am. 2 — the race-pace segment is a share of DURATION', () => {
  it('the row under test declares its dose, so this is not vacuous', () => {
    expect(row, 'hm_pace_long_run must exist').toBeTruthy()
    expect(typeof mss.race_pace_pct).toBe('number')
    expect(mss.race_pace_zone).toBe('HM')
  })

  it('prices the session on the TIME basis (harmonic), not the distance basis', () => {
    const distKm = 20
    const p = mss.race_pace_pct / 100
    const timeBasis = distKm / (p / PACE.minPerKmHM! + (1 - p) / PACE.minPerKmEasy)
    const distanceBasis = distKm * (p * PACE.minPerKmHM! + (1 - p) * PACE.minPerKmEasy)

    // The two bases must be distinguishable at this fixture, or the assertion
    // below would pass either way.
    expect(Math.abs(timeBasis - distanceBasis)).toBeGreaterThan(1)

    const w = longRunWeek(distKm, 999)   // start high so the "only reduces" guard admits it
    applyRacePaceSegmentDuration([w], PACE)
    const got = (w.sessions as Record<string, Session>).sun.duration_mins

    expect(got, `expected the time basis ${timeBasis.toFixed(1)} not the distance basis ${distanceBasis.toFixed(1)}`)
      .toBe(Math.round(timeBasis))
    expect(got).not.toBe(Math.round(distanceBasis))
  })

  it('is always DOWNWARD against the distance basis — no minutes ceiling can be newly breached', () => {
    // Cauchy-Schwarz: the harmonic form never exceeds the arithmetic one. Checked
    // across the fixture's plausible range rather than asserted, because §9's
    // LONG_RUN_CAP_MINUTES and INV-PLAN-LONG-CAP-MINS both depend on it.
    const p = mss.race_pace_pct / 100
    for (const distKm of [8, 12, 16, 20, 26, 32]) {
      const timeBasis = distKm / (p / PACE.minPerKmHM! + (1 - p) / PACE.minPerKmEasy)
      const distanceBasis = distKm * (p * PACE.minPerKmHM! + (1 - p) * PACE.minPerKmEasy)
      expect(timeBasis, `${distKm}km: harmonic must not exceed arithmetic`).toBeLessThanOrEqual(distanceBasis)
    }
  })

  it('never writes the distance — the runner covers the same ground', () => {
    const w = longRunWeek(20, 999)
    applyRacePaceSegmentDuration([w], PACE)
    expect((w.sessions as Record<string, Session>).sun.distance_km).toBe(20)
  })
})
