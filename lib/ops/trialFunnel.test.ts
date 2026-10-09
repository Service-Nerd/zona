import { describe, it, expect } from 'vitest'
import { judgeTrialFunnel, AT_RISK_NO_ACTIVITY_DAYS } from './trialFunnel'
import { TRIAL_DAYS, isTrialActive } from '@/lib/trial'

// The BOUNDARIES, which the SQL mirror test cannot reach: the mirror proves the
// two producers describe the same rule, not that the rule is right at its edges.

const NOW = new Date('2026-10-09T18:00:00Z')
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 86_400_000).toISOString()

describe('judgeTrialFunnel — the two windows, at their edges', () => {
  it('the trial window is exclusive at exactly TRIAL_DAYS, as isTrialActive is', () => {
    // Pinned against the owner, so a change to `isTrialActive` moves both.
    expect(isTrialActive(daysAgo(TRIAL_DAYS), NOW)).toBe(false)
    expect(isTrialActive(daysAgo(TRIAL_DAYS - 0.5), NOW)).toBe(true)

    expect(judgeTrialFunnel([{ user_id: 'a', trialStartedAt: daysAgo(TRIAL_DAYS) }], NOW).onTrial).toBe(0)
    expect(judgeTrialFunnel([{ user_id: 'a', trialStartedAt: daysAgo(TRIAL_DAYS - 1) }], NOW).onTrial).toBe(1)
  })

  it('at-risk is INCLUSIVE at exactly AT_RISK_NO_ACTIVITY_DAYS', () => {
    const on = (lastSeen: string) => judgeTrialFunnel(
      [{ user_id: 'a', trialStartedAt: daysAgo(5), lastSeen }], NOW)
    expect(on(daysAgo(AT_RISK_NO_ACTIVITY_DAYS)).atRisk).toBe(1)
    expect(on(daysAgo(AT_RISK_NO_ACTIVITY_DAYS - 1)).atRisk).toBe(0)
  })

  it('no trial_started_at at all is FREE, not trial — a null is not a start', () => {
    const v = judgeTrialFunnel([{ user_id: 'a', trialStartedAt: null }], NOW)
    expect(v.onTrial).toBe(0)
    expect(v.free).toBe(1)
  })

  // ⚠️ An empty fleet must not alert. An alert on nothing is how an alert stops
  // being read, and `alert` is a boolean so a vacuous true is invisible.
  it('an empty fleet reports zeros and does NOT alert', () => {
    const v = judgeTrialFunnel([], NOW)
    expect(v).toMatchObject({ onTrial: 0, atRisk: 0, paid: 0, free: 0, alert: false })
    expect(v.atRiskUsers).toEqual([])
  })

  it('every runner lands in exactly one bucket', () => {
    const rows = [
      { user_id: 'admin',  isAdmin: true },
      { user_id: 'sub',    subStatus: 'active', subPeriodEnd: '2099-01-01' },
      { user_id: 'comped', grantExpiresAt: '2099-01-01' },
      { user_id: 'trial',  trialStartedAt: daysAgo(2), lastSeen: daysAgo(0) },
      { user_id: 'quiet',  trialStartedAt: daysAgo(2) },
      { user_id: 'free',   trialStartedAt: daysAgo(99) },
    ]
    const v = judgeTrialFunnel(rows, NOW)
    expect(v.onTrial + v.paid + v.free).toBe(rows.length)
    expect(v).toMatchObject({ onTrial: 2, paid: 3, free: 1, atRisk: 1 })
    expect(v.atRiskUsers).toEqual([{ user_id: 'quiet', daysQuiet: null }])
  })
})
