import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { pushSessionFor } from './serverDay'
import { buildDailyPushTitle, buildDailyPushBody } from '@/lib/coaching/voiceLines'
import { buildDailyCoachNotePrompt } from '@/lib/coaching/prompts/dailyCoachNote'
import type { StrengthSession } from '@/packages/strength'

/** 🔴 STRENGTH-APP-01 (A′) — the push and the daily note never call a strength day a rest day. */
const ss: StrengthSession = { date: '2026-11-03', day: 'tue', week_n: 1, kind: 'upper_core', heavy_legs: false, after_quality_run: false, estimated_minutes: 40, blocks: [] }

describe('the morning push on a strength day', () => {
  it('a rest day with strength speaks about strength', () => {
    const s = pushSessionFor({ type: 'rest' }, ss)!
    expect(buildDailyPushTitle(s as never)).toBe('Strength today.')
    expect(buildDailyPushBody(s.type)).not.toContain('Do nothing')
  })
  it('a day with no plan session at all, but strength, is still sent', () => {
    expect(pushSessionFor(null, ss)).toMatchObject({ type: 'strength' })
  })
  it('a run day stays the run', () => {
    expect(pushSessionFor({ type: 'easy' }, ss)).toEqual({ type: 'easy' })
  })
  it('🔴 control: a rest day WITHOUT strength still gets the rest line', () => {
    expect(buildDailyPushBody(pushSessionFor({ type: 'rest' }, null)!.type)).toBe('Do nothing. It helps.')
  })
  it('the route decides through this owner, not a copy of it', () => {
    const src = readFileSync('app/api/push/send-daily/route.ts', 'utf8')
    expect(src).toMatch(/pushSessionFor\(resolved\?\.session \?\? null, strengthToday\)/)
    expect(src).toMatch(/!resolved && !strengthToday && !testMode/)
  })
})

describe('the daily coach note on a strength day', () => {
  const base = { todayDayName: 'Tuesday', todaySessionLabel: null, todayZoneLabel: null, todayDistanceKm: null, lastSession: null, weekPhase: 'build', weekN: 3, totalWeeks: 12, planComplete: false, weeksToRace: 9, raceName: null, raceDistanceKm: null, heavyFatigueTrend: false, consecutiveNailed: 0, firstName: null, athleteContext: '', previousWeeklyReport: null, raceAchievement: null }
  it('a rest day with strength is told it is not a rest day', () => {
    const p = buildDailyCoachNotePrompt({ ...base, todaySessionType: 'rest', todayStrength: { title: 'Upper body', minutes: 40 } } as never)
    expect(p).toContain('This is NOT a rest day')
    expect(p).not.toContain('): rest day')
  })
  it('🔴 control: without strength the rest day is unchanged', () => {
    expect(buildDailyCoachNotePrompt({ ...base, todaySessionType: 'rest' } as never)).toContain('): rest day')
  })
  it('a run day with strength is told not to repeat it', () => {
    const p = buildDailyCoachNotePrompt({ ...base, todaySessionType: 'easy', todayStrength: { title: 'Full body', minutes: 40 } } as never)
    expect(p).toContain('do not repeat it')
  })
})
