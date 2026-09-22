// The five defects from the founder's app review, held shut.
//
// Every one of these was SILENT — no crash, no error, no log. That is this
// app's dominant failure mode, and a regression test is the only defence a
// silent bug has, because there is no symptom to notice next time.
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { sessionKmSelfPaced } from '@/lib/plan/sessionDistance'
import { sumRoundedDistance } from '@/lib/format'
import type { Session } from '@/types/plan'

const read = (f: string) => readFileSync(join(process.cwd(), f), 'utf8')
const strip = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/^\s*\/\/.*$/gm, '')

const SHELL = 'app/dashboard/DashboardClient.tsx'
const CAL = 'components/training/PlanCalendar.tsx'
const SHEET = 'components/shared/ModifyPlanSheet.tsx'

const duration = (mins: number, pace: string): Session =>
  ({ type: 'easy', label: 'Easy run', distance_km: null, duration_mins: mins, pace_target: pace } as unknown as Session)

describe('D2 + D3 — a duration-anchored week has a total', () => {
  it('🔴 FAILS BEFORE: reading `distance_km` sums a real week to ZERO', () => {
    // A beginner's plan is duration-anchored on 95.8% of sessions, so the old
    // expression produced 0 and the total — gated on `intendedKm > 0` — vanished.
    // That is BOTH founder reports: "some weeks show a total and some don't",
    // and "everything shows duration though my profile says distance".
    const week = [duration(45, '6:30–7:00 /km'), duration(60, '6:30–7:00 /km')]
    const oldWay = sumRoundedDistance(week.map(s => s.distance_km), 'km')
    expect(oldWay, 'the pre-fix expression').toBe(0)

    const nowWay = sumRoundedDistance(week.map(s => sessionKmSelfPaced(s)), 'km')
    expect(nowWay, 'the single owner resolves duration at the session pace').toBeGreaterThan(10)
  })

  it('both PlanCalendar sites go through the single owner', () => {
    // Fixing one and not the other is how five copies of the pace formatter
    // happened. There are exactly two.
    const src = strip(read(CAL))
    const viaOwner = Array.from(src.matchAll(/sessionDistances\s*=\s*Object\.values\(ws\)\.map\(.*sessionKmSelfPaced/g)).length
    expect(viaOwner, 'both week-total sites must use sessionKmSelfPaced').toBe(2)
    expect(src).not.toMatch(/sessionDistances[^\n]*s\?\.distance_km/)
  })

  it('and it returns NULL, never 0, when nothing resolves', () => {
    // `?? 0` asserts "this session covered no ground" — the exact defect behind
    // SESSION-KM-01/02. A caller with no pace must get null.
    expect(sessionKmSelfPaced({ type: 'easy', distance_km: null, duration_mins: 45 } as unknown as Session)).toBeNull()
  })
})

describe('D4 — back returns to where the session was opened from', () => {
  it('SessionScreen onBack is not hardcoded to today', () => {
    const src = strip(read(SHELL))
    const i = src.indexOf('<SessionScreen')
    expect(i, 'SessionScreen render moved — re-anchor').toBeGreaterThan(-1)
    const line = src.slice(i, src.indexOf('\n', i))
    expect(line).toContain('onBack={() => setScreen(sessionOrigin)}')
  })

  it('BOTH openers record the origin — a screen that does not set it inherits the last', () => {
    const src = strip(read(SHELL))
    expect(Array.from(src.matchAll(/setSessionOrigin\('today'\)/g)).length).toBe(1)
    expect(Array.from(src.matchAll(/setSessionOrigin\('plan'\)/g)).length).toBe(1)
  })
})

describe('D5 — the rings ask for access only when access is missing', () => {
  it('the reason reads CONNECTION, not whether runs exist', () => {
    // It read `runs?.length ? 'no-data' : 'not-linked'`, so a connected runner
    // with no run yet this week was told to connect. `healthkitConnectedAt` was
    // already on this screen.
    const src = strip(read(SHELL))
    const i = src.indexOf('reason={')
    expect(i).toBeGreaterThan(-1)
    const expr = src.slice(i, src.indexOf('}', i) + 1)
    expect(expr).toContain('healthkitConnectedAt')
    expect(expr, 'run COUNT does not tell you whether a source is linked').not.toContain('runs?.length')
  })
})

describe('D1 — the modify sheet shows its own failure and in-flight states', () => {
  it('the sheet RECEIVES busy and error', () => {
    const src = strip(read(SHELL))
    const i = src.indexOf('<ModifyPlanSheet')
    const block = src.slice(i, src.indexOf('/>', i))
    expect(block).toContain('busy={modifyBusy}')
    expect(block).toContain('error={modifyError}')
  })

  it('and RENDERS them — receiving a prop it ignores is the same bug', () => {
    const src = strip(read(SHEET))
    expect(src).toMatch(/\{error && \(/)
    expect(src).toMatch(/disabled=\{busy\}/)
    // `--warn`, never `--danger`: a designed 422 refusal is not an error state.
    const i = src.indexOf('{error && (')
    expect(src.slice(i, i + 320)).toContain('var(--warn)')
  })
})
