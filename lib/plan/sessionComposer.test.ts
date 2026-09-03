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
