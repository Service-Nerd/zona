import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { showsStrengthInvite } from './restInvite'

/** STRENGTH-ENTRY-01 — the rest card's strength line, at most once a week. */
const week = [
  { displayKey: 'mon', type: 'easy' }, { displayKey: 'tue', type: 'rest' }, { displayKey: 'wed', type: 'quality' },
  { displayKey: 'thu', type: 'rest' }, { displayKey: 'fri', type: 'easy' }, { displayKey: 'sat', type: 'rest' },
  { displayKey: 'sun', type: 'easy' },
]

describe('showsStrengthInvite', () => {
  it('on the week\'s first rest day', () => { expect(showsStrengthInvite(week, 'tue')).toBe(true) })
  it('🔴 on no other rest day, so it is said once a week', () => {
    expect(week.filter(e => showsStrengthInvite(week, e.displayKey)).map(e => e.displayKey)).toEqual(['tue'])
  })
  it('never on a run day, a week with no rest, or with nothing selected', () => {
    expect(showsStrengthInvite(week, 'mon')).toBe(false)
    expect(showsStrengthInvite(week.map(e => ({ ...e, type: 'easy' })), 'tue')).toBe(false)
    expect(showsStrengthInvite(week, null)).toBe(false)
  })
  it('Today decides through this owner, and only for a runner without strength', () => {
    const today = readFileSync('components/dashboard/TodayScreen.tsx', 'utf8')
    expect(today).toMatch(/onStrengthInvite=\{onStrengthInvite && showsStrengthInvite\(sessions, selectedKey\) \? onStrengthInvite : undefined\}/)
    const dash = readFileSync('app/dashboard/DashboardClient.tsx', 'utf8')
    expect(dash).toMatch(/onStrengthInvite=\{strength\.status === 'none' \? \(\) => openStrengthSetup\('today'\) : undefined\}/)
  })
})
