import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { SessionSchema } from '@/lib/plan/schema'
import { checkAdjustmentTriggers, type AdjustmentCheckInput } from '@/lib/coaching/planAdjustment'
import { applyAdjustmentDays } from '@/lib/coaching/applyAdjustmentDays'
import { isEasedForRecovery, RECENT_CHANGES_FILTER, EASED_FOR_RECOVERY_LABEL } from './easedMark'
import type { Session, Week } from '@/types/plan'

/**
 * 🔴 READINESS-SURFACE-01 item 3 — "Eased for recovery" (Design Board, 2026-10-17).
 * The fact lives on the session, stamped by the readiness producer, so it must (1) survive the
 * schema on save, (2) be stamped on exactly the session the ease changed, (3) leave with a revert,
 * and (4) reach "Changed this week" for confirmed recovery eases only.
 */
const s = (type: Session['type'], extra: Partial<Session> = {}): Session => ({ type, label: type, detail: null, distance_km: 8, ...extra }) as Session
const WEEK: Session[] = [s('easy'), s('quality'), s('rest'), s('tempo'), s('rest'), s('easy', { role: 'long_run', distance_km: 18 }), s('rest')]
function input(day: string, sessionType: string): AdjustmentCheckInput {
  return {
    currentWeekN: 3, totalWeeks: 12, currentWeekSessions: WEEK.map(x => ({ ...x })),
    linkedKm: 0, offPlanKm: 0, plannedKm: 8, priorWeeksKm: [], hrInZoneData: [], efTrendPct: null,
    adjustmentsThisWeek: 0, currentPhase: 'build',
    readinessSignal: { sessionType, sessionDay: day, isElevatedRHR: false, isLowHRV: true, isShortSleep: false,
      isPoorSleepQuality: false, softeningWarranted: true, hasBaseline: true },
  } as AdjustmentCheckInput
}
const DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']

describe('the stamp', () => {
  it('survives the plan schema (an unknown key would be stripped, the control shows it)', () => {
    const parsed = SessionSchema.parse({ ...s('easy'), eased_for: 'recovery', not_in_schema: true })
    expect(parsed.eased_for).toBe('recovery')
    expect((parsed as Record<string, unknown>).not_in_schema).toBeUndefined()
  })
  it('a quality ease stamps exactly the eased session, nothing else in the week', () => {
    const adj = checkAdjustmentTriggers(input('tue', 'quality'))!
    const stamped = adj.sessionsAfter.map((x, i) => isEasedForRecovery(x) ? DAYS[i] : null).filter(Boolean)
    expect(stamped).toEqual(['tue'])
    expect(adj.sessionsBefore.some(isEasedForRecovery)).toBe(false)
  })
  it('a long-run trim stamps the long run', () => {
    const adj = checkAdjustmentTriggers(input('sat', 'long'))!
    expect(adj.sessionsAfter.map((x, i) => isEasedForRecovery(x) ? DAYS[i] : null).filter(Boolean)).toEqual(['sat'])
  })
  it('🔴 confirm writes the mark into the plan; revert removes it', () => {
    const adj = checkAdjustmentTriggers(input('tue', 'quality'))!
    const week = { n: 3, sessions: Object.fromEntries(WEEK.map((x, i) => [DAYS[i], { ...x }])) } as unknown as Week
    expect(applyAdjustmentDays(week, adj.sessionsBefore, adj.sessionsAfter).ok).toBe(true)
    expect(isEasedForRecovery(week.sessions.tue)).toBe(true)
    expect(applyAdjustmentDays(week, adj.sessionsAfter, adj.sessionsBefore).ok).toBe(true)
    expect(isEasedForRecovery(week.sessions.tue)).toBe(false)
  })
})

describe('"Changed this week"', () => {
  it('lists silent changes and CONFIRMED recovery eases, nothing else', () => {
    expect(RECENT_CHANGES_FILTER).toBe('status.eq.auto_applied,and(status.eq.confirmed,trigger_type.eq.readiness_signal)')
    const src = readFileSync('app/dashboard/DashboardClient.tsx', 'utf8')
    expect(src).toMatch(/\.or\(RECENT_CHANGES_FILTER\)/)
    expect(src).not.toMatch(/\.eq\('status', 'auto_applied'\)/)
  })
  it('the words are the ruling\'s', () => {
    expect(EASED_FOR_RECOVERY_LABEL).toBe('Eased for recovery')
  })
})
