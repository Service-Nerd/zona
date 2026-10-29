import { describe, it, expect } from 'vitest'
import harness from '@/components/dashboard/__fixtures__/harnessPlan.json'
import type { Plan } from '@/types/plan'
import { getSessionsForDate, parseLocalDate } from '@/lib/plan/weekResolution'
import { isHardEffort, isLongRun } from '@/lib/plan/sessionRole'
import { hardRunBeside } from './hardRunBeside'

/** S3 Am.3 (STRENGTH-SESSION-PARTS-01) — the hard run beside a strength day, read from the plan the runner will run. */
const plan = harness as unknown as Plan
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const shift = (date: string, n: number) => { const d = parseLocalDate(date); d.setDate(d.getDate() + n); return iso(d) }
const at = (date: string) => getSessionsForDate(plan.weeks, parseLocalDate(date)).map(r => r.session)
const days = plan.weeks.flatMap(w => Array.from({ length: 7 }, (_, k) => shift(w.date, k)))

describe('hardRunBeside', () => {
  it('names the long run, and a quality run, the day after; nothing when both neighbours are easy', () => {
    const beforeLong = days.find(d => at(shift(d, 1)).some(isLongRun) && !at(shift(d, 1)).some(isHardEffort))!
    const beforeQuality = days.find(d => at(shift(d, 1)).some(isHardEffort) && !at(shift(d, 1)).some(isLongRun))!
    const calm = days.find(d => [1, -1].every(o => !at(shift(d, o)).some(s => isLongRun(s) || isHardEffort(s))))!
    expect([beforeLong, beforeQuality, calm].every(Boolean)).toBe(true)
    expect(hardRunBeside(plan.weeks, [], beforeLong)).toBe('long')
    expect(hardRunBeside(plan.weeks, [], beforeQuality)).toBe('quality')
    expect(hardRunBeside(plan.weeks, [], calm)).toBeNull()
  })
  it('🔴 a race beside the day is not called a quality run: runRoleOf classifies, as placement does', () => {
    const w = plan.weeks[0]
    const race = { ...plan, weeks: [{ ...w, sessions: { ...w.sessions, tue: { ...(w.sessions as Record<string, unknown>).tue as object, type: 'race', label: 'Race' } } }, ...plan.weeks.slice(1)] } as unknown as Plan
    const mon = w.date
    if (at(shift(mon, -1)).some(s => isLongRun(s) || isHardEffort(s))) return
    expect(hardRunBeside(race.weeks, [], mon)).toBeNull()
  })
  it('the day before counts too (S2 keeps heavy legs off both)', () => {
    const afterLong = days.find(d => at(shift(d, -1)).some(isLongRun) && !at(shift(d, 1)).some(s => isLongRun(s) || isHardEffort(s)))!
    expect(hardRunBeside(plan.weeks, [], afterLong)).toBe('long')
  })
  it('🔴 reads the runner\'s moves: a long run moved away is no longer beside the day', () => {
    expect.hasAssertions()
    const w = plan.weeks.find(x => Object.values(x.sessions).some(s => s && isLongRun(s as never)))!
    const longDay = (Object.entries(w.sessions).find(([, s]) => s && isLongRun(s as never)) as [string, unknown])[0]
    const keys = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']
    const longDate = shift(w.date, keys.indexOf(longDay))
    const before = shift(longDate, -1)
    if (at(shift(before, -1)).some(s => isLongRun(s) || isHardEffort(s))) return
    expect(hardRunBeside(plan.weeks, [], before)).toBe('long')
    const away = keys[(keys.indexOf(longDay) + 3) % 7]
    const moved = hardRunBeside(plan.weeks, [{ week_n: w.n, original_day: longDay, new_day: away }] as never, before)
    expect(moved).not.toBe('long')
  })
})
