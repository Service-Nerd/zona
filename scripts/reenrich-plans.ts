// OPS-ENRICH-REMEDIATE-01 — restore the AI voice for runners whose enrichment failed.
//
// ⚠️ DRY RUN BY DEFAULT. Pass `--write` to persist, and it will refuse unless
// `--i-have-authorisation` is also present, because this touches LIVE PLANS.
//
// ── WHY A SCRIPT AND NOT A BACKFILL ──────────────────────────────────────────
// The 2026-08-20 live-plan policy is that engine fixes apply to NEW plans only.
// This is deliberately NOT an engine fix: `mergePlan` can write only
// `meta.notes`, `coach_intro`, `confidence_*`, `week.label`, `week.theme`,
// `session.label` and `session.coach_notes` — every one of them COPY, enforced by
// `EnrichedPlanSchema` rather than by convention. No prescription field is
// reachable. What is restored is the thing a paying runner was promised.
//
// 🔴 AND THE RECORDED BLOCKER HAS EXPIRED. `PLAN-STRIDES-BACKFILL-01` (2026-09-24)
// states: *"regeneration is not reliably possible — `plan_json.meta` does not carry
// `days_cannot_train` or `preferred_long_run_day`"*. That is no longer true:
// PV2-A persists the whole input at `meta.generator_input`, and this script reads
// it. Another item stating an impossibility that had quietly been lifted.
//
// ⚠️ AND WE DO NOT REGENERATE ANYWAY. The rule plan is intact — only the voice was
// discarded — so this re-runs the ENRICHER over the stored plan. The prescription
// is not recomputed, which is what makes "no impact" checkable rather than hoped
// for: the script DIFFS every session's numerics before and after and refuses to
// write if a single one moved.
import { loadEnvConfig } from '@next/env'
loadEnvConfig(process.cwd())
import { createClient } from '@supabase/supabase-js'
import { enrich } from '../lib/plan/enrich'
import { judgeEnrichHealth, enrichmentStateOf, type EnrichStateRow } from '../lib/ops/enrichHealth'
import type { Plan, Session } from '../types/plan'

const WRITE = process.argv.includes('--write')
const AUTHORISED = process.argv.includes('--i-have-authorisation')

/** Every field a runner's PRESCRIPTION depends on. If any of these move, refuse. */
function prescriptionFingerprint(plan: Plan): string {
  return JSON.stringify(plan.weeks.map(w => ({
    n: w.n, phase: w.phase, type: w.type, weekly_km: w.weekly_km,
    sessions: Object.entries(w.sessions ?? {}).map(([day, s]) => {
      const sn = s as Session | undefined
      return [day, sn && {
        type: sn.type, role: sn.role, zone: sn.zone, distance_km: sn.distance_km,
        duration_mins: sn.duration_mins, primary_metric: sn.primary_metric,
        pace_target: sn.pace_target, hr_target: sn.hr_target,
        catalogue_id: sn.catalogue_id, derived_set: sn.derived_set,
        duration_anchored: sn.duration_anchored,
      }]
    }),
  })))
}

async function main() {
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
  const { data, error } = await db.from('plans').select('user_id, created_at, plan_json')
  if (error) { console.error('could not read plans:', error.message); process.exit(1) }

  const rows: EnrichStateRow[] = (data ?? []).map(r => ({
    user_id: String(r.user_id), created_at: String(r.created_at),
    enrichment: enrichmentStateOf(r.plan_json as never),
  }))
  const verdict = judgeEnrichHealth(rows)

  console.log(`\nmode: ${WRITE ? (AUTHORISED ? 'WRITE (authorised)' : 'WRITE REFUSED — missing --i-have-authorisation') : 'DRY RUN (writes nothing)'}`)
  console.log(`eligible plans ${verdict.eligible} · with voice ${verdict.withVoice} · WITHOUT ${verdict.withoutVoice} (${verdict.withoutVoicePct}%)\n`)
  if (WRITE && !AUTHORISED) { console.error('refusing: --write needs --i-have-authorisation'); process.exit(2) }
  if (!verdict.affected.length) { console.log('nothing to remediate.'); return }

  for (const target of verdict.affected) {
    const row = (data ?? []).find(r => String(r.user_id) === target.user_id)
    const plan = row?.plan_json as Plan | undefined
    const input = plan?.meta?.generator_input
    console.log(`── ${target.user_id.slice(0, 8)}  ${target.created_at.slice(0, 16)}  ${target.enrichment}`)
    if (!plan) { console.log('   SKIP: no plan_json'); continue }
    if (!input) {
      // The honest failure mode: a plan predating PV2-A cannot be re-enriched
      // faithfully, because the enricher is told about the runner from the input.
      console.log('   SKIP: no meta.generator_input (predates PV2-A) — cannot re-enrich faithfully')
      continue
    }
    const before = prescriptionFingerprint(plan)
    const tier = 'paid' as const   // these runners are paid/trial; enrichment is gated on it
    const res = await enrich(plan, input as never, tier, target.user_id, 'km')
    if (res.outcome.status !== 'applied') {
      const o = res.outcome as { status: string; reason?: string }
      console.log(`   STILL FAILS: ${o.reason ?? o.status} — this runner needs the underlying cause fixed first`)
      continue
    }
    const after = prescriptionFingerprint(res.plan)
    if (before !== after) {
      // Should be impossible: mergePlan cannot reach a numeric. If it ever happens,
      // refusing is the only safe answer and the diff is the bug report.
      console.log('   🔴 REFUSED: prescription changed. Not writing. This is a defect in mergePlan.')
      continue
    }
    const weeksWithVoice = res.plan.weeks.filter(w => w.theme && w.theme !== plan.weeks.find(x => x.n === w.n)?.theme).length
    console.log(`   ✅ would restore voice · prescription byte-identical · ${weeksWithVoice} week(s) gain copy`)
    if (WRITE && AUTHORISED) {
      const { error: wErr } = await db.from('plans')
        .update({ plan_json: res.plan, updated_at: new Date().toISOString() })
        .eq('user_id', target.user_id)
      console.log(wErr ? `   WRITE FAILED: ${wErr.message}` : '   WRITTEN')
    }
  }
  if (!WRITE) console.log('\nDRY RUN — nothing was written.')
}
main()
