/**
 * CHECK-DB-LIVE-KEY-CRON-01 — the shared classifier, tested once for both callers.
 *
 * `scripts/check-db-drift.ts` (hand-run) and `/api/ops/live-key-integrity` (daily cron) ask
 * the identical question. They call this module rather than each carrying a copy, because two
 * hand-written answers to one question is the shape behind `DELOAD-OWNER-01` (the deload
 * cadence in five places) and `TIER-OWNER-01` (the tier order in three, with the test
 * asserting its own copy). **Testing the owner tests both callers; testing a copy tests the
 * copy.**
 *
 * ⚠️ THE PRODUCTION FIXTURE IS REAL, NOT INVENTED. The rows below are what
 * `week_key_uniqueness()` actually returned on 2026-11-02, before and after
 * `20261104_live_week_keys_survivors.sql`. A fixture written from the type rather than from
 * the producer is how `IAP-PURCHASE-FAILED-01` stayed live for five months — the plugin's
 * documented field was never the one the bridge sent.
 */
import { describe, it, expect } from 'vitest'
import { auditWeekKeyUniqueness, isLiveScoped, describeFinding, type WeekKeyRow } from './liveKeyAudit'
import { WEEK_KEYED_TABLES } from '@/lib/plan/supersede'

/** Captured from production BEFORE 20261104 — two survivors. */
const BEFORE: WeekKeyRow[] = [
  { table_name: 'plan_weekly_notes', index_name: 'plan_weekly_notes_pkey', kind: 'index', columns: 'user_id,week_n', predicate: null },
  { table_name: 'run_analysis', index_name: 'run_analysis_manual_uniq', kind: 'index', columns: 'user_id,week_n,session_day', predicate: "(source = 'manual'::text)" },
  { table_name: 'session_completions', index_name: 'session_completions_live_key', kind: 'index', columns: 'user_id,week_n,session_day', predicate: '(superseded_at IS NULL)' },
  { table_name: 'session_metric_overrides', index_name: 'session_metric_overrides_live_key', kind: 'index', columns: 'user_id,week_n,session_key', predicate: '(superseded_at IS NULL)' },
  { table_name: 'session_overrides', index_name: 'session_overrides_live_key', kind: 'index', columns: 'user_id,week_n,original_day', predicate: '(superseded_at IS NULL)' },
  { table_name: 'session_overrides', index_name: 'session_overrides_user_id_week_n_original_day_key', kind: 'constraint', columns: 'user_id,week_n,original_day', predicate: null },
  { table_name: 'session_reflections', index_name: 'session_reflections_live_key', kind: 'index', columns: 'user_id,week_n,session_day', predicate: '(superseded_at IS NULL)' },
  { table_name: 'weekly_reports', index_name: 'weekly_reports_live_key', kind: 'index', columns: 'user_id,week_n', predicate: '(superseded_at IS NULL)' },
]

/** The same query AFTER 20261104 — the state `check:db` reports green. */
const AFTER: WeekKeyRow[] = [
  BEFORE[0],
  { table_name: 'run_analysis', index_name: 'run_analysis_manual_live_uniq', kind: 'index', columns: 'user_id,week_n,session_day', predicate: "(source = 'manual'::text) AND (superseded_at IS NULL)" },
  ...BEFORE.slice(2).filter(r => r.index_name !== 'session_overrides_user_id_week_n_original_day_key'),
]

describe('isLiveScoped', () => {
  it('accepts the predicate Postgres actually renders, in either case', () => {
    expect(isLiveScoped('(superseded_at IS NULL)')).toBe(true)
    expect(isLiveScoped('(source = \'manual\'::text) AND (superseded_at IS NULL)')).toBe(true)
    expect(isLiveScoped('(superseded_at is null)')).toBe(true)
  })
  it('rejects no predicate, and a predicate that scopes something else', () => {
    expect(isLiveScoped(null)).toBe(false)
    expect(isLiveScoped("(source = 'manual'::text)")).toBe(false)
    // ⚠️ The near-miss worth pinning: NOT NULL is the opposite claim, and a substring match on
    // "superseded_at" alone would accept it.
    expect(isLiveScoped('(superseded_at IS NOT NULL)')).toBe(false)
  })
})

describe('auditWeekKeyUniqueness — the real rows', () => {
  it('BEFORE 20261104: the two survivors are findings, five are live-scoped', () => {
    const a = auditWeekKeyUniqueness(BEFORE)
    expect(a.healthy).toBe(false)
    expect(a.liveScoped).toHaveLength(5)
    expect(a.findings.map(f => f.index_name).sort()).toEqual([
      'run_analysis_manual_uniq',
      'session_overrides_user_id_week_n_original_day_key',
    ])
  })

  it('AFTER 20261104: healthy, six live-scoped', () => {
    const a = auditWeekKeyUniqueness(AFTER)
    expect(a.healthy).toBe(true)
    expect(a.findings).toEqual([])
    // The figure `check:db` prints and the migration file predicted before it ran.
    expect(a.liveScoped).toHaveLength(6)
  })

  it('plan_weekly_notes is out of scope BY DERIVATION, not by an exemption list', () => {
    const a = auditWeekKeyUniqueness(AFTER)
    expect(a.outOfScope.map(r => r.table_name)).toEqual(['plan_weekly_notes'])
    // It carries no `superseded_at`, so the predicate cannot apply — and the reason is the
    // array the schema is reconciled against, not a name typed in this file.
    expect(WEEK_KEYED_TABLES as readonly string[]).not.toContain('plan_weekly_notes')
  })

  it('a constraint-backed key is reported as a constraint, because that is the worse form', () => {
    // 'index' merely scopes; 'constraint' BLOCKS the new plan's insert. The distinction is in
    // the message so whoever reads the ops event knows which they have.
    const f = BEFORE.find(r => r.kind === 'constraint')!
    expect(describeFinding(f)).toContain('(constraint)')
    expect(describeFinding(f)).toContain('predicate NONE')
  })

  it('an empty result is NOT healthy-looking by accident', () => {
    // A row set that came back empty because the RPC was filtered wrongly would otherwise
    // report "healthy, 0 findings" — true and useless. The caller is responsible for refusing
    // on an error, and this pins what empty means here: nothing in scope, nothing claimed.
    const a = auditWeekKeyUniqueness([])
    expect(a.liveScoped).toHaveLength(0)
    expect(a.findings).toHaveLength(0)
    expect(a.healthy).toBe(true)   // vacuously — which is why the route 503s on an RPC error
  })
})
