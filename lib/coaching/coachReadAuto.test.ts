// COACH-READ-AUTO-01 + COACH-READ-BUTTON-01 — Kit's weekly read writes and updates itself; there is no button
// (SLT 2026-10-30; founder chose Option A from the mockup the same day).
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { coachReadAction } from './coachRead'

const base = { ready: true, reportIsCurrent: true, generatedAt: '2026-10-28T08:00:00Z', runStarts: ['2026-10-27T07:00:00Z'] }

describe('coachReadAction', () => {
  it('🔴 never for a runner whose honest state is an empty one', () => {
    expect(coachReadAction({ ...base, ready: false, reportIsCurrent: false })).toBe('none')
  })
  it('writes the read when this week has none', () => {
    expect(coachReadAction({ ...base, reportIsCurrent: false })).toBe('write')
  })
  it('🔴 updates it once a run has started after it was written', () => {
    expect(coachReadAction({ ...base, runStarts: ['2026-10-27T07:00:00Z', '2026-10-29T07:00:00Z'] })).toBe('update')
  })
  it('leaves a current read alone when nothing has happened since', () => {
    expect(coachReadAction(base)).toBe('none')
    expect(coachReadAction({ ...base, runStarts: ['2026-10-28T08:00:00Z'] })).toBe('none')
  })
  it('a read with no timestamp is not rewritten blindly', () => {
    expect(coachReadAction({ ...base, generatedAt: null, runStarts: ['2026-10-29T07:00:00Z'] })).toBe('none')
  })
})

describe('Coach wiring', () => {
  const shell = readFileSync('app/dashboard/DashboardClient.tsx', 'utf8')
  const coach = shell.slice(shell.indexOf('function CoachScreen('))
  it('the effect asks the owner and maps update → force, write → cached', () => {
    expect(coach).toContain('const action = coachReadAction({')
    expect(coach).toContain("void generateReport(action === 'update')")
    expect(shell).toContain("fresh ? '/api/weekly-report?force=true' : '/api/weekly-report'")
  })
  it('🔴 no Refresh or Generate report button on the card', () => {
    expect(coach).not.toMatch(/'Refresh'|'Generate report'|Generate a report|Already refreshed today/)
    expect(coach).not.toContain('onClick={() => void generateReport(')
  })
  it('a failed update keeps the read; only a missing read shows the error', () => {
    expect(coach).toContain("if (!fresh) setError(")
  })
})
