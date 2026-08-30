import { describe, it, expect } from 'vitest'
import {
  emptyWeek, defaultWeek, cycleDay, weekPlanToInputs, weekPlanFromLegacy,
  dayCountVerdict, WEEK_DAYS, type WeekPlan, type DayKey,
} from './WeekGrid.logic'

describe('WeekGrid · cycleDay', () => {
  it('cycles a weekday rest ↔ run only (no long)', () => {
    let p = emptyWeek()
    p = cycleDay(p, 'wed'); expect(p.wed).toBe('run')
    p = cycleDay(p, 'wed'); expect(p.wed).toBe('rest')
  })

  it('cycles a weekend day rest → run → long → rest', () => {
    let p = emptyWeek()
    p = cycleDay(p, 'sun'); expect(p.sun).toBe('run')
    p = cycleDay(p, 'sun'); expect(p.sun).toBe('long')
    p = cycleDay(p, 'sun'); expect(p.sun).toBe('rest')
  })

  it('allows only one long across the week (new long demotes old to run)', () => {
    let p = emptyWeek()
    p = cycleDay(p, 'sat'); p = cycleDay(p, 'sat') // sat = long
    expect(p.sat).toBe('long')
    p = cycleDay(p, 'sun'); p = cycleDay(p, 'sun') // sun = long
    expect(p.sun).toBe('long')
    expect(p.sat).toBe('run') // demoted, not reset to rest
  })
})

describe('WeekGrid · weekPlanToInputs (the engine mapping)', () => {
  it('maps the default week correctly', () => {
    const w = weekPlanToInputs(defaultWeek())
    expect(w.daysAvailable).toBe(4)          // mon/wed/fri run + sun long
    expect(w.restShort.sort()).toEqual(['sat', 'thu', 'tue'])
    expect(w.longDay).toBe('sun')
  })

  it('rest days become days_cannot_train; run+long count as available', () => {
    const p: WeekPlan = { mon: 'run', tue: 'run', wed: 'rest', thu: 'rest', fri: 'rest', sat: 'run', sun: 'long' }
    const w = weekPlanToInputs(p)
    expect(w.daysAvailable).toBe(4)          // mon,tue,sat,sun
    expect(w.restShort.sort()).toEqual(['fri', 'thu', 'wed'])
    expect(w.longDay).toBe('sun')
  })

  it('reports no long day when none is marked', () => {
    const p: WeekPlan = { ...emptyWeek(), mon: 'run', wed: 'run' }
    expect(weekPlanToInputs(p).longDay).toBeNull()
  })

  it('an all-rest week is zero available (blocks proceed)', () => {
    expect(weekPlanToInputs(emptyWeek()).daysAvailable).toBe(0)
  })
})

describe('WeekGrid · weekPlanFromLegacy (draft back-compat)', () => {
  it('restores explicit rest days + weekend long', () => {
    const p = weekPlanFromLegacy(['tue', 'thu'] as DayKey[], 'sat')
    expect(p.tue).toBe('rest'); expect(p.thu).toBe('rest')
    expect(p.sat).toBe('long'); expect(p.mon).toBe('run')
  })

  it('falls back to the default week when legacy had no specific days', () => {
    expect(weekPlanFromLegacy([], null)).toEqual(defaultWeek())
  })

  it('does not mark a long on a day that is rest', () => {
    const p = weekPlanFromLegacy(['sat'] as DayKey[], 'sat') // sat is rest → can't be long
    expect(p.sat).toBe('rest')
  })
})

describe('WeekGrid · dayCountVerdict', () => {
  const thr = { block: 3, ok: 4 }
  it('blocks below the block threshold', () => {
    expect(dayCountVerdict(2, thr, 'marathon', false).state).toBe('blocked')
  })
  it('warns a time goal between block and ok', () => {
    expect(dayCountVerdict(3, thr, 'marathon', true).state).toBe('warn')
  })
  it('is ok for a finish goal in the same band (warn only bites time goals)', () => {
    expect(dayCountVerdict(3, thr, 'marathon', false).state).toBe('ok')
  })
  it('is ok at/above the ok threshold', () => {
    expect(dayCountVerdict(4, thr, 'marathon', true).state).toBe('ok')
  })
  it('is ok when no threshold is known', () => {
    expect(dayCountVerdict(1, null, null, true).state).toBe('ok')
  })
})

describe('WeekGrid · WEEK_DAYS', () => {
  it('is Mon–Sun', () => {
    expect(WEEK_DAYS).toEqual(['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'])
  })
})
