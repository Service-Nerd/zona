import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { cronSecretFrom, secretMatches } from '@/lib/security/secrets'
import { recordOpsEvent } from '@/lib/ops/recordOpsEvent'
import { auditWeekKeyUniqueness, describeFinding, type WeekKeyRow } from '@/lib/supabase/liveKeyAudit'

// GET/POST /api/ops/live-key-integrity — CHECK-DB-LIVE-KEY-CRON-01, daily schema probe.
//
// ── WHY THIS EXISTS ────────────────────────────────────────────────────────────────────
// The five `%_live_key` partial unique indexes are the write side of PLAN-WEEK-COLLISION-01:
// a unique on `(user_id, week_n, …)` with no `WHERE superseded_at IS NULL` means a new plan's
// row cannot insert beside its superseded history, so the write lands on a tombstone or fails,
// every read excludes it, and nothing errors. Invisible for weeks twice
// (COMPLETION-TOMBSTONE-01, WEEKLY-REPORT-SUPERSEDED-WRITE-01).
//
// 🔴 AND THE REPO CANNOT SEE IT. `liveKeyCoverage.test.ts` gates the MIGRATIONS and runs in
// `npm run verify`, but an index dropped by hand in the Supabase dashboard leaves it green —
// demonstrated, not hypothesised: `session_overrides` carried a plain unique that NO migration
// declares, and the repo-side test passed on it. `check:db` reads production, and `check:db`
// is referenced by nothing but its own `package.json` line: not `verify`, not `verify:ci`,
// none of the workflows. **A check that runs when somebody types it is what this family keeps
// proving does not hold.** This is the thing that runs it.
//
// Why GitHub Actions and not a `vercel.json` cron: the same reason
// `ops-cron-strava-webhook-health.yml` states. Workflow: `ops-cron-live-key-integrity.yml`.
//
// ── WHAT IT REPORTS ────────────────────────────────────────────────────────────────────
//   live_key_not_live_scoped   — a week_n-keyed unique on a stamped table with no live predicate
//   live_key_probe_unavailable — the RPC is missing, so health CANNOT be observed
//
// ⚠️ THE SECOND ONE REFUSES RATHER THAN REASSURING, which is `strava-webhook-health`'s own
// stated precedent ("the probe refuses rather than reporting health it cannot observe"). A
// probe that returns `healthy: true` because it could not look is worse than no probe: it
// manufactures confidence. Missing RPC → 503.
//
// The classification is `lib/supabase/liveKeyAudit.ts`'s, shared with `check-db-drift.ts`, so
// the scheduled probe and the hand-run check cannot disagree about what a defect is.
//
// Auth: CRON_SECRET via `Authorization: Bearer` or `x-cron-secret`, read through the shared
// `cronSecretFrom` — the owner that exists because `push/send-weekly-report` read only one of
// the two and refused every Vercel cron call for 90 days (WEEKLY-REPORT-CRON-AUTH-01).

// A schema finding persists until someone fixes it, so a daily event row per day would be
// noise rather than signal. Same window `reshape-integrity` uses for the same reason.
const DEDUP_WINDOW_HOURS = 20

export async function GET(req: NextRequest) { return POST(req) }

export async function POST(req: NextRequest) {
  if (!secretMatches(cronSecretFrom(req), process.env.CRON_SECRET)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  const { data, error } = await supabase.rpc('week_key_uniqueness')
  if (error) {
    await recordOpsEvent('live_key_probe_unavailable', { message: error.message })
    return NextResponse.json(
      {
        healthy: null,
        error: 'week_key_uniqueness() unavailable — health could not be observed',
        detail: error.message,
        remedy: 'apply supabase/migrations/20261103_live_key_rpc.sql',
      },
      { status: 503 },
    )
  }

  const audit = auditWeekKeyUniqueness((data ?? []) as WeekKeyRow[])

  if (audit.findings.length) {
    // Dedup on the SET of offending index names, not on a count: a different index going wrong
    // is a different finding and must not be swallowed by a window opened for the first one.
    const signature = audit.findings.map(f => f.index_name).sort().join(',')
    const since = new Date(Date.now() - DEDUP_WINDOW_HOURS * 3_600_000).toISOString()
    const { data: recent } = await supabase
      .from('ops_events')
      .select('detail, created_at')
      .eq('kind', 'live_key_not_live_scoped')
      .gte('created_at', since)
    const alreadyReported = (recent ?? []).some(
      (r: { detail?: { signature?: string } | null }) => r.detail?.signature === signature,
    )
    if (!alreadyReported) {
      await recordOpsEvent('live_key_not_live_scoped', {
        signature,
        findings: audit.findings.map(describeFinding),
        live_scoped: audit.liveScoped.length,
      })
    }
  }

  return NextResponse.json({
    healthy: audit.healthy,
    live_scoped: audit.liveScoped.length,
    findings: audit.findings.map(describeFinding),
    // Stated, not hidden: rows on tables carrying no `superseded_at` are out of scope by
    // construction (plan_weekly_notes' pkey), and saying so stops the count reading as a miss.
    out_of_scope: audit.outOfScope.map(r => `${r.table_name}.${r.index_name}`),
  })
}
