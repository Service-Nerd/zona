import { describe, it, expect } from 'vitest'
import * as D from './display'
import * as Doors from '@/components/shared/meDoors'
import type { Prescription } from '@/packages/strength'

/** STRENGTH-APP-01 — the one owner of strength copy. `noEmDashApp` scans components/ and app/dashboard; this lives in lib/, so it guards itself. */
const p = (x: Partial<Prescription>): Prescription => ({ exercise_id: 'goblet_squat', sets: 3, rir: 2, rest_s: 90, per_side: false, ...x })

describe('strength display strings', () => {
  it('dose lines', () => {
    expect(D.doseLine(p({ reps: 5 }))).toBe('3 × 5')
    expect(D.doseLine(p({ seconds: 30 }))).toBe('3 × 30 s')
    expect(D.doseLine(p({ sets: 1, reps: 8 }))).toBe('8')
    expect(D.doseLine(p({ contacts: 10 }))).toBe('3 × 10 contacts')
  })
  it('effort line drops what is not there', () => {
    expect(D.effortLine(p({ reps: 5, per_side: true }))).toBe('each side · 2 reps in reserve · rest 1:30 min')
    expect(D.effortLine(p({ reps: 8, rir: null, rest_s: 0 }))).toBe('')
  })
  it('titles never say "+ core"', () => {
    expect(Object.values(D.STRENGTH_KIND_TITLE).join(' ')).not.toMatch(/core/i)
  })
  it('🔴 no em dash in any runner-facing strength string', () => {
    const strings = [
      ...Object.values(D.STRENGTH_KIND_TITLE), ...Object.values(D.STRENGTH_BLOCK_TITLE), D.STRENGTH_AFTER_RUN_LINE, D.STRENGTH_HERO_ADVERB,
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
