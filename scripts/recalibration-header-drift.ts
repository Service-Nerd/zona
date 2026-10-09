/**
 * READ-ONLY. RECAL-PACE-TWO-WRITER-01.
 *
 * `applyRecalibration` (ruleEngine.ts) rewrites every quality session's
 * `pace_target` to the single generic threshold band `pace.qualityPaceStr`,
 * which undoes §120 / HM-ANCHOR-VS-GOAL-01 (the header is the ROW'S OWN
 * anchor), and it never re-resolves `derived_set` — so the work steps keep
 * the PRE-recalibration paces. Signature: one flat quality band across the
 * whole plan + INV-PLAN-HEADER-PACE-MATCHES-WORK hits.
 *
 * Reproduced exactly: generate @24:00 (3 bands, 0 hits) → recalibrate @26:00
 * → 1 band, 7 hits, identical work-step paces to the stored plan.
 */
import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
import { validatePlan } from '../lib/plan/invariants'
for (const line of readFileSync('.env.local', 'utf8').split('\n')) {
  const m = line.match(/^([A-Z_]+)=(.*)$/); if (m) process.env[m[1]] ??= m[2].trim()
}
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
async function main() {
  const { data } = await sb.from('plans').select('id, user_id, created_at, updated_at, plan_json')
  const rows = data ?? []
  console.log(`plans: ${rows.length}\n`)
  let hitPlans = 0, flatBand = 0, recal = 0, benchMismatch = 0
  for (const r of rows) {
    const p = r.plan_json as any
    const gi = p?.meta?.generator_input
    if (!p?.weeks || !gi) { console.log(`${String(r.id).slice(0,8)}  no weeks/input`); continue }
    let hits = 0
    try { hits = validatePlan(p, gi).filter((v: any) => v.code === 'INV-PLAN-HEADER-PACE-MATCHES-WORK').length } catch { hits = -1 }
    const bands = new Set((p.weeks ?? []).flatMap((w: any) => Object.values(w.sessions ?? {})
      .filter((s: any) => s?.type === 'quality' && s?.pace_target).map((s: any) => s.pace_target)))
    const nQ = (p.weeks ?? []).flatMap((w: any) => Object.values(w.sessions ?? {}).filter((s: any) => s?.type === 'quality')).length
    const flat = nQ >= 3 && bands.size === 1
    const hasRecal = Array.isArray(p.meta.recalibrations_applied) && p.meta.recalibrations_applied.length > 0
    const bm = p.meta?.benchmark?.time, gm = gi?.benchmark?.time
    const mismatch = !!bm && !!gm && bm !== gm
    if (hits > 0) hitPlans++
    if (flat) flatBand++
    if (hasRecal) recal++
    if (mismatch) benchMismatch++
    if (hits > 0 || flat || mismatch || hasRecal) {
      console.log(`${String(r.id).slice(0,8)}  hits=${String(hits).padStart(2)} qual=${String(nQ).padStart(2)} bands=${bands.size}${flat?' FLAT':''}  meta.bm=${bm} input.bm=${gm}${mismatch?' MISMATCH':''}${hasRecal?' RECAL':''}  upd=${String(r.updated_at).slice(0,16)}`)
    }
  }
  console.log(`\nplans with header-pace hits     : ${hitPlans}/${rows.length}`)
  console.log(`plans with ONE flat quality band: ${flatBand}/${rows.length}`)
  console.log(`plans with recalibration applied: ${recal}/${rows.length}`)
  console.log(`meta.benchmark != input.benchmark: ${benchMismatch}/${rows.length}`)
}
main()
