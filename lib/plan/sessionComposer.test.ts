import { describe, it, expect } from 'vitest'
import { composeSession } from './sessionComposer'
import { mainSetMinutes } from './sessionFormat'
import type { Session } from '@/types/plan'

function qualitySession(duration_mins: number): Session {
  return {
    type: 'quality',
    label: 'Cruise intervals — short',
    detail: null,
    duration_mins,
    zone: 'Zone 3–4',
  }
}

describe('sessionComposer — quality branch agrees with sessionFormat (Phase 3, Coaching Board 2026-09-03)', () => {
  it('a 25-minute session\'s main set matches mainSetMinutes(), not the old undocumented 5-minute cool-down floor', () => {
    // Regression for the exact case the board measured: composeSession used to
    // add its own 5-minute cool-down floor that mainSetMinutes() never had —
    // main set 5 min here vs 7.5 min via mainSetMinutes(25). Post-fix both
    // derive from the same sessionSplit(), so they can only disagree by
    // rounding, never by a whole undocumented floor.
    const structure = composeSession({ session: qualitySession(25) })
    expect(structure).not.toBeNull()
    const expectedMain = mainSetMinutes(25)
    expect(Math.abs(structure!.main.duration_mins - expectedMain)).toBeLessThanOrEqual(1)
    // Falsifies the old bug directly: the old formula produced exactly 5.
    expect(structure!.main.duration_mins).not.toBe(5)
  })

  it('warm-up, main, and cool-down always sum to the total duration', () => {
    for (const total of [20, 25, 29, 45, 60, 90]) {
      const structure = composeSession({ session: qualitySession(total) })
      expect(structure).not.toBeNull()
      const sum = structure!.warmup.duration_mins + structure!.main.duration_mins + structure!.cooldown.duration_mins
      expect(sum).toBe(total)
    }
  })

  it('agrees with mainSetMinutes() within rounding across a range of durations', () => {
    for (const total of [18, 22, 25, 30, 40, 50, 70, 100]) {
      const structure = composeSession({ session: qualitySession(total) })
      expect(structure).not.toBeNull()
      expect(Math.abs(structure!.main.duration_mins - mainSetMinutes(total))).toBeLessThanOrEqual(1)
    }
  })
})

describe('sessionComposer — distance-aware parts (Coaching Board + SLT 2026-09-03)', () => {
  // Founder-reported: the top-level card correctly showed distance while the
  // "Session structure" breakdown was hardcoded to duration only — SessionPart
  // had no distance field at all. This tests the fix: every part now carries
  // a distance estimate derived from the session's own overall pace.

  it('every part carries a distance_km when the session has one', () => {
    const session: Session = { ...qualitySession(45), distance_km: 9 }
    const structure = composeSession({ session })
    expect(structure).not.toBeNull()
    expect(structure!.warmup.distance_km).toBeDefined()
    expect(structure!.main.distance_km).toBeDefined()
    expect(structure!.cooldown.distance_km).toBeDefined()
  })

  it('parts sum to the session total distance exactly (same pace used throughout, by design)', () => {
    for (const [duration, distance] of [[45, 9], [25, 5.5], [90, 18]] as const) {
      const session: Session = { ...qualitySession(duration), distance_km: distance }
      const structure = composeSession({ session })
      expect(structure).not.toBeNull()
      const sum = structure!.warmup.distance_km! + structure!.main.distance_km! + structure!.cooldown.distance_km!
      expect(sum).toBeCloseTo(distance, 1)
    }
  })

  it('a duration-only session (no distance_km) leaves every part\'s distance undefined, not a fabricated number', () => {
    const structure = composeSession({ session: qualitySession(45) })
    expect(structure).not.toBeNull()
    expect(structure!.warmup.distance_km).toBeUndefined()
    expect(structure!.main.distance_km).toBeUndefined()
    expect(structure!.cooldown.distance_km).toBeUndefined()
  })

  it('easy/long, shakeout, and MP-long-run shapes also get part distances', () => {
    const easy: Session = { type: 'easy', label: 'Easy run', detail: null, duration_mins: 40, distance_km: 6, zone: 'Zone 2' }
    const easyStructure = composeSession({ session: easy })
    expect(easyStructure!.main.distance_km).toBeDefined()

    const shakeout: Session = { type: 'easy', label: 'Shakeout', detail: null, duration_mins: 20, distance_km: 3, zone: 'Zone 1' }
    const shakeoutStructure = composeSession({ session: shakeout })
    expect(shakeoutStructure!.shape).toBe('shakeout')
    expect(shakeoutStructure!.main.distance_km).toBeDefined()
  })
})
