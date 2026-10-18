import { describe, it, expect } from 'vitest'
import { computeReadiness } from '@/lib/coaching/readinessBaseline'
import { readingLine, runLine, strengthLine, overrideLabel, EASE_LABEL } from './recoveryCardCopy'
import { generateStrengthPlan, CATALOGUE_BY_ID, PATTERN_REGION, type StrengthSession } from '@/packages/strength'

/** READINESS-SURFACE-01 item 2 + STRENGTH-RECOVERY-01 — the card's words, approved by the founder 2026-10-18 (A–D). */
const DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']
const week = (day: string, before: object, after: object) => {
  const i = DAYS.indexOf(day)
  return { sessions_before: DAYS.map((_, k) => (k === i ? before : { type: 'rest' })), sessions_after: DAYS.map((_, k) => (k === i ? after : { type: 'rest' })), trigger_detail: { sessionDay: day }, summary: 'fallback' }
}

describe('A — the reading against their normal', () => {
  it('HRV first, then sleep, then resting HR', () => {
    expect(readingLine({ hrvToday: 38.2, hrvBaseline: 51.6 }, { isLowHRV: true })).toBe('HRV 38. Your normal is 52.')
    expect(readingLine({ sleepHours: 4 + 40 / 60, sleepBaseline: 7.5 }, { isShortSleep: true })).toBe('4h 40 sleep. You usually get 7h 30.')
    expect(readingLine({ sleepHours: 4.5 }, { isShortSleep: true })).toBe('4h 30 sleep.')
    expect(readingLine({ rhrToday: 58, rhrBaseline: 51.2 }, { isElevatedRHR: true })).toBe('Resting HR 58. Your normal is 51.')
    expect(readingLine({}, { isPoorSleepQuality: true })).toBe('Deep sleep was short last night.')
    expect(readingLine({ hrvToday: 38, hrvBaseline: 52, sleepHours: 4, sleepBaseline: 7 }, { isLowHRV: true, isShortSleep: true })).toMatch(/^HRV/)
  })
  it('🔴 the readiness result carries the usual sleep the line quotes', () => {
    const win = Array.from({ length: 14 }, (_, k) => ({ sampleDate: `2026-11-${String(k + 1).padStart(2, '0')}`, rhrBpm: 50, hrvMs: 60, sleepHours: k % 2 ? 7 : 8 }))
    const r = computeReadiness(win, { rhrBpm: 50, hrvMs: 60, sleepHours: 4.5, sleepStages: null })
    expect(r.detail.sleepBaseline).toBe(7.5)
    expect(readingLine(r.detail, { isShortSleep: r.isShortSleep })).toBe('4h 30 sleep. You usually get 7h 30.')
  })
  it('🔴 a signal with no numbers says nothing rather than inventing one', () => {
    expect(readingLine({}, { isLowHRV: true })).toBeNull()
    expect(readingLine(null, { isLowHRV: true })).toBeNull()
  })
})

describe('B — the run', () => {
  it('a quality session becomes an easy run, named by what it was', () => {
    expect(runLine(week('tue', { type: 'tempo' }, { type: 'easy' }), 'km')).toBe("Today's tempo becomes an easy run.")
    expect(runLine(week('tue', { type: 'intervals' }, { type: 'easy' }), 'km')).toBe("Today's interval session becomes an easy run.")
    expect(runLine(week('tue', { type: 'quality' }, { type: 'easy' }), 'km')).toBe("Today's quality session becomes an easy run.")
  })
  it('a long run says its new distance, in the runner\'s units', () => {
    expect(runLine(week('sat', { type: 'easy', distance_km: 18 }, { type: 'easy', distance_km: 14.4 }), 'km')).toMatch(/^Long run trimmed to 14(\.4)? ?km\.$/)
    expect(runLine(week('sat', { type: 'easy', distance_km: 18 }, { type: 'easy', distance_km: 14.4 }), 'mi')).toMatch(/mi\.$/)
  })
  it('anything else falls back to the engine summary; no row, no line', () => {
    expect(runLine(week('tue', { type: 'easy' }, { type: 'easy' }), 'km')).toBe('fallback')
    expect(runLine(null, 'km')).toBeNull()
  })
})

describe('C — the lift, read from what the ease actually keeps', () => {
  const sessions: StrengthSession[] = []
  for (const sessions_per_week of [2, 4] as const) for (const equipment of [['dumbbells', 'bench'], ['barbell', 'rack', 'bench', 'dumbbells']] as const) for (const session_minutes of [30, 60] as const)
    sessions.push(...generateStrengthPlan({ focus: 'running', session_minutes, sessions_per_week, equipment: [...equipment], experience: 'regular' }, null, { standaloneStart: '2026-11-02' }).weeks.flatMap(w => w.sessions))
  const hasUpper = (s: StrengthSession) => s.blocks.some(b => b.role !== 'warmup' && b.role !== 'mobility' && b.items.some(i => PATTERN_REGION[CATALOGUE_BY_ID.get(i.exercise_id)!.pattern] === 'upper'))
  it('heavy full body with upper work → upper body and core', () => {
    expect(strengthLine(sessions.find(s => s.kind === 'full_body' && s.heavy_legs && hasUpper(s)))).toBe('Strength drops to upper body and core.')
  })
  it('🔴 a "full body" session that holds no upper work never claims it (STRENGTH-FULLBODY-NO-UPPER-01)', () => {
    const s = sessions.find(x => x.kind === 'full_body' && x.heavy_legs && !hasUpper(x))
    expect(s).toBeDefined()
    expect(strengthLine(s)).not.toMatch(/upper/)
  })
  it('🔴 heavy lower body never claims upper body', () => {
    const line = strengthLine(sessions.find(s => s.kind === 'lower_core' && s.heavy_legs))
    expect(line).not.toMatch(/upper/)
    expect(line).toMatch(/^Strength drops to core/)
  })
  it('a session without heavy legs keeps its shape, with fewer sets', () => {
    expect(strengthLine(sessions.find(s => !s.heavy_legs && s.kind !== 'mobility'))).toBe('Strength stays, with fewer sets.')
  })
})

describe('D and the rules every line keeps', () => {
  it('the override names what the runner keeps', () => {
    expect(overrideLabel(true)).toBe('Run it anyway →')
    expect(overrideLabel(false)).toBe('Lift as planned')
    expect(EASE_LABEL).toBe('Ease the session')
  })
  it('no em dash, and nothing claims what an ease prevents', () => {
    const all = [readingLine({ hrvToday: 38, hrvBaseline: 52 }, { isLowHRV: true }), runLine(week('tue', { type: 'tempo' }, { type: 'easy' }), 'km'),
      'Strength drops to upper body and core.', 'Strength drops to core and calf work.', 'Strength stays, with fewer sets.', overrideLabel(false)]
    for (const l of all) { expect(l).not.toContain('—'); expect(l).not.toMatch(/prevent|injur|protect|avoid/i) }
  })
})
