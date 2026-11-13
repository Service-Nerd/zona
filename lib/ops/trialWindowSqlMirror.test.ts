import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { TRIAL_DAYS, TRIAL_MAX_DAYS_FROM_START, TRIAL_EXTENSION_DAYS } from '@/lib/trial'
import { stripSqlComments } from './liveViewSql'

/**
 * OPS-TRIAL-SQL-CLOCK-01 — `public.trial_window_ends` is the ONE SQL mirror of
 * `lib/trial.ts → resolveTrialWindow`, and this is the gate that lets it exist.
 *
 * 🔴 WHY A MIRROR IS ALLOWED HERE AT ALL. D-16 forbids parallel semantics, and the item that
 * raised this called a SQL twin "D-16 one layer down". The distinction D-16 actually draws is
 * drift NOBODY SEES: the ops digest already mirrors `trialFunnel.ts` under
 * `digestTrialSqlMirror.test.ts`, and the funnel already carried a hand-written 14 under
 * `activationFunnel.test.ts`. What changed is the COUNT — eight hand-written windows became one
 * function — and that this file compares it against the owner rather than against prose.
 *
 * ⚠️ IT READS THE MIGRATION, NOT THE DATABASE, for the reason the sibling gates state: it has to
 * run in CI with no credentials. It proves what we WROTE. `npm run check:db` is the live check.
 */
const MIGRATIONS = join(process.cwd(), 'supabase/migrations')
const FN = 'trial_window_ends'

function fnMigrations(): string[] {
  return readdirSync(MIGRATIONS)
    .filter(f => f.endsWith('.sql'))
    .sort()
    .filter(f => new RegExp(`FUNCTION\\s+public\\.${FN}\\b`, 'i')
      .test(readFileSync(join(MIGRATIONS, f), 'utf8')))
}

/** The function BODY only — the `$fn$ … $fn$` span, so a comment or a sibling cannot be read. */
function fnBody(): string {
  const files = fnMigrations()
  expect(files.length, `no migration defines ${FN} — this check has stopped looking`).toBeGreaterThan(0)
  const sql = readFileSync(join(MIGRATIONS, files[files.length - 1]!), 'utf8')
  const m = /\$fn\$([\s\S]*?)\$fn\$/.exec(sql)
  expect(m, `${FN} has no $fn$-quoted body`).toBeTruthy()
  return stripSqlComments(m![1]!)
}

/** Every `interval 'N days'` in the body, in order. */
function intervals(body: string): number[] {
  const out: number[] = []
  const re = /interval\s+'(\d+)\s+days'/gi
  for (let m = re.exec(body); m !== null; m = re.exec(body)) out.push(Number(m[1]))
  return out
}

describe('OPS-TRIAL-SQL-CLOCK-01 — the SQL window mirrors lib/trial.ts', () => {
  it('reads a real function body, so no arm below can pass on an empty string', () => {
    const body = fnBody()
    expect(body.length).toBeGreaterThan(100)
    expect(body).toMatch(/\bcase\b/)
  })

  it('uses EXACTLY the three constants the owner declares, and no fourth', () => {
    // 🔴 The set, not a membership test. An arm that only checked "14 appears" would pass a body
    // that ALSO carried a stray 30 — which is what the cap was before the founder set it to 21,
    // and the kind of leftover a copy-edit leaves behind.
    const found = Array.from(new Set(intervals(fnBody()))).sort((a, b) => a - b)
    const declared = Array.from(new Set([TRIAL_DAYS, TRIAL_MAX_DAYS_FROM_START, TRIAL_EXTENSION_DAYS]))
      .sort((a, b) => a - b)
    expect(found, `SQL uses ${found.join('/')} days where lib/trial.ts declares ${declared.join('/')}`)
      .toEqual(declared)
  })

  it('stacks the extension on max(ends, extended), NOT on ends', () => {
    // 🔴 THE DEFECT THIS SHAPE EXISTS TO PREVENT, and it is recorded in resolveTrialWindow's own
    // comment: adding the grant to `endsAt` gave a runner accepting on day 23 NOTHING, while the
    // page said "7 more days." A mirror written from the column name rather than from the
    // function would have reproduced it exactly.
    const body = fnBody()
    expect(body, 'the extension must be anchored to max(ends, extended)')
      .toMatch(/greatest\s*\(\s*base\s*,\s*extended\s*\)\s*\+\s*interval/i)
  })

  it('clamps a read that precedes the stamp, and caps the first-read window', () => {
    const body = fnBody()
    expect(body, 'an unclamped window can end before it begins')
      .toMatch(/greatest\s*\(\s*first_read\s*,\s*started\s*\)/i)
    expect(body, 'the first-read window must be capped').toMatch(/least\s*\(/i)
  })

  it('returns null for a runner who never started a trial', () => {
    expect(fnBody()).toMatch(/when\s+started\s+is\s+null\s+then\s+null/i)
  })

  it('🔴 is the ONLY place SQL computes a trial window', () => {
    // The whole point of the item: the hazard is not "a view", it is SQL that computes a trial
    // window. Eight hand-written windows existed across two views. Any migration dated on or
    // after this one that writes `trial_started_at + interval 'N days'` is a ninth.
    const SINCE = '20261113'
    const offenders: string[] = []
    for (const f of readdirSync(MIGRATIONS).filter(x => x.endsWith('.sql')).sort()) {
      if (f.slice(0, 8) < SINCE) continue
      const body = stripSqlComments(readFileSync(join(MIGRATIONS, f), 'utf8'))
      // The owner's own body is the one legal site.
      const withoutOwner = body.replace(/\$fn\$[\s\S]*?\$fn\$/g, ' ')
      if (/trial_started_at\s*\+\s*interval/i.test(withoutOwner)) offenders.push(f)
    }
    expect(offenders, `these compute a trial window instead of calling public.${FN}`).toEqual([])
  })
})
