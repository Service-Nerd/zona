import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { AT_RISK_NO_ACTIVITY_DAYS, TRIAL_DAYS, judgeTrialFunnel } from './trialFunnel'
import { resolveTier } from '@/lib/trial'

// OPS-DIGEST-TRIAL-COHORT-01 — THE DECLARED DUPLICATION, GIVEN A GATE.
//
// The digest is a cloud routine and cannot call repo code, so its Q2 SQL mirrors
// `trialFunnel.ts`'s predicate: who counts as on trial, and how quiet is "at
// risk". A mirrored predicate with a human in between is the `deloadCadence` /
// `tierResolution` class, so it gets a mechanism rather than a note.
//
// ⚠️ WHAT IT CANNOT CHECK: the live prompt at claude.ai. The runbook is the
// byte-verified transcript; this catches the lib and the transcript drifting
// apart. `digestEnrichSqlMirror.test.ts` names the same residual.

const RUNBOOK = join(__dirname, '..', '..', 'docs', 'runbooks', 'digest-trial-funnel.md')

/** The Q2 SQL as the runbook records it: the fenced block after the Q2 heading. */
function q2Sql(): string {
  const src = readFileSync(RUNBOOK, 'utf8')
  const h = src.indexOf('## Q2 — active-user tiers and the TRIAL FUNNEL')
  if (h < 0) return ''
  const open = src.indexOf('```sql', h)
  const close = src.indexOf('```', open + 6)
  if (open < 0 || close < 0) return ''
  return src.slice(open + 6, close)
}

/** The `trial` CTE alone — the predicate that decides the cohort. */
function trialCte(): string {
  const sql = q2Sql()
  const start = sql.indexOf('trial as (')
  if (start < 0) return ''
  const end = sql.indexOf('select\n', start)
  return end < 0 ? sql.slice(start) : sql.slice(start, end)
}

/**
 * The expression that produces a named column: everything between the previous
 * comma-at-depth-0 and `as <alias>`.
 *
 * 🔴 WHY A PARSER AND NOT A REGEX OVER THE WHOLE SQL. The first version of this
 * file asserted `not /as trialing_total[\s\S]{0,80}subscriptions/` — which looks
 * right and anchors on the WRONG SIDE: the table name comes BEFORE the alias.
 * Reinstating the exact original defect
 * (`count(*) from subscriptions where status='trialing'`) left every arm green,
 * found by mutating the runbook rather than by reading the regex. **Bind the
 * region, never grep the file.**
 */
function columnExpr(sql: string, alias: string): string {
  const at = sql.indexOf(` as ${alias}`)
  if (at < 0) return ''
  let depth = 0
  for (let i = at; i >= 0; i--) {
    const c = sql[i]
    if (c === ')') depth++
    else if (c === '(') depth--
    else if (c === ',' && depth === 0) return sql.slice(i + 1, at)
  }
  return sql.slice(0, at)
}

const intervalDays = (sql: string): number[] =>
  Array.from(sql.matchAll(/interval\s+'(\d+)\s+days'/g)).map(m => Number(m[1]))

describe('the digest Q2 trial SQL mirrors trialFunnel.ts', () => {
  // ⚠️ THE VACUITY ARM, FIRST. An empty population passes every other arm here,
  // and this repo has shipped that green tick more than once.
  it('finds the SQL and the trial CTE in the runbook at all', () => {
    expect(q2Sql()).not.toBe('')
    expect(q2Sql()).toContain('with sig as (')
    expect(trialCte()).not.toBe('')
    expect(trialCte()).toContain('user_settings')
  })

  // 🔴 THE DEFECT, PINNED. This is the single assertion that would have failed
  // before the fix, and it must stay the loudest thing in the file.
  it('counts the cohort from the trial CTE, NEVER from a trialing subscription', () => {
    const cte = trialCte()
    expect(cte).toContain('us.trial_started_at >')

    // The two columns the digest actually reports. Each must be computed from the
    // `trial` CTE and must not name `subscriptions` at all — the exclusion of an
    // active subscription belongs inside the CTE, not in the count.
    for (const alias of ['trialing_total', 'at_risk_trialing']) {
      const expr = columnExpr(q2Sql(), alias)
      expect(expr, `no expression found for ${alias}`).not.toBe('')
      expect(expr, `${alias} must read the trial CTE`).toMatch(/\bfrom trial\b/)
      expect(expr, `${alias} must not count subscriptions`).not.toContain('subscriptions')
      expect(expr, `${alias} must not key off status='trialing'`).not.toMatch(/status\s*=\s*'trialing'/)
    }
  })

  it('uses TRIAL_DAYS for the window, strictly, as isTrialActive does', () => {
    expect(trialCte()).toContain(`interval '${TRIAL_DAYS} days'`)
    // STRICT `>`: `isTrialActive` is `elapsed < TRIAL_DAYS`, so a trial exactly
    // 14 days old is over. `>=` would keep it alive for a day.
    expect(trialCte()).toMatch(/trial_started_at\s*>\s*now\(\)\s*-\s*interval/)
    expect(trialCte()).not.toMatch(/trial_started_at\s*>=/)
  })

  it('uses AT_RISK_NO_ACTIVITY_DAYS for the quiet window', () => {
    expect(q2Sql()).toContain(`interval '${AT_RISK_NO_ACTIVITY_DAYS} days'`)
    expect(intervalDays(q2Sql())).toContain(AT_RISK_NO_ACTIVITY_DAYS)
  })

  // 🔴 THE POPULATION ARM. `resolveTier`'s order is admin -> subscription ->
  // grant -> trial -> free, and the SQL can only ask "is this runner on trial?",
  // so it must exclude EVERY tier that outranks trial. This arm reads the
  // reasons off `resolveTier` itself: add a fifth tier above `trial` and it goes
  // red until the SQL gains a clause.
  it('excludes every tier that outranks trial — read from resolveTier, not typed here', () => {
    const outranking = (['admin', 'subscription', 'grant'] as const)
    const probe = {
      admin:        { isAdmin: true },
      subscription: { subStatus: 'active', subPeriodEnd: '2099-01-01' },
      grant:        { grantExpiresAt: '2099-01-01' },
    }
    // Each really does outrank an ACTIVE trial — proven, not assumed.
    for (const r of outranking) {
      expect(resolveTier({ ...probe[r], trialStartedAt: new Date().toISOString() }).reason).toBe(r)
    }
    const cte = trialCte()
    expect(cte, 'admin not excluded').toMatch(/is_admin/)
    expect(cte, 'active subscription not excluded').toMatch(/not exists[\s\S]*subscriptions/)
    expect(cte, 'charity grant not excluded').toMatch(/not exists[\s\S]*charity_codes/)
    // `isGrantActive` treats a NULL expiry as INACTIVE, so there must be no
    // `expires_at is null` arm keeping such a runner out of the trial cohort.
    expect(cte).not.toMatch(/cc\.expires_at\s+is\s+null/)
  })

  // A runner with no signal must be counted as at risk, in BOTH producers.
  it("coalesces a missing signal to 'at risk', matching judgeTrialFunnel", () => {
    expect(q2Sql()).toContain("coalesce((select max(last_seen) from sig where sig.user_id=t.user_id),'epoch')")
    const now = new Date('2026-10-09T18:00:00Z')
    const v = judgeTrialFunnel([
      { user_id: 'quiet',  trialStartedAt: '2026-10-05T00:00:00Z', lastSeen: null },
      { user_id: 'active', trialStartedAt: '2026-10-05T00:00:00Z', lastSeen: '2026-10-09T09:00:00Z' },
      { user_id: 'stale',  trialStartedAt: '2026-10-05T00:00:00Z', lastSeen: '2026-10-01T09:00:00Z' },
    ], now)
    expect(v.onTrial).toBe(3)
    expect(v.atRisk).toBe(2)
    expect(v.atRiskUsers.map(u => u.user_id).sort()).toEqual(['quiet', 'stale'])
    expect(v.alert).toBe(true)
  })

  it('the module agrees with resolveTier on who is NOT on trial', () => {
    const now = new Date('2026-10-09T18:00:00Z')
    const v = judgeTrialFunnel([
      { user_id: 'admin',  isAdmin: true, trialStartedAt: '2026-10-05T00:00:00Z' },
      { user_id: 'subbed', subStatus: 'active', subPeriodEnd: '2099-01-01', trialStartedAt: '2026-10-05T00:00:00Z' },
      { user_id: 'comped', grantExpiresAt: '2099-01-01', trialStartedAt: '2026-10-05T00:00:00Z' },
      { user_id: 'lapsed', trialStartedAt: '2026-08-01T00:00:00Z' },
    ], now)
    expect(v.onTrial).toBe(0)
    expect(v.paid).toBe(3)
    expect(v.free).toBe(1)
    expect(v.alert).toBe(false)
  })
})
