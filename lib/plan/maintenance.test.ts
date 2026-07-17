import { describe, it, expect } from 'vitest'
import { generateMaintenanceBlock } from './maintenance'
import { GENERATION_CONFIG } from './generationConfig'
import type { Week, RaceResult } from '@/types/plan'

const BASE_RACE_WEEK: Week = {
  n: 12,
  date: '2026-07-07',
  label: 'Race week',
  theme: 'Race day.',
  type: 'race',
  phase: 'taper',
  weekly_km: 30,
  long_run_hrs: null,
  sessions: {},
}

const BASE_RESULT: RaceResult = {
  finish_time: '3:45:00',
  distance_km: 42.2,
  date: '2026-07-12',
  rpe: 7,
  outcome: 'on_target',
}

describe('generateMaintenanceBlock', () => {
  it('produces the correct number of weeks for a marathon (default)', () => {
    const weeks = generateMaintenanceBlock({
      raceResult: BASE_RESULT,
      lastRaceWeek: BASE_RACE_WEEK,
      peakWeeklyKm: 70,
      raceDistanceKm: 42.2,
      daysAvailable: 4,
    })
    const cfg = GENERATION_CONFIG.POST_RACE_MAINTENANCE_BLOCK
    const expectedPhase1 = cfg.MARATHON_BLACKOUT_RANGE[0] // RPE 7 < 8, so lower bound
    const expectedTotal  = expectedPhase1 + cfg.PHASE2_WEEKS_BY_DISTANCE['MARATHON']
    expect(weeks).toHaveLength(expectedTotal)
  })

  it('extends Phase 1 by 1 week for RPE >= 8', () => {
    const highRpeResult = { ...BASE_RESULT, rpe: 9 }
    const weeks = generateMaintenanceBlock({
      raceResult: highRpeResult,
      lastRaceWeek: BASE_RACE_WEEK,
      peakWeeklyKm: 70,
      raceDistanceKm: 42.2,
      daysAvailable: 4,
    })
    const cfg = GENERATION_CONFIG.POST_RACE_MAINTENANCE_BLOCK
    const expectedPhase1 = cfg.MARATHON_BLACKOUT_RANGE[1] // RPE >= 8 → upper bound for marathon
    const expectedTotal  = expectedPhase1 + cfg.PHASE2_WEEKS_BY_DISTANCE['MARATHON']
    expect(weeks).toHaveLength(expectedTotal)
  })

  it('extends Phase 1 by 1 additional week for DNF', () => {
    const dnfResult = { ...BASE_RESULT, outcome: 'dnf' as const, rpe: 9 }
    const weeksNormal = generateMaintenanceBlock({
      raceResult: { ...BASE_RESULT, rpe: 9 },
      lastRaceWeek: BASE_RACE_WEEK,
      peakWeeklyKm: 70,
      raceDistanceKm: 42.2,
      daysAvailable: 4,
    })
    const weeksDnf = generateMaintenanceBlock({
      raceResult: dnfResult,
      lastRaceWeek: BASE_RACE_WEEK,
      peakWeeklyKm: 70,
      raceDistanceKm: 42.2,
      daysAvailable: 4,
    })
    expect(weeksDnf).toHaveLength(weeksNormal.length + 1)
  })

  it('assigns correct phases to weeks', () => {
    const weeks = generateMaintenanceBlock({
      raceResult: BASE_RESULT,
      lastRaceWeek: BASE_RACE_WEEK,
      peakWeeklyKm: 70,
      raceDistanceKm: 42.2,
      daysAvailable: 4,
    })
    const cfg = GENERATION_CONFIG.POST_RACE_MAINTENANCE_BLOCK
    const phase1Count = cfg.MARATHON_BLACKOUT_RANGE[0]
    weeks.slice(0, phase1Count).forEach(w => {
      expect(w.phase).toBe('maintenance_restoration')
    })
    weeks.slice(phase1Count).forEach(w => {
      expect(w.phase).toBe('maintenance_base')
    })
  })

  it('assigns sequential n values starting after the race week', () => {
    const weeks = generateMaintenanceBlock({
      raceResult: BASE_RESULT,
      lastRaceWeek: BASE_RACE_WEEK,
      peakWeeklyKm: 70,
      raceDistanceKm: 42.2,
      daysAvailable: 4,
    })
    expect(weeks[0].n).toBe(BASE_RACE_WEEK.n + 1)
    weeks.forEach((w, i) => {
      expect(w.n).toBe(BASE_RACE_WEEK.n + 1 + i)
    })
  })

  it('Phase 1 weeks contain no quality sessions', () => {
    const weeks = generateMaintenanceBlock({
      raceResult: BASE_RESULT,
      lastRaceWeek: BASE_RACE_WEEK,
      peakWeeklyKm: 70,
      raceDistanceKm: 42.2,
      daysAvailable: 4,
    })
    const qualityTypes = new Set(['tempo', 'threshold', 'intervals', 'quality', 'vo2max'])
    const phase1 = weeks.filter(w => w.phase === 'maintenance_restoration')
    for (const w of phase1) {
      for (const s of Object.values(w.sessions)) {
        if (s) expect(qualityTypes.has(s.type)).toBe(false)
      }
    }
  })

  it('Phase 2 volume is at or below 75% of plan peak', () => {
    const peakWeeklyKm = 80
    const weeks = generateMaintenanceBlock({
      raceResult: BASE_RESULT,
      lastRaceWeek: BASE_RACE_WEEK,
      peakWeeklyKm,
      raceDistanceKm: 42.2,
      daysAvailable: 4,
    })
    const ceiling = peakWeeklyKm * 0.75
    const phase2 = weeks.filter(w => w.phase === 'maintenance_base')
    for (const w of phase2) {
      expect(w.weekly_km).toBeLessThanOrEqual(ceiling)
    }
  })

  it('every maintenance week has at least one rest day', () => {
    const weeks = generateMaintenanceBlock({
      raceResult: BASE_RESULT,
      lastRaceWeek: BASE_RACE_WEEK,
      peakWeeklyKm: 70,
      raceDistanceKm: 42.2,
      daysAvailable: 4,
    })
    for (const w of weeks) {
      const sessions = Object.values(w.sessions)
      const hasRest = sessions.some(s => s?.type === 'rest')
      expect(hasRest).toBe(true)
    }
  })

  it('produces correct week count for 5K race', () => {
    const result5k: RaceResult = { ...BASE_RESULT, distance_km: 5, rpe: 6, outcome: 'on_target', finish_time: '25:00' }
    const weeks = generateMaintenanceBlock({
      raceResult: result5k,
      lastRaceWeek: BASE_RACE_WEEK,
      peakWeeklyKm: 40,
      raceDistanceKm: 5,
      daysAvailable: 4,
    })
    const cfg = GENERATION_CONFIG.POST_RACE_MAINTENANCE_BLOCK
    const expected = cfg.PHASE1_WEEKS_BY_DISTANCE['5K'] + cfg.PHASE2_WEEKS_BY_DISTANCE['5K']
    expect(weeks).toHaveLength(expected)
  })

  it('produces correct week count for 100K race', () => {
    const result100k: RaceResult = { ...BASE_RESULT, distance_km: 100, rpe: 8, outcome: 'on_target', finish_time: '14:00:00' }
    const weeks = generateMaintenanceBlock({
      raceResult: result100k,
      lastRaceWeek: BASE_RACE_WEEK,
      peakWeeklyKm: 80,
      raceDistanceKm: 100,
      daysAvailable: 5,
    })
    const cfg = GENERATION_CONFIG.POST_RACE_MAINTENANCE_BLOCK
    // 100K with RPE 8 → phase1 = 4 + 1 (RPE) = 5
    const expectedPhase1 = cfg.PHASE1_WEEKS_BY_DISTANCE['100K'] + 1
    const expectedTotal  = expectedPhase1 + cfg.PHASE2_WEEKS_BY_DISTANCE['100K']
    expect(weeks).toHaveLength(expectedTotal)
  })
})
