import { describe, it, expect } from 'vitest'
import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { resolveEffectiveSessions } from './effectiveSessions'

/**
 * SESSION-SLOTS-01 Phase 0 — ONE owner of "which sessions are on which day this week".
 *
 * Today and Plan each built their own copy, and both did `map[newDay] = session`, which
 * overwrites whatever already sits on that day: the collision the owner was fixed for
 * (EFFSESS-COLLISION-01) and the copies never were. They are the first thing AM/PM slots would
 * break. The population is every source file, never a hand-typed list.
 */
const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').split('\n').map(l => l.replace(/\/\/.*$/, '')).join('\n')
const files = execSync('git ls-files app lib components packages', { encoding: 'utf8' }).split('\n')
  .filter(f => /\.(ts|tsx)$/.test(f) && !f.includes('.test.') && f !== 'lib/plan/effectiveSessions.ts')

describe('the effective week has one owner', () => {
  it('the population is real', () => { expect(files.length).toBeGreaterThan(300) })
  it('🔴 no file outside the owner places a session on an override\'s target day by hand', () => {
    // The shape of a hand-rolled copy: indexing a map by an override's new day and assigning.
    const shape = /\[\s*(?:o\.new_day|newDay|new_day)\s*(?:as [A-Za-z]+\s*)?\]\s*=(?!=)/
    const offenders = files.filter(f => shape.test(strip(readFileSync(f, 'utf8'))))
    expect(offenders, 'route through resolveEffectiveSessions').toEqual([])
  })
  it('Today and Plan call the owner', () => {
    for (const f of ['components/dashboard/TodayScreen.tsx', 'components/training/PlanCalendar.tsx']) {
      expect(strip(readFileSync(f, 'utf8')), f).toMatch(/resolveEffectiveSessions\(/)
    }
  })
  it('🔴 and the owner keeps both sessions where a hand-rolled copy dropped one', () => {
    // A completed Wednesday session, and Tuesday's run moved onto Wednesday one-sidedly.
    const week = { sessions: { tue: { type: 'easy', label: 'Tue' }, wed: { type: 'easy', label: 'Wed' } } } as never
    const eff = resolveEffectiveSessions(week, [{ week_n: 1, original_day: 'tue', new_day: 'wed' }] as never)
    const labels = Object.values(eff).map(e => (e!.session as { label: string }).label).sort()
    expect(labels).toEqual(['Tue', 'Wed'])
  })
})
