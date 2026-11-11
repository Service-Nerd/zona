import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { TRIAL_DAYS } from '@/lib/trial'
import { DERIVED_VIEWS } from '@/lib/supabase/userDataSurfaces'

/**
 * ACT-FUNNEL-01 — the activation funnel view, and the three things that can silently rot in it.
 *
 * ⚠️ IT SCANS THE MIGRATION, NOT THE LIVE DATABASE, for the reason `metricViewExclusion.test.ts`
 * states: this has to run in CI with no credentials. It proves what we WROTE. `npm run check:db`
 * is the live check and the runbook carries the post-apply verification.
 */
const MIGRATION = 'supabase/migrations/20261111c_activation_funnel.sql'
const sql = readFileSync(MIGRATION, 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, ' ')
  .replace(/^\s*--[^\n]*$/gm, ' ')   // strip whole-line SQL comments, keep line structure

describe('ACT-FUNNEL-01 — v_activation_funnel', () => {
  it('creates the view the brief asked for', () => {
    expect(sql).toMatch(/create\s+or\s+replace\s+view\s+public\.v_activation_funnel\s+as/i)
  })

  it('takes its POPULATION from v_metric_users, never a re-derived admin/internal pair', () => {
    // INTERNAL-ACCOUNTS-01's pattern: one owner of the exclusion. A view that spelled the pair out
    // again would drift the first time a third flag appears.
    expect(sql).toMatch(/from\s+public\.v_metric_users/i)
    expect(sql, 're-deriving the exclusion defeats v_metric_users').not.toMatch(/is_admin/)
  })

  it('carries plan_starts_after_trial — the column the whole item exists for', () => {
    // 📐 Measured 2026-11-11: 19 of 29 trialists with a plan (65.5%) have a plan whose first week
    // begins AFTER their trial ends, worst gap 242 days. A read needs a matched session, so for
    // those runners a read during the trial is impossible. Without this column the funnel would
    // show the drop and not the reason.
    expect(sql).toMatch(/as\s+plan_starts_after_trial/i)
    expect(sql).toMatch(/plan_first_week/i)
  })

  it('uses the SAME trial length as the tier resolver', () => {
    // D-16: SQL cannot import TypeScript, so the duplication is knowingly kept and this is the
    // mitigation (the shape used for admin_user_tiers vs resolveTier).
    // ⚠️ A loop, not `[...matchAll()]`: the spread needs `--downlevelIteration` under this
    // tsconfig and `tsc --noEmit` rejects it while vitest's esbuild does not — so the SUITE goes
    // green with the TYPECHECK red. Second time this trap has been hit in this repo in one day.
    const intervals: number[] = []
    const ivRe = /interval\s+'(\d+)\s+days'/gi
    for (let m = ivRe.exec(sql); m !== null; m = ivRe.exec(sql)) intervals.push(Number(m[1]))
    expect(intervals.length, 'the trial window is gone from the view').toBeGreaterThan(0)
    for (const d of intervals) {
      expect(d, `the view says ${d} days where lib/trial.ts says ${TRIAL_DAYS}`).toBe(TRIAL_DAYS)
    }
  })

  it('defines "run read" the same way lib/ops/runRead.ts does', () => {
    // One definition, two languages. A superseded row belongs to a replaced plan week and would
    // report a read the runner can no longer open.
    expect(sql).toMatch(/from\s+run_analysis\s+r/i)
    expect(sql).toMatch(/r\.superseded_at\s+is\s+null/i)
    const owner = readFileSync('lib/ops/runRead.ts', 'utf8')
    expect(owner).toMatch(/\.is\('superseded_at',\s*null\)/)
    // The view must not count anything the owner would exclude.
    const reads: RegExpExecArray[] = []
    const raRe = /from\s+run_analysis\s+r\s+([\s\S]{0,200}?)\)/gi
    for (let m = raRe.exec(sql); m !== null; m = raRe.exec(sql)) reads.push(m)
    expect(reads.length, 'no run_analysis subquery found — this arm has stopped looking').toBeGreaterThan(0)
    for (const r of reads) {
      expect(r[1], `a run_analysis read with no superseded filter: ${r[1].slice(0, 80)}`)
        .toMatch(/superseded_at\s+is\s+null/i)
    }
  })

  it('keeps COMPED separate from subscribed, so a Make-A-Wish seat is not a conversion', () => {
    // 📐 Measured: 23 comped subscriptions, 0 paid. `v_trial_conversion.converted_real` already
    // draws this line; a funnel that merged them would report 23 conversions against a true 0.
    expect(sql).toMatch(/not\s+coalesce\(b\.is_comped,\s*false\)[\s\S]{0,80}as\s+subscribed_at/i)
    expect(sql).toMatch(/as\s+is_comped/i)
  })

  it('stays off the client — it exposes user ids', () => {
    expect(sql).toMatch(/revoke\s+all\s+on\s+public\.v_activation_funnel\s+from\s+anon,\s*authenticated/i)
  })

  it('is declared in DERIVED_VIEWS, so check:db and the deletion gate can see it', () => {
    expect(Object.keys(DERIVED_VIEWS)).toContain('v_activation_funnel')
  })
})
