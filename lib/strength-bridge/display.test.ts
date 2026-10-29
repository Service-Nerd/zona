import { describe, it, expect } from 'vitest'
import * as D from './display'
import * as Doors from '@/components/shared/meDoors'
import type { Prescription } from '@/packages/strength'

/** STRENGTH-APP-01 — the one owner of strength copy. `noEmDashApp` scans components/ and app/dashboard; this lives in lib/, so it guards itself. */
const p = (x: Partial<Prescription>): Prescription => ({ exercise_id: 'goblet_squat', sets: 3, rir: 2, rest_s: 90, per_side: false, ...x })

describe('strength display strings', () => {
  it('a row says its dose inside its part: the sets only when they differ from the rounds (PARTS-01)', () => {
    expect(D.partDose(p({ reps: 5 }), 3)).toBe('5')
    expect(D.partDose(p({ reps: 10, per_side: true }), 3)).toBe('10 each side')
    expect(D.partDose(p({ seconds: 30 }), 3)).toBe('30 s')
    expect(D.partDose(p({ contacts: 10 }), 3)).toBe('10 contacts')
    expect(D.partDose(p({ sets: 2, reps: 10 }), 3)).toBe('2 × 10')
  })
  it('a part header says rounds, rest and, only when it differs, its own effort; never "reps in reserve"', () => {
    const part = (items: Prescription[], kind: 'superset' | 'main' | 'core' | 'warmup' | 'cooldown' = 'superset') =>
      ({ kind, items: items.map(i => ({ ...i, role: 'main' as const })), rounds: Math.max(...items.map(i => i.sets)), rest_s: Math.max(...items.map(i => i.rest_s)) })
    expect(D.partHeader(part([p({ reps: 10 }), p({ reps: 10, rest_s: 150 })]), 2)).toBe('3 rounds · rest 2:30 min')
    expect(D.partHeader(part([p({ reps: 10, rir: 3 })], 'main'), 2)).toBe('3 rounds · rest 1:30 min · 3 in the tank')
    expect(D.partHeader(part([p({ reps: 10, rir: 3 }), p({ reps: 10 })]), 2)).toBe('3 rounds · rest 1:30 min · 2–3 in the tank')
    expect(D.partHeader(part([p({ seconds: 30, rir: null, rest_s: 30 })], 'core'), 2)).toBe('3 rounds · rest 30s')
    expect(D.partHeader(part([p({ sets: 2, reps: 8, rir: null, rest_s: 0 })], 'warmup'), 2)).toBe('2 rounds · no rest')
    expect(D.partHeader(part([p({ sets: 1, seconds: 40, rir: null, rest_s: 0 })], 'cooldown'), 2)).toBe('')
    expect(D.effortWords(2)).toBe('2 in the tank')
  })
  it('the no-legs line: why, then the plan\'s swap day (S3 Am.3, founder\'s words)', () => {
    expect(D.noLegsLine('quality', { day: 'tue', run: 'quality' })).toBe('No heavy legs today: your quality run is the day next to it. Lifting on Tuesday, after the run, would fit legs in.')
    expect(D.noLegsLine('long', { day: 'sat', run: null })).toBe('No heavy legs today: your long run is the day next to it. Lifting on Saturday would fit legs in.')
    expect(D.noLegsLine(null, null)).toBe('No heavy legs today.')
  })
  it('titles never say "+ core"', () => {
    expect(Object.values(D.STRENGTH_KIND_TITLE).join(' ')).not.toMatch(/core/i)
  })
  it('🔴 no em dash in any runner-facing strength string', () => {
    const strings = [
      ...Object.values(D.STRENGTH_KIND_TITLE), ...Object.values(D.STRENGTH_PART_TITLE), D.STRENGTH_NEW_LIFTS_LINE, D.STRENGTH_SUPERSET_LINK, D.noLegsLine('quality', { day: 'tue', run: 'quality' }), D.STRENGTH_AFTER_RUN_LINE, D.STRENGTH_HERO_ADVERB,
      ...Object.values(D.EQUIPMENT_LABEL), Doors.STRENGTH_TITLE, Doors.STRENGTH_SUB_UNSET, Doors.STRENGTH_SCREEN_SUB,
      Doors.strengthSubtitle({ sessions_per_week: 2, session_minutes: 45, focus: 'running' }),
      ...JSON.stringify(D.STRENGTH_SETUP).split('"'), D.STRENGTH_SETUP.injuriesNote(['knee']),
    ]
    expect(strings.filter(s => s.includes('—'))).toEqual([])
  })
  it('strengthOnDate finds the session on a date and nothing else', () => {
    const plan = { weeks: [{ sessions: [{ date: '2026-11-03' }] }] } as never
    expect(D.strengthOnDate(plan, '2026-11-03')).toMatchObject({ date: '2026-11-03' })
    expect(D.strengthOnDate(plan, '2026-11-04')).toBeNull()
    expect(D.strengthOnDate(null, '2026-11-03')).toBeNull()
  })
})
