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

  it('carries trainable_week_in_trial — the column the whole item exists for', () => {
    // 📐 Measured 2026-11-11: 19 of 29 trialists with a plan (65.5%) have a plan whose first week
    // begins AFTER their trial ends, worst gap 242 days. A read needs a matched session, so for
    // those runners a read during the trial is impossible. Without this column the funnel would
    // show the drop and not the reason.
    expect(sql).toMatch(/as\s+trainable_week_in_trial/i)
    expect(sql).toMatch(/as\s+earliest_plan_start_in_trial/i)
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

  it('defines "run read" the same way lib/ops/runRead.ts does — EVERY read, not most of them', () => {
    // One definition, two languages. A superseded row belongs to a replaced plan week and would
    // report a read the runner can no longer open.
    const owner = readFileSync('lib/ops/runRead.ts', 'utf8')
    expect(owner).toMatch(/\.is\('superseded_at',\s*null\)/)

    // 🔴 THE FIRST CUT OF THIS ARM REACHED 2 OF THE 3 SUBQUERIES AND CODE REVIEW FOUND IT.
    // It matched `from run_analysis r` then `([\s\S]{0,200}?)\)` — a fixed 200-character window
    // with the alias hard-coded — so `reads_in_trial`, whose predicate is the longest of the
    // three, fell outside it. Deleting the filter from that one subquery alone left the suite
    // GREEN, in the arm written to prevent exactly that. **Bound the region, never guess its
    // length**: segment on the table name and read to the next FROM.
    const segments = sql.split(/from\s+run_analysis\b/i).slice(1)
    expect(segments.length, 'no run_analysis read found — this arm has stopped looking')
      .toBeGreaterThan(0)
    segments.forEach((seg, i) => {
      const next = seg.search(/\bfrom\s+/i)
      const region = next === -1 ? seg : seg.slice(0, next)
      expect(region, `run_analysis read #${i + 1} has no superseded filter: ${region.slice(0, 90)}`)
        .toMatch(/superseded_at\s+is\s+null/i)
    })
  })

  it('computes the trial plan question from HISTORY, not the plans snapshot', () => {
    // 🔴 `plans` holds ONE row per user, upserted. Reading it answers "where does this runner's
    // plan start TODAY" and the question is "where did it start DURING THEIR TRIAL". Two of the
    // four runners first reported as having a plan that began after their trial had in fact been
    // training inside it and regenerated weeks later; the headline moved 65.5% → 51.9%.
    expect(sql).toMatch(/with\s+plan_versions\s+as/i)
    expect(sql).toMatch(/from\s+plan_archive\s+pa/i)
    expect(sql).toMatch(/as\s+trainable_week_in_trial/i)
    expect(sql).toMatch(/as\s+had_live_plan_in_trial/i)
    // The snapshot columns must SAY they are a snapshot.
    expect(sql).toMatch(/as\s+current_plan_first_week/i)
    // And the boolean itself must read the history CTE, not the snapshot.
    // ⚠️ Bound the region from its OWN `exists (`, not by counting characters backwards: the
    // first attempt reached back 900 chars into the CTE, which legitimately contains `from plans
    // p` as its "live now" arm, and failed on correct SQL. Same lesson as the arm above.
    const label = sql.search(/as\s+trainable_week_in_trial/i)
    expect(label, 'trainable_week_in_trial is gone').toBeGreaterThan(-1)
    const openIdx = sql.lastIndexOf('exists (select 1', label)
    expect(openIdx, 'trainable_week_in_trial is no longer an exists() over plan versions').toBeGreaterThan(-1)
    const expr = sql.slice(openIdx, label)
    expect(expr, 'the trial boolean must read plan_versions').toMatch(/from\s+plan_versions\s+v\b/i)
    expect(expr, 'the trial boolean reads the plans snapshot again').not.toMatch(/from\s+plans\b/i)
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
