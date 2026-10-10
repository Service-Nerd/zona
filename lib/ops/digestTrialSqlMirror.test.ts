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

/**
 * The Q2B SQL as the runbook records it. Q2B is the "WHO, not how many" query and
 * its WHERE is a SECOND hand-written copy of the trial predicate — ungated until
 * 2026-10-10, so Q2 was locked to the lib while Q2B could drift on its own. That
 * is the `deloadCadence` / `tierResolution` class this file's own header names.
 */
function q2bSql(): string {
  const src = readFileSync(RUNBOOK, 'utf8')
  const h = src.indexOf('## Q2B — WHO, not how many')
  if (h < 0) return ''
  const open = src.indexOf('```sql', h)
  const close = src.indexOf('```', open + 6)
  if (open < 0 || close < 0) return ''
  return src.slice(open + 6, close)
}

/**
 * The STEP 3 prose the live prompt carries, as recorded in the runbook: the
 * blockquote under § "What the live prompt carries AROUND Q2B".
 *
 * 🔴 WHY THE PROSE IS GATED AT ALL. The SQL was correct on every attempt and the
 * INSTRUCTION INTERPRETING IT WAS WRONG TWICE — it told the digest to render
 * Q2B's rows as the at-risk list (they are the whole cohort, so a 4× overstatement)
 * and defined at risk as `days_quiet >= 3`, which the `-1` sentinel fails. Neither
 * was visible on the page; both were obvious on the first run. A rule in a prompt
 * is not a constraint, so the two properties it must carry are asserted here.
 */
function step3Prose(): string {
  const src = readFileSync(RUNBOOK, 'utf8')
  const h = src.indexOf('**The settled wording, which `digestTrialSqlMirror.test.ts` now pins')
  if (h < 0) return ''
  const start = src.indexOf('> WHEN at_risk_trialing', h)
  if (start < 0) return ''
  const end = src.indexOf('\n\n', start)
  return (end < 0 ? src.slice(start) : src.slice(start, end))
    .split('\n').map(l => (l.startsWith('> ') ? l.slice(2) : l.replace(/^>/, ''))).join(' ')
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

// ─────────────────────────────────────────────────────────────────────────────
// Q2B — the second copy of the predicate, and the prose that reads its rows.
// ─────────────────────────────────────────────────────────────────────────────
describe('the digest Q2B cohort SQL and its rendering rule', () => {
  // ⚠️ VACUITY FIRST. Both readers return '' when the runbook headings move, and
  // an empty string passes a surprising number of plausible assertions.
  it('finds the Q2B SQL and the recorded STEP 3 prose at all', () => {
    expect(q2bSql()).not.toBe('')
    expect(q2bSql()).toContain('with sig as (')
    expect(step3Prose()).not.toBe('')
    expect(step3Prose()).toContain('at_risk_trialing')
  })

  // 🔴 THE DRIFT THIS GATE EXISTS FOR. Q2B must select the SAME cohort as Q2's
  // `trial` CTE. Compared clause by clause on whitespace-stripped SQL, so a
  // reformat does not go red and a changed predicate does.
  it("selects the same cohort as Q2's trial CTE, clause for clause", () => {
    const squash = (s: string) => s.replace(/\s+/g, '')
    const a = squash(trialCte())
    const b = squash(q2bSql())
    const clauses = [
      `us.trial_started_at>now()-interval'${TRIAL_DAYS}days'`,
      'coalesce(us.is_admin,false)=false',
      "s.statusin('trialing','active')",
      's.current_period_end>now()',
      'cc.claimed_by=us.id',
      'cc.expires_at>now()',
    ]
    for (const c of clauses) {
      expect(a, `Q2 trial CTE lost: ${c}`).toContain(c)
      expect(b, `Q2B lost: ${c}`).toContain(c)
    }
    // Neither may treat a NULL grant expiry as active — `isGrantActive` does not.
    expect(b).not.toMatch(/cc\.expires_at\s+is\s+null/)
  })

  // 🔴 DEFECT 1, PINNED. Q2B is the COHORT query, and the prose must say so.
  // If anyone adds the at-risk filter to Q2B, this goes red and the prose has to
  // change with it — the two cannot drift apart silently again.
  it('is unfiltered, and the prose says so rather than calling the rows at-risk', () => {
    expect(
      q2bSql().replace(/\s+/g, ''),
      'Q2B must NOT filter to at-risk — it is the cohort query the prose describes',
    ).not.toContain(`interval'${AT_RISK_NO_ACTIVITY_DAYS}days'`)
    const prose = step3Prose()
    expect(prose, 'prose must state Q2B returns the whole cohort').toMatch(/WHOLE TRIAL COHORT/)
    expect(prose, 'prose must state the at-risk rows reconcile to the count').toMatch(
      /MUST EQUAL at_risk_trialing/,
    )
  })

  // 🔴 DEFECT 2, PINNED. `-1` is a SENTINEL and FAILS `>= 3`. The prose must
  // name both arms, or the worst case is dropped by the only rule naming it.
  it('defines at-risk as >= 3 OR the -1 sentinel, never >= 3 alone', () => {
    const prose = step3Prose()
    expect(prose, 'the sentinel must be produced by the SQL').toBeTruthy()
    expect(q2bSql().replace(/\s+/g, ''), 'Q2B must emit -1 for no signal').toContain(
      ',-1)asdays_quiet',
    )
    expect(prose, `at-risk must admit the sentinel, not just >= ${AT_RISK_NO_ACTIVITY_DAYS}`)
      .toMatch(
        new RegExp(`days_quiet\\s*>=\\s*${AT_RISK_NO_ACTIVITY_DAYS}\\s*OR\\s*days_quiet\\s*=\\s*-1`),
      )
    expect(prose, 'the prose must say WHY -1 needs its own arm').toMatch(/FAILS a >= 3 test/)
  })

  // The lib agrees: a no-signal runner is at risk, so the prose and
  // `judgeTrialFunnel` cannot disagree about the sentinel.
  it('matches judgeTrialFunnel on the no-signal runner being at risk', () => {
    const now = new Date('2026-12-06T12:00:00Z')
    const v = judgeTrialFunnel(
      [{ user_id: 'nosignal', trialStartedAt: '2026-12-02T00:00:00Z', lastSeen: null }],
      now,
    )
    expect(v.onTrial).toBe(1)
    expect(v.atRisk).toBe(1)
    expect(v.atRiskUsers[0]?.daysQuiet ?? null).toBeNull()
  })

  // ⚠️ The standing instruction is zero contact. The prose that reaches a model
  // every morning must carry it, or the model will helpfully draft an email.
  it('tells the digest this is an observation list, never an outreach list', () => {
    expect(step3Prose()).toMatch(/OBSERVATION list, never an outreach list/)
  })
})
