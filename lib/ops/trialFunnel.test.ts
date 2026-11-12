import { describe, it, expect } from 'vitest'
import { judgeTrialFunnel, AT_RISK_NO_ACTIVITY_DAYS } from './trialFunnel'
import { TRIAL_DAYS, TRIAL_MAX_DAYS_FROM_START, isTrialActive } from '@/lib/trial'

// The BOUNDARIES, which the SQL mirror test cannot reach: the mirror proves the
// two producers describe the same rule, not that the rule is right at its edges.

const NOW = new Date('2026-10-09T18:00:00Z')
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 86_400_000).toISOString()

describe('judgeTrialFunnel — the two windows, at their edges', () => {
  it('🔴 the trial window follows the OWNER, and the owner changed on 2026-11-12', () => {
    // 🔴 THIS ARM ASSERTED A 14-DAY BOUNDARY FROM THE SIGNUP STAMP AND IT WENT RED WHEN THE
    // FOUNDER TURNED `TRIAL_STARTS_AT_FIRST_READ` ON. **That is honest signal, not noise**, and
    // the comment that stood here predicted it: a runner with no read is on trial for LONGER
    // under the new policy, so the funnel's `onTrial` genuinely moves. Re-read rather than
    // silenced, as that comment asked.
    //
    // ⚠️ THE CONSEQUENCE IS AN OPS ONE AND IT IS WORTH STATING: a `TrialFunnelRow` that carries
    // no `firstReadAt` resolves on the CAP path, so `onTrial` now counts runners up to
    // `TRIAL_MAX_DAYS_FROM_START` days old rather than `TRIAL_DAYS`. **The digest's trial count
    // will step up the day this ships, and that is the policy working, not a defect.** A
    // producer that supplies `firstReadAt` gets the real per-runner window instead.
    const noRead = (d: number) => judgeTrialFunnel([{ user_id: 'a', trialStartedAt: daysAgo(d) }], NOW).onTrial

    // Pinned against the owner, so a change to `isTrialActive` moves both.
    expect(isTrialActive(daysAgo(TRIAL_MAX_DAYS_FROM_START), NOW)).toBe(false)
    expect(isTrialActive(daysAgo(TRIAL_MAX_DAYS_FROM_START - 0.5), NOW)).toBe(true)
    expect(noRead(TRIAL_MAX_DAYS_FROM_START)).toBe(0)
    expect(noRead(TRIAL_MAX_DAYS_FROM_START - 1)).toBe(1)

    // The old boundary is now INSIDE the window rather than the edge of it — the step that
    // moves the metric, asserted so a future change to the cap is visible here too.
    expect(noRead(TRIAL_DAYS)).toBe(1)

    // And a row that DOES carry a first read gets that runner's own window, not the cap.
    const withRead = judgeTrialFunnel(
      [{ user_id: 'a', trialStartedAt: daysAgo(20), firstReadAt: daysAgo(19) }], NOW).onTrial
    expect(withRead, 'read on day 1 of 20 ago: the 14 days ran out five days ago').toBe(0)
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
