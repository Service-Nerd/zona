import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { getSessionsForDate } from './weekResolution'
import { doubleAdvice } from './doubles'
import { buildDailyCoachNotePrompt, type DailyCoachNoteInput } from '@/lib/coaching/prompts/dailyCoachNote'

/**
 * 🔴 SESSION-SLOTS-01 Phase 4 — the readers that used to see one session on a day.
 * The date owner returns both runs of a double; each server reader is pinned to what it does
 * with two (push names the double, readiness targets the hard one, the coach note is told).
 */
const weeks = [{ n: 1, date: '2026-08-24', sessions: { mon: { type: 'easy', label: 'Mon' }, wed: { type: 'easy', label: 'Wed' } } }] as never
const WED = new Date('2026-08-26T12:00:00')

describe('getSessionsForDate on a double day', () => {
  it('returns both runs, AM then PM, each with its slot', () => {
    const r = getSessionsForDate(weeks, WED, [{ week_n: 1, original_day: 'mon', new_day: 'wed', new_slot: 'pm' }])
    expect(r.map(x => [x.slot, x.session.label])).toEqual([['am', 'Wed'], ['pm', 'Mon']])
  })
  it('🔴 control: without the slot it is a swap, one run on the day', () => {
    expect(getSessionsForDate(weeks, WED, [{ week_n: 1, original_day: 'mon', new_day: 'wed' }])).toHaveLength(1)
  })
})

describe('the server readers', () => {
  const src = (f: string) => readFileSync(f, 'utf8')
  it('push send-daily: a double day sends the double advice, not a single-session line', () => {
    expect(src('app/api/push/send-daily/route.ts')).toMatch(/todayAll\.length >= 2 \? doubleAdvice\(\) : buildDailyPushBody\(session\.type\)/)
    expect(doubleAdvice()).toMatch(/^Two easy runs today\./)
  })
  it('pre-session-readiness: the hard session of the day is the target, else the first', () => {
    expect(src('app/api/pre-session-readiness/route.ts')).toMatch(/todayAll\.find\(r => isQualityOrLong\(coachingSessionType\(r\.session\)\)\) \?\? todayAll\[0\] \?\? null/)
  })
  it('daily-coach-note: the route tells the prompt when today holds two', () => {
    expect(src('app/api/daily-coach-note/route.ts')).toMatch(/todayDouble:\s+todayList\.length >= 2/)
  })
})

describe('the coach note prompt on a double day', () => {
  const base: DailyCoachNoteInput = {
    todayDayName: 'Wednesday', todaySessionType: 'easy', todaySessionLabel: 'Easy run', todayZoneLabel: 'Zone 2',
    todayDistanceKm: 6, lastSession: null, weekPhase: 'base', weekN: 2, totalWeeks: 12, weeksToRace: 10,
    raceName: '10K', raceDistanceKm: 10, heavyFatigueTrend: false, consecutiveNailed: 0, firstName: 'Sam',
  }
  it('is told it is a double, kept easy, and never "extra training"', () => {
    const p = buildDailyCoachNotePrompt({ ...base, todayDouble: true })
    expect(p).toContain('make today a double')
    expect(p).toContain('never call it extra training')
  })
  it('🔴 control: a single day says nothing about a double', () => {
    expect(buildDailyCoachNotePrompt(base)).not.toContain('double')
  })
})
