import { describe, it, expect } from 'vitest'
import { generateMaintenanceBlock, aggregatePlanResponse, inferRunDaysPerWeek, inferActualRunCadence, isReengagementWeek, PHASE3_THEME } from './maintenance'
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

describe('inferRunDaysPerWeek — maintenance matches the plan run cadence, not meta', () => {
  const wk = (sessions: any, weekly_km = 40): any =>
    ({ n: 1, date: '', label: '', theme: '', type: 'normal', weekly_km, long_run_hrs: null, sessions })

  it('counts only run-days (excludes strength / cross-train / rest)', () => {
    // The founder's real pattern: strength Mon/Wed, runs Tue/Fri/Sat/Sun → 4 runs, not 5.
    const weeks = [wk({
      mon: { type: 'strength' }, tue: { type: 'easy' }, wed: { type: 'strength' },
      fri: { type: 'easy' }, sat: { type: 'long' }, sun: { type: 'run' },
    })]
    expect(inferRunDaysPerWeek(weeks)).toBe(4)
  })

  it('returns the median run-days across weeks', () => {
    const weeks = [
      wk({ tue: { type: 'easy' }, thu: { type: 'easy' }, sat: { type: 'long' } }),                       // 3
      wk({ tue: { type: 'easy' }, thu: { type: 'easy' }, sat: { type: 'long' }, sun: { type: 'easy' } }), // 4
      wk({ tue: { type: 'easy' }, thu: { type: 'easy' }, sat: { type: 'long' }, sun: { type: 'easy' } }), // 4
    ]
    expect(inferRunDaysPerWeek(weeks)).toBe(4)
  })

  it('excludes recovery jogs — 3 committed runs + 1 recovery reads as 3, not 4', () => {
    // The Race-to-Stones symptom: an ultra week with 3 committed runs + 1 recovery
    // jog must not inflate maintenance cadence to 4.
    const weeks = [wk({
      tue: { type: 'easy' }, thu: { type: 'quality' }, sat: { type: 'long' },
      sun: { type: 'recovery' },
    })]
    expect(inferRunDaysPerWeek(weeks)).toBe(3)
  })

  it('uses the LOWER median on an even spread — 3/4 weeks maintain at 3', () => {
    const weeks = [
      wk({ tue: { type: 'easy' }, thu: { type: 'easy' }, sat: { type: 'long' } }),                       // 3
      wk({ tue: { type: 'easy' }, thu: { type: 'easy' }, sat: { type: 'long' }, sun: { type: 'easy' } }), // 4
    ]
    expect(inferRunDaysPerWeek(weeks)).toBe(3)
  })

  it('returns null when there is no run data (caller falls back to meta)', () => {
    expect(inferRunDaysPerWeek([wk({ mon: { type: 'strength' } }, 40)])).toBeNull()
    expect(inferRunDaysPerWeek([])).toBeNull()
  })
})

describe('inferActualRunCadence — the athlete\'s REAL days + frequency from completions', () => {
  // A plan prescribing runs on tue/fri/sat/sun (+ strength mon/wed).
  const planWeek = (n: number): any => ({
    n, date: '', label: '', theme: '', type: 'normal', weekly_km: 40, long_run_hrs: null,
    sessions: {
      mon: { type: 'strength' }, tue: { type: 'easy' }, wed: { type: 'strength' },
      fri: { type: 'easy' }, sat: { type: 'long' }, sun: { type: 'easy' },
    },
  })
  const weeks = [1, 2, 3, 4].map(planWeek)
  // Completed all four runs each week → 16 completed runs, days tue/fri/sat/sun.
  const complete = (week_n: number, days: string[]) =>
    days.map(d => ({ week_n, session_day: d, status: 'complete' }))
  const allRuns = weeks.flatMap(w => complete(w.n, ['tue', 'fri', 'sat', 'sun']))

  it('derives the actual days in week order + frequency', () => {
    const c = inferActualRunCadence(weeks, allRuns, 8)
    expect(c).not.toBeNull()
    expect(c!.dayKeys).toEqual(['tue', 'fri', 'sat', 'sun'])
    expect(c!.daysPerWeek).toBe(4)
  })

  it('ignores strength days and non-complete rows', () => {
    const rows = [
      ...complete(1, ['tue', 'fri', 'sun']),
      { week_n: 1, session_day: 'mon', status: 'complete' },   // strength — not a run
      { week_n: 2, session_day: 'tue', status: 'skipped' },    // not complete
      ...complete(2, ['fri', 'sun']),
      ...complete(3, ['tue', 'fri', 'sun']),
      ...complete(4, ['tue', 'fri', 'sun']),
    ]
    const c = inferActualRunCadence(weeks, rows, 8)
    expect(c!.dayKeys).toEqual(['tue', 'fri', 'sun'])   // strength excluded, 3 real days
    expect(c!.daysPerWeek).toBe(3)
  })

  it('returns null below the confidence floor (caller falls back to plan cadence)', () => {
    const few = complete(1, ['tue', 'fri', 'sun'])   // 3 completed runs < 8
    expect(inferActualRunCadence(weeks, few, 8)).toBeNull()
    expect(inferActualRunCadence(weeks, [], 8)).toBeNull()
  })

  it('generator places sessions on the actual days, not the default mon/wed/fri/sat', () => {
    const w = gen({ trainingDays: ['tue', 'fri', 'sat', 'sun'], daysAvailable: 4 })
    const runDays = Object.entries(w[0].sessions ?? {})
      .filter(([, s]: any) => s && s.type !== 'rest').map(([d]) => d).sort()
    expect(runDays).toEqual(['fri', 'sat', 'sun', 'tue'])
    expect((w[0].sessions as any).mon.type).toBe('rest')  // strength day → rest in maintenance
    expect((w[0].sessions as any).wed.type).toBe('rest')
  })
})

// MAINT-07 — §75 Phase 3. The CA-03 goal ladder gates on this window, so a
// mis-marked window silently either re-opens the forward conversation mid-recovery
// or never opens it at all.
describe('Phase 3 re-engagement window', () => {
  it('marks exactly the last PHASE3_LAST_WEEKS Phase 2 weeks, and no Phase 1 week', () => {
    const weeks  = gen()
    const phase2 = weeks.filter(w => w.phase === 'maintenance_base')
    const marked = weeks.filter(w => w.reengagement)

    expect(marked).toHaveLength(cfg.PHASE3_LAST_WEEKS)
    expect(marked).toEqual(phase2.slice(-cfg.PHASE3_LAST_WEEKS))
    expect(weeks.filter(w => w.phase === 'maintenance_restoration' && w.reengagement)).toHaveLength(0)
  })

  it('marked weeks carry the Phase 3 theme; earlier Phase 2 weeks do not', () => {
    const weeks = gen()
    for (const w of weeks) {
      expect(w.theme === PHASE3_THEME).toBe(!!w.reengagement)
    }
  })

  it('Phase 3 weeks stay maintenance_base — training is unchanged, only surfacing differs', () => {
    const weeks = gen()
    const p2 = weeks.filter(w => w.phase === 'maintenance_base')
    const marked = p2.filter(w => w.reengagement)
    // Same phase string (so the ~14 phase-switching call sites need no third case)
    // and the same volume as the rest of Phase 2.
    expect(marked.length).toBeGreaterThan(0)
    for (const w of marked) expect(w.weekly_km).toBe(p2[0].weekly_km)
  })

  it('holds across distances — window is always the block tail (5K short, 100K long)', () => {
    for (const [distKm, key] of [[5, '5K'], [100, '100K']] as const) {
      const weeks = gen({ raceDistanceKm: distKm })
      const phase2 = weeks.filter(w => w.phase === 'maintenance_base')
      const expected = Math.min(cfg.PHASE3_LAST_WEEKS, phase2.length)
      expect(weeks.filter(w => w.reengagement), key).toHaveLength(expected)
      expect(weeks[weeks.length - 1].reengagement, key).toBe(true)
    }
  })

  it('isReengagementWeek reads the marker', () => {
    const weeks = gen()
    for (const w of weeks) {
      expect(isReengagementWeek(w, weeks)).toBe(!!w.reengagement)
    }
    expect(isReengagementWeek(null, weeks)).toBe(false)
    expect(isReengagementWeek(undefined, weeks)).toBe(false)
  })

  it('isReengagementWeek DERIVES the window on pre-MAINT-07 plans (no marker, no migration)', () => {
    // Simulates a maintenance plan generated before the marker existed — this is
    // the live-data path, so it must agree exactly with the marked version.
    const marked = gen()
    const legacy = marked.map(({ reengagement, ...w }) => w) as typeof marked

    legacy.forEach((w, i) => {
      expect(isReengagementWeek(w, legacy), `week ${w.n}`).toBe(!!marked[i].reengagement)
    })
  })

  it('derivation ignores non-maintenance weeks (never marks a race plan tail)', () => {
    const racePlanWeeks = [BASE_RACE_WEEK, { ...BASE_RACE_WEEK, n: 13, phase: 'peak' as const }]
    for (const w of racePlanWeeks) {
      expect(isReengagementWeek(w, racePlanWeeks)).toBe(false)
    }
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
