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

// ── UX-WIZARD-01 step 1 — per-day time budgets ──────────────────────────────
//
// The grid answers WHICH days. These answer HOW LONG on each, and derive the
// engine's existing single `max_weekday_mins` from them so the two have one
// owner instead of two derivations that can disagree.
//
// Why the MINIMUM: that is what the engine's cap means today — a ceiling every
// weekday session is trimmed to. A runner with 30 minutes on Tuesday and 90 on
// Thursday resolves to 30, and loses the Thursday capacity entirely. Measured
// 2026-09-12: a 30-minute cap costs 22.1% of mean peak volume, and 77.3% of
// plans still contain a weekday session OVER the stated cap (worst 83 min
// against 30) because §81 rightly refuses to deform a structured session.
// Replacing that minimum with per-day SIZING is step 2; this step captures the
// data and provably changes nothing.
describe('UX-WIZARD-01 — weekday budgets', () => {
  const week = (o: Partial<WeekPlan> = {}): WeekPlan => ({ ...defaultWeek(), ...o })

  it('BACK-COMPAT — with no budgets, the default is passed straight through', () => {
    // defaultWeek runs mon/wed/fri, so three weekdays all take the default.
    expect(weekPlanToInputs(week(), 45).maxWeekdayMins).toBe(45)
  })

  it('BACK-COMPAT — no default and no budgets means no limit', () => {
    expect(weekPlanToInputs(week()).maxWeekdayMins).toBeUndefined()
  })

  it('takes the MINIMUM across the weekdays actually run', () => {
    expect(weekPlanToInputs(week(), 90, { mon: 30 }).maxWeekdayMins).toBe(30)
    expect(weekPlanToInputs(week(), 30, { mon: 90, wed: 90, fri: 90 }).maxWeekdayMins).toBe(90)
  })

  it('IGNORES a budget on a REST day — a stale edit must not drag the cap down', () => {
    // tue is rest in defaultWeek. A 10-minute budget left on it from an earlier
    // edit would otherwise cap every weekday at 10.
    expect(weekPlanToInputs(week(), 60, { tue: 10 }).maxWeekdayMins).toBe(60)
  })

  it('IGNORES weekend budgets — the cap is Monday to Friday by definition', () => {
    expect(weekPlanToInputs(week({ sat: 'run' }), 60, { sat: 10 }).maxWeekdayMins).toBe(60)
  })

  it('a weekend-only week keeps the stated default, not undefined', () => {
    // Byte-identical to what the pre-UX-WIZARD-01 call site passed, so parity
    // stays a real signal. Nothing is capped either way — there is no weekday.
    const weekendOnly = week({ mon: 'rest', wed: 'rest', fri: 'rest', sat: 'run' })
    expect(weekPlanToInputs(weekendOnly, 45).maxWeekdayMins).toBe(45)
  })

  it('treats a nonsense budget as absent rather than as a cap of zero', () => {
    // "unknown" must never be read as "none" — the `distance_km ?? 0` mistake.
    expect(weekPlanToInputs(week(), 60, { mon: 0 }).maxWeekdayMins).toBe(60)
    expect(weekPlanToInputs(week(), 60, { mon: NaN }).maxWeekdayMins).toBe(60)
    expect(weekPlanToInputs(week(), 60, { mon: -5 }).maxWeekdayMins).toBe(60)
  })

  it('a budget with no default still caps', () => {
    expect(weekPlanToInputs(week(), undefined, { mon: 40 }).maxWeekdayMins).toBe(40)
  })
})
