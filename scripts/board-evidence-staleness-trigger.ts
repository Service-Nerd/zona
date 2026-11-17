// VDOT-STALENESS-CURVE-01 — is the re-open trigger met yet?
//
// READ-ONLY. The 2026-11-07 ruling held §10's staleness ramp SHAPE to be INSUFFICIENT EVIDENCE
// with a named re-open trigger: **20+ benchmarked runners with >= 8 weeks of logged runs each**.
// `BENCHMARK-STALENESS-CEILING-01` is vacated until it is met, so this is the one number that
// decides whether that item is buildable.
//
// ⚠️ IT IS A PARKING DECISION, SO IT MUST BE RE-MEASURED AND NOT REMEMBERED. Measured 10 at the
// 2026-11-16 build; this prints today's figure and the per-runner distribution behind it, so a
// reader can see how close it is rather than only whether it passed.

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'

const env = readFileSync('/Users/russe/rts-training-hub/.env.local', 'utf8')
const g = (k: string) => env.match(new RegExp(`^${k}=(.*)$`, 'm'))?.[1]?.trim() ?? ''
const sb = createClient(g('NEXT_PUBLIC_SUPABASE_URL'), g('SUPABASE_SERVICE_ROLE_KEY'))

/** ISO-ish week bucket — the unit the trigger is stated in ("weeks of logged runs"). */
function weekKey(iso: string): string {
  const d = new Date(iso)
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
  const day = t.getUTCDay() || 7
  t.setUTCDate(t.getUTCDate() + 4 - day)
  const y0 = new Date(Date.UTC(t.getUTCFullYear(), 0, 1))
  return `${t.getUTCFullYear()}-${Math.ceil(((t.getTime() - y0.getTime()) / 86400000 + 1) / 7)}`
}

async function main() {
  // Benchmarked = the plan the engine actually priced carries a benchmark. `plans.plan_json`
  // is where `meta.vdot` lands, so this asks the stored plan rather than inferring from inputs.
  // ⚠️ `plans` has NO `superseded_at` — one row per user, upserted. A first cut selected that
  // column and PostgREST returned an error object, which is the shape MIGRATION-GRANTS-01 warns
  // reads as empty rather than broken at most call sites here. Checked, not assumed.
  const { data: plans, error: pe } = await sb.from('plans')
    .select('user_id, plan_json, created_at')
  if (pe) { console.error('plans read failed:', pe.message); process.exit(2) }

  const benchmarked = new Map<string, { vdot: number; dated: boolean }>()
  for (const row of plans ?? []) {
    const meta = (row.plan_json as { meta?: Record<string, unknown> } | null)?.meta
    const vdot = meta?.vdot
    if (typeof vdot !== 'number') continue
    // 🔴 `meta.benchmark.benchmark_date`, NOT `meta.benchmark_date`. The first cut read one
    // level too high and reported 0 of 21 carrying a date against a recorded 15 — the fourth
    // instance in this thread of reading a field instead of asking where the producer puts it.
    // The contradiction with the record is what caught it; the trigger count does not depend on
    // this field, so it would have published beside a correct number.
    const bench = meta?.benchmark as { benchmark_date?: unknown } | undefined
    benchmarked.set(String(row.user_id), {
      vdot,
      dated: typeof bench?.benchmark_date === 'string' && !!bench.benchmark_date,
    })
  }

  const { data: acts, error: ae } = await sb.from('strava_activities')
    .select('user_id, start_date')
  if (ae) { console.error('activities read failed:', ae.message); process.exit(2) }

  const weeksByUser = new Map<string, Set<string>>()
  for (const a of acts ?? []) {
    const u = String(a.user_id)
    if (!weeksByUser.has(u)) weeksByUser.set(u, new Set())
    weeksByUser.get(u)!.add(weekKey(String(a.start_date)))
  }

  const rows = Array.from(benchmarked).map(([u, b]) => ({
    u, ...b, weeks: weeksByUser.get(u)?.size ?? 0,
  })).sort((x, y) => y.weeks - x.weeks)

  const qualifying = rows.filter(r => r.weeks >= 8)
  console.log(`\nVDOT-STALENESS-CURVE-01 re-open trigger: 20+ benchmarked runners with >= 8 weeks of logged runs`)
  console.log(`\nbenchmarked runners with a live plan: ${rows.length}`)
  console.log(`weeks of logged runs, descending: ${rows.map(r => r.weeks).join(' · ')}`)
  console.log(`\n>= 8 weeks: ${qualifying.length}  —  TRIGGER ${qualifying.length >= 20 ? 'MET' : 'NOT MET'} (needs 20)`)
  console.log(`  short by: ${Math.max(0, 20 - qualifying.length)}`)
  // ⚠️ The second half of the gap is reported too: the trigger needs 20 RUNNERS, so the ceiling
  // on it is the benchmarked population itself, not how long each has been logging.
  console.log(`\n⚠️ CEILING ON THE TRIGGER: only ${rows.length} benchmarked runners exist at all, so even if every`)
  console.log(`   one of them logged for a year the trigger would be ${rows.length >= 20 ? 'reachable' : 'UNREACHABLE'} — the binding`)
  console.log(`   constraint is ${rows.length >= 20 ? 'logging duration' : 'the number of benchmarked runners, which only acquisition moves'}.`)
  const dated = rows.filter(r => r.dated).length
  console.log(`\nof those ${rows.length}: ${dated} carry a benchmark DATE, ${rows.length - dated} do not (BENCHMARK-DATELESS-FRESH-01's population)`)
}
main()
