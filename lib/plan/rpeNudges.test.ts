import { describe, it, expect } from 'vitest'
import { missingRpeNudges, type NudgeWeek } from './rpeNudges'

/**
 * NUDGE-EFFECTIVE-DAY-01 — Duncan, 2026-11-04. Reproduced from the production rows:
 *   session_overrides   week 7, tue -> mon, written 2026-11-02 16:57
 *   session_completions week 7, session_day 'tue', 6.7 km, HealthKit uuid, 16:58, rpe null
 * He ran it on the MONDAY. Today said "Tell Kit how Tuesday's 4.2mi felt".
 */
const DAY_OFFSETS: Record<string, number> = { mon:0, tue:1, wed:2, thu:3, fri:4, sat:5, sun:6 }
const dateOf = (ws: Date, k: string) => { const d = new Date(ws); d.setDate(d.getDate() + (DAY_OFFSETS[k] ?? 0)); return d }
const weekStartOf = (w: NudgeWeek) => new Date(`${w.date}T00:00:00`)

const WEEK7: NudgeWeek = {
  n: 7, date: '2026-11-02', type: 'normal',
  sessions: {
    tue: { id: 'w7-tue', type: 'easy', label: 'Easy run — Zone 2', distance_km: 7 },
    wed: { id: 'w7-wed', type: 'quality', label: 'Quality', catalogue_id: 'threshold_pyramid', distance_km: 8 },
  } as any,
}
const LINKED = { status: 'complete', rpe: null, strava_activity_km: 6.7, apple_health_uuid: 'uuid-1' }
const base = (over: any[], now: Date, completions: any = { 7: { tue: LINKED } }) =>
  missingRpeNudges({ weeks: [WEEK7], completionsByWeek: completions, overrides: over, now, weekStartOf, dateOf })

describe('NUDGE-EFFECTIVE-DAY-01 — the nudge names the day the runner RAN, not the day it was planned', () => {
  const MOVE = [{ week_n: 7, original_day: 'tue', new_day: 'mon' }]

  it('the production case: moved tue->mon, the prompt says MONDAY', () => {
    const [n] = base(MOVE, new Date('2026-11-03T21:30:00'))
    expect(n.dayName).toBe('Monday')          // was 'Tuesday' — the reported bug
  })

  it('the completion key stays the ORIGINAL day, or PostRunScreen writes to the wrong row', () => {
    const [n] = base(MOVE, new Date('2026-11-03T21:30:00'))
    expect(n.dayKey).toBe('tue')
  })

  it('THE SUPPRESSION HALF: it appears the EVENING HE RAN IT, not a day later', () => {
    // 2026-11-02 19:00 — Monday evening. Against the scheduled Tuesday date this
    // tripped `sessionDate > now` and returned nothing at all.
    expect(base(MOVE, new Date('2026-11-02T19:00:00'))).toHaveLength(1)
  })

  it('a move ACROSS the window still shows: sat -> mon is not hidden for five days', () => {
    const w: NudgeWeek = { ...WEEK7, sessions: { sat: WEEK7.sessions!.tue } as any }
    const out = missingRpeNudges({
      weeks: [w], completionsByWeek: { 7: { sat: LINKED } },
      overrides: [{ week_n: 7, original_day: 'sat', new_day: 'mon' }],
      now: new Date('2026-11-02T19:00:00'), weekStartOf, dateOf,
    })
    expect(out.map(n => n.dayName)).toEqual(['Monday'])
  })

  it('with NO override the planned day is the right answer — the fix is not a shift', () => {
    const [n] = base([], new Date('2026-11-03T21:30:00'))
    expect(n.dayName).toBe('Tuesday')
    expect(n.dayKey).toBe('tue')
  })

  it('ordering follows the day RUN, not the day planned', () => {
    const w: NudgeWeek = { ...WEEK7, sessions: {
      tue: WEEK7.sessions!.tue, wed: WEEK7.sessions!.wed } as any }
    const out = missingRpeNudges({
      weeks: [w], completionsByWeek: { 7: { tue: LINKED, wed: { ...LINKED, strava_activity_km: 8 } } },
      // tue moves to FRIDAY, so it is the more recent run even though wed is later in the plan.
      overrides: [{ week_n: 7, original_day: 'tue', new_day: 'fri' }],
      now: new Date('2026-11-07T20:00:00'), weekStartOf, dateOf,
    })
    expect(out.map(n => n.dayName)).toEqual(['Friday', 'Wednesday'])
  })

  // The unchanged guards — a fix must not widen what prompts.
  it('stays silent when the RPE is already in, the run is unlinked, or it is not complete', () => {
    const now = new Date('2026-11-03T21:30:00')
    expect(base(MOVE, now, { 7: { tue: { ...LINKED, rpe: 4 } } })).toHaveLength(0)
    expect(base(MOVE, now, { 7: { tue: { ...LINKED, apple_health_uuid: null } } })).toHaveLength(0)
    expect(base(MOVE, now, { 7: { tue: { ...LINKED, status: 'skipped' } } })).toHaveLength(0)
    expect(base(MOVE, now, {})).toHaveLength(0)
  })

  it('still ages out at 7 days, measured from the day run', () => {
    expect(base(MOVE, new Date('2026-11-12T12:00:00'))).toHaveLength(0)
  })
})
