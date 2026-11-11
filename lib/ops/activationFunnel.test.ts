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
    expect(sql).toMatch(/create\s+(or\s+replace\s+)?view\s+public\.v_activation_funnel\s+as/i)
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
    // ⚠️ A case-insensitive, whitespace-flexible search for the LAST `exists (select 1` before the
    // label — not `lastIndexOf` on an exact string. The first version matched literal
    // `'exists (select 1'`, so reformatting correct SQL turned this arm red, in the file whose own
    // comment says to bound by syntax rather than by guessing. (It also broke the moment the
    // expression was wrapped in a `case when`.)
    const before = sql.slice(0, label)
    const openIdx = before.search(/exists\s*\(\s*select\s+1(?![\s\S]*exists\s*\(\s*select\s+1)/i)
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

  it('DROPS before creating — the column set changed, so a replace would apply NOTHING', () => {
    // 🔴 `create or replace view` may only APPEND columns. This version renames
    // `plan_first_week` → `current_plan_first_week` and removes `plan_starts_after_trial`, so a
    // replace raises 42P16 and the whole file — grants and comment included — does nothing.
    // `20260920` documents that error code verbatim and INTERNAL-ACCOUNTS-01's review caught two
    // instances of it the same morning.
    const drop = sql.search(/drop\s+view\s+if\s+exists\s+public\.v_activation_funnel/i)
    const create = sql.search(/create\s+(or\s+replace\s+)?view\s+public\.v_activation_funnel/i)
    expect(drop, 'no drop before the create').toBeGreaterThan(-1)
    expect(drop).toBeLessThan(create)
  })

  it('requires the plan to OVERLAP the trial, not merely to have started by the end of it', () => {
    // A plan that had already finished before the trial opened is not a trainable week.
    // `trial_started_at` is stamped on first dashboard load, not at signup, so that ordering is
    // reachable. Measured: changes nothing today (13 either way) and it is wrong, which is what
    // latent means.
    const label = sql.search(/as\s+trainable_week_in_trial/i)
    const before = sql.slice(0, label)
    const openIdx = before.search(/exists\s*\(\s*select\s+1(?![\s\S]*exists\s*\(\s*select\s+1)/i)
    const expr = sql.slice(openIdx, label)
    expect(expr, 'the overlap test is gone — a finished plan would score trainable')
      .toMatch(/v\.last_day\s*>=/i)
  })

  it('answers NULL, not false, for a runner who never started a trial', () => {
    // `false` means "had no plan during their trial"; they had no trial. Three columns about one
    // question must not disagree about absence — `earliest_plan_start_in_trial` is already NULL.
    for (const col of ['had_live_plan_in_trial', 'trainable_week_in_trial']) {
      const label = sql.search(new RegExp(`as\\s+${col}`, 'i'))
      expect(label, `${col} is gone`).toBeGreaterThan(-1)
      const region = sql.slice(Math.max(0, label - 600), label)
      expect(region, `${col} returns false for a non-trialist`)
        .toMatch(/case\s+when\s+s\.trial_started_at\s+is\s+null\s+then\s+null/i)
    }
  })

  it('does not claim plan_archive is a complete history, because it is not', () => {
    // 🔴 The first version of the CTE comment said the archive is "written before every
    // savePlanForUser". `lib/plan.ts` archives only on `isRaceIdentityChange` or a non-empty
    // `calendarChangedWeeks`. Writing a false premise into the migration as fact is how the next
    // reader stops checking. Measured residual: 6 of 37 trialists.
    // ⚠️ POSITIVE, NOT NEGATIVE, and the first cut got that wrong in the most on-the-nose way
    // available: it searched for the false claim and the comment QUOTES the false claim in order
    // to correct it, so the guard fired on the fix. A detector whose pattern is the text it
    // forbids cannot tell an assertion from a quotation. Assert what must be PRESENT instead.
    const raw = readFileSync(MIGRATION, 'utf8')
    expect(raw, 'the incompleteness of the history must stay stated')
      .toMatch(/INCOMPLETE/i)
    expect(raw, 'the two conditions that actually trigger an archive must be named')
      .toMatch(/isRaceIdentityChange/)
    expect(raw).toMatch(/calendarChangedWeeks/)
  })

  it('stays off the client — it exposes user ids', () => {
    expect(sql).toMatch(/revoke\s+all\s+on\s+public\.v_activation_funnel\s+from\s+anon,\s*authenticated/i)
  })

  it('is declared in DERIVED_VIEWS, so check:db and the deletion gate can see it', () => {
    expect(Object.keys(DERIVED_VIEWS)).toContain('v_activation_funnel')
  })
})
