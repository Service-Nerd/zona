import { describe, it, expect } from 'vitest'
import { generateMaintenanceBlock, aggregatePlanResponse } from './maintenance'
import { GENERATION_CONFIG } from './generationConfig'
import type { Week, RaceResult } from '@/types/plan'

const cfg = GENERATION_CONFIG.POST_RACE_MAINTENANCE_BLOCK

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

// Convenience — a marathon block off a base of 40km/wk, neutral person inputs.
const gen = (over: Partial<Parameters<typeof generateMaintenanceBlock>[0]> = {}) =>
  generateMaintenanceBlock({
    raceResult: BASE_RESULT,
    lastRaceWeek: BASE_RACE_WEEK,
    baseWeeklyKm: 40,
    raceDistanceKm: 42.2,
    daysAvailable: 4,
    ...over,
  })

describe('generateMaintenanceBlock — structure', () => {
  it('marathon default: correct week count (RPE 7 < 8 → lower blackout)', () => {
    const expected = cfg.MARATHON_BLACKOUT_RANGE[0] + cfg.PHASE2_WEEKS_BY_DISTANCE['MARATHON']
    expect(gen()).toHaveLength(expected)
  })

  it('extends restoration by 1 week for race-day RPE >= 8', () => {
    const expected = cfg.MARATHON_BLACKOUT_RANGE[1] + cfg.PHASE2_WEEKS_BY_DISTANCE['MARATHON']
    expect(gen({ raceResult: { ...BASE_RESULT, rpe: 9 } })).toHaveLength(expected)
  })

  it('extends restoration by 1 more week for DNF', () => {
    const normal = gen({ raceResult: { ...BASE_RESULT, rpe: 9 } })
    const dnf    = gen({ raceResult: { ...BASE_RESULT, rpe: 9, outcome: 'dnf' } })
    expect(dnf).toHaveLength(normal.length + 1)
  })

  it('assigns restoration then base phases, sequential n after the race week', () => {
    const weeks = gen()
    const p1 = cfg.MARATHON_BLACKOUT_RANGE[0]
    weeks.slice(0, p1).forEach(w => expect(w.phase).toBe('maintenance_restoration'))
    weeks.slice(p1).forEach(w => expect(w.phase).toBe('maintenance_base'))
    weeks.forEach((w, i) => expect(w.n).toBe(BASE_RACE_WEEK.n + 1 + i))
  })

  it('every maintenance week has a rest day', () => {
    for (const w of gen()) {
      expect(Object.values(w.sessions).some(s => s?.type === 'rest')).toBe(true)
    }
  })

  it('week counts hold across distances (5K, 100K)', () => {
    const w5k = gen({ raceResult: { ...BASE_RESULT, distance_km: 5, rpe: 6 }, raceDistanceKm: 5, baseWeeklyKm: 30 })
    expect(w5k).toHaveLength(cfg.PHASE1_WEEKS_BY_DISTANCE['5K'] + cfg.PHASE2_WEEKS_BY_DISTANCE['5K'])
    // 100K with RPE 8 → phase1 = 4 + 1
    const w100 = gen({ raceResult: { ...BASE_RESULT, distance_km: 100, rpe: 8 }, raceDistanceKm: 100, baseWeeklyKm: 60, daysAvailable: 5 })
    expect(w100).toHaveLength((cfg.PHASE1_WEEKS_BY_DISTANCE['100K'] + 1) + cfg.PHASE2_WEEKS_BY_DISTANCE['100K'])
  })
})

describe('generateMaintenanceBlock — Layer 1: base-anchored volume', () => {
  it('Phase 2 volume = base × tick-over%, NOT a % of peak', () => {
    const base = 40
    const weeks = gen({ baseWeeklyKm: base })
    const expected = parseFloat((base * cfg.PHASE2_VOLUME_PCT_OF_BASE / 100).toFixed(1))
    for (const w of weeks.filter(w => w.phase === 'maintenance_base')) {
      expect(w.weekly_km).toBeCloseTo(expected, 1)
    }
  })

  it('no maintenance week exceeds base volume (INV-MAINT-VOLUME-CEILING)', () => {
    const base = 40
    for (const w of gen({ baseWeeklyKm: base })) {
      expect(w.weekly_km).toBeLessThanOrEqual(base + 0.1)
    }
  })

  it('restoration ramps UP from a low start toward the base target', () => {
    const weeks = gen().filter(w => w.phase === 'maintenance_restoration')
    for (let i = 1; i < weeks.length; i++) {
      expect(weeks[i].weekly_km).toBeGreaterThanOrEqual(weeks[i - 1].weekly_km)
    }
    // opens well below the phase-2 target
    const target = 40 * cfg.PHASE2_VOLUME_PCT_OF_BASE / 100
    expect(weeks[0].weekly_km).toBeLessThan(target)
  })
})

describe('generateMaintenanceBlock — Layer 5: intent scaling', () => {
  it('rest < tick_over < stay_sharp, all clamped at/below base', () => {
    const base = 40
    const vol = (intent: any) => gen({ baseWeeklyKm: base, intent }).find(w => w.phase === 'maintenance_base')!.weekly_km
    const rest = vol('rest'), tick = vol('tick_over'), sharp = vol('stay_sharp')
    expect(rest).toBeLessThan(tick)
    expect(tick).toBeLessThan(sharp)
    for (const v of [rest, tick, sharp]) expect(v).toBeLessThanOrEqual(base)
  })
})

describe('generateMaintenanceBlock — Layer 2: injuries', () => {
  it('injured → no strides/quality anywhere + restoration extended', () => {
    const clean   = gen()
    const injured = gen({ injuryHistory: ['knee'] })
    expect(injured.length).toBe(clean.length + cfg.INJURY_PHASE1_EXTENSION_WEEKS)
    for (const w of injured) {
      for (const s of Object.values(w.sessions)) {
        if (s) expect(/strides/i.test(s.label ?? '')).toBe(false)
      }
    }
  })

  it('non-injured Phase 2 DOES reintroduce a mild strides session (control)', () => {
    const hasStrides = gen().some(w =>
      w.phase === 'maintenance_base' && Object.values(w.sessions).some(s => /strides/i.test(s?.label ?? '')),
    )
    expect(hasStrides).toBe(true)
  })
})

describe('generateMaintenanceBlock — Layers 3 & 4: response + recovery', () => {
  it('a hard-felt plan extends restoration (Layer 3)', () => {
    const neutral = gen()
    const hard    = gen({ planResponse: { heavyTagFraction: 0.5, meanRpe: 6, loggedCount: 10 } })
    expect(hard.length).toBe(neutral.length + cfg.RESPONSE_FATIGUE_PHASE1_EXTENSION_WEEKS)
  })

  it('too few logged sessions → no response modifier (needs ≥4)', () => {
    const neutral = gen()
    const sparse  = gen({ planResponse: { heavyTagFraction: 1, meanRpe: 10, loggedCount: 2 } })
    expect(sparse.length).toBe(neutral.length)
  })

  it('suppressed recovery markers extend restoration (Layer 4)', () => {
    const neutral = gen()
    const suppressed = gen({ recoverySuppressed: true })
    expect(suppressed.length).toBe(neutral.length + cfg.SUPPRESSED_RECOVERY_PHASE1_EXTENSION_WEEKS)
  })

  it('modifiers stack (injury + hard plan + suppressed recovery)', () => {
    const neutral = gen()
    const stacked = gen({
      injuryHistory: ['achilles'],
      planResponse: { heavyTagFraction: 0.5, meanRpe: 8, loggedCount: 12 },
      recoverySuppressed: true,
    })
    const added = cfg.INJURY_PHASE1_EXTENSION_WEEKS
      + cfg.RESPONSE_FATIGUE_PHASE1_EXTENSION_WEEKS
      + cfg.SUPPRESSED_RECOVERY_PHASE1_EXTENSION_WEEKS
    expect(stacked.length).toBe(neutral.length + added)
  })
})

describe('aggregatePlanResponse', () => {
  it('computes heavy fraction + mean RPE from completion rows', () => {
    const r = aggregatePlanResponse([
      { rpe: 8, fatigue_tag: 'Heavy' },
      { rpe: 6, fatigue_tag: 'Fine' },
      { rpe: 9, fatigue_tag: 'Wrecked' },
      { rpe: null, fatigue_tag: null },
    ])
    expect(r.heavyTagFraction).toBeCloseTo(2 / 3, 5) // 2 heavy of 3 tagged
    expect(r.meanRpe).toBeCloseTo((8 + 6 + 9) / 3, 5)
    expect(r.loggedCount).toBe(4)
  })

  it('handles no data cleanly', () => {
    const r = aggregatePlanResponse([])
    expect(r).toEqual({ heavyTagFraction: 0, meanRpe: null, loggedCount: 0 })
  })
})
