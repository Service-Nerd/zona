// COACH-READ-AUTO-01 — the week's read arrives on opening Coach, without a tap (SLT 2026-10-30).
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

const shell = readFileSync('app/dashboard/DashboardClient.tsx', 'utf8')
const i = shell.indexOf('const autoReadTried = useRef(false)')
const effect = shell.slice(i, shell.indexOf('async function generateReport', i))

describe('COACH-READ-AUTO-01', () => {
  it('exists, inside Coach', () => {
    expect(i).toBeGreaterThan(shell.indexOf('function CoachScreen('))
  })
  it('asks only when this week has no read, once per mount', () => {
    expect(effect).toMatch(/if \(autoReadTried\.current \|\| reportIsCurrent \|\| loading\) return/)
    expect(effect).toMatch(/autoReadTried\.current = true/)
  })
  it('🔴 never for a runner whose honest state is an empty one: same gate as the card (source, runs, heart rate)', () => {
    expect(effect).toMatch(/if \(!\(stravaConnected \|\| healthkitConnectedAt\) \|\| !runs\?\.length \|\| !restingHR \|\| !maxHR\) return/)
  })
  it('uses the cached path (no force), so at most one model call per runner per week', () => {
    expect(effect).toContain('void generateReport(false)')
    expect(shell).toContain("fresh ? '/api/weekly-report?force=true' : '/api/weekly-report'")
  })
  it('the Refresh button still regenerates', () => {
    expect(shell).toContain('onClick={() => void generateReport(true)}')
  })
})
