import { describe, it, expect } from 'vitest'
import {
  nextGoalOptions,
  achievementLine,
  raceKeyFromKm,
  parseTimeToSeconds,
  formatSeconds,
} from './goalSequencing'

describe('CA-03 — goal sequencing', () => {
  it('time helpers round-trip', () => {
    expect(parseTimeToSeconds('21:48')).toBe(21 * 60 + 48)
    expect(parseTimeToSeconds('4:32:17')).toBe(4 * 3600 + 32 * 60 + 17)
    expect(parseTimeToSeconds(null)).toBeNull()
    expect(parseTimeToSeconds('nonsense')).toBeNull()
    expect(formatSeconds(21 * 60 + 48)).toBe('21:48')
    expect(formatSeconds(4 * 3600 + 32 * 60 + 17)).toBe('4:32:17')
  })

  it('maps distances to buckets', () => {
    expect(raceKeyFromKm(5)).toBe('5K')
    expect(raceKeyFromKm(10)).toBe('10K')
    expect(raceKeyFromKm(21.1)).toBe('HM')
    expect(raceKeyFromKm(42.2)).toBe('MARATHON')
  })

  it('a PB 10K leads with step-up to HM, includes chase + maintain', () => {
    const opts = nextGoalOptions({ distanceKm: 10, finishTime: '45:00', targetTime: '46:00', outcome: 'pb' })
    expect(opts.map(o => o.kind)).toEqual(['step_up', 'chase_time', 'maintain'])
    const step = opts[0]
    expect(step.distanceKey).toBe('HM')
    expect(step.goal).toBe('time_target')
    // Riegel prediction for HM from a 45:00 10K is sensible (well over the 10K time).
    expect(parseTimeToSeconds(step.targetTime)!).toBeGreaterThan(45 * 60)
  })

  it('a MISSED goal leads with chasing the same time again', () => {
    const opts = nextGoalOptions({ distanceKm: 10, finishTime: '48:30', targetTime: '46:00', outcome: 'off_target' })
    expect(opts[0].kind).toBe('chase_time')
    expect(opts[0].distanceKey).toBe('10K')
    // Re-attempt the original goal, not a softer one.
    expect(opts[0].targetTime).toBe('46:00')
  })

  it('chasing a PB suggests a faster-than-achieved target', () => {
    const opts = nextGoalOptions({ distanceKm: 5, finishTime: '20:00', targetTime: '20:30', outcome: 'pb' })
    const chase = opts.find(o => o.kind === 'chase_time')!
    expect(parseTimeToSeconds(chase.targetTime)!).toBeLessThan(20 * 60)
  })

  it('a marathon finisher gets NO step-up (ladder capped)', () => {
    const opts = nextGoalOptions({ distanceKm: 42.2, finishTime: '3:30:00', targetTime: '3:35:00', outcome: 'pb' })
    expect(opts.some(o => o.kind === 'step_up')).toBe(false)
    expect(opts.map(o => o.kind)).toEqual(['chase_time', 'maintain'])
  })

  it('every option carries a minimum prep window', () => {
    const opts = nextGoalOptions({ distanceKm: 10, finishTime: '50:00', outcome: 'on_target' })
    for (const o of opts) expect(o.minPrepWeeks).toBeGreaterThan(0)
  })

  it('achievement line reads finish vs goal', () => {
    expect(achievementLine({ distanceKm: 42.2, finishTime: '2:04:00', targetTime: '2:10:00', outcome: 'pb' }))
      .toBe('You ran 2:04:00 — 6:00 inside your goal.')
    expect(achievementLine({ distanceKm: 10, finishTime: '48:00', targetTime: '46:00', outcome: 'off_target' }))
      .toBe('You ran 48:00 — 2:00 over. It happens.')
    expect(achievementLine({ distanceKm: 5, outcome: 'dnf' }))
      .toBe('You toed the line for the 5K. That counts.')
  })
})
