/**
 * `HR-SAVE-UNEDITED-CONFIRMS-01` + `DOUBLE-STRIDES-01` — Coaching Board evidence, 2026-11-20. READ-ONLY.
 *
 * (1) Re-measures the §50 at-risk population the backlog item quotes (11-08: 3 · 11-12: 7):
 *     `user_settings` rows whose max HR is `observed` AND below their Tanaka estimate. Also counts the
 *     rows that are ALREADY `user_confirmed` below the estimate — that set holds both genuine low-max
 *     runners and any device floor an earlier save promoted, and the two cannot be told apart.
 * (2) For DOUBLE-STRIDES-01: how many live doubles exist (`session_overrides.new_slot` set on a live
 *     row) and how many live plan sessions carry strides.
 *
 * Only SELECTs. Run: npx tsx scripts/board-evidence-hr-save-unedited-confirms-01.ts
 */
import { createClient } from '@supabase/supabase-js'
import { loadEnvConfig } from '@next/env'

loadEnvConfig(process.cwd())
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false },
})

async function main() {
  const now = new Date()
  const { data: us, error } = await db.from('user_settings')
    .select('id, max_hr, max_hr_source, resting_hr, birth_year, date_of_birth, is_admin, updated_at')
  if (error) throw new Error(error.message)
  const rows = us ?? []
  const ageOf = (r: any): number | null => {
    const by = typeof r.birth_year === 'number' ? r.birth_year
      : r.date_of_birth ? new Date(r.date_of_birth).getFullYear() : null
    if (!by) return null
    const a = now.getFullYear() - by
    return a >= 10 && a <= 100 ? a : null
  }
  const withMax = rows.filter(r => typeof r.max_hr === 'number')
  const bySource: Record<string, number> = {}
  for (const r of withMax) bySource[String(r.max_hr_source)] = (bySource[String(r.max_hr_source)] ?? 0) + 1
  const below = (r: any) => { const a = ageOf(r); return a != null && r.max_hr < Math.round(208 - 0.7 * a) }
  const obsBelow = withMax.filter(r => r.max_hr_source === 'observed' && below(r))
  const obsNoAge = withMax.filter(r => r.max_hr_source === 'observed' && ageOf(r) == null)
  const confBelow = withMax.filter(r => r.max_hr_source === 'user_confirmed' && below(r))
  const fmt = (r: any) => {
    const a = ageOf(r)!; const est = Math.round(208 - 0.7 * a)
    return `  ${String(r.id).slice(0, 8)} age ${a} max ${r.max_hr} est ${est} gap ${r.max_hr - est} rhr ${r.resting_hr ?? '—'} admin ${!!r.is_admin} updated ${String(r.updated_at).slice(0, 10)}`
  }
  console.log(`user_settings rows: ${rows.length} (admin ${rows.filter(r => r.is_admin).length})`)
  console.log(`with a max: ${withMax.length}`, bySource)
  console.log(`observed AND below Tanaka (AT RISK): ${obsBelow.length}`)
  obsBelow.forEach(r => console.log(fmt(r)))
  console.log(`observed with NO guardable age (estimate not computable): ${obsNoAge.length}`)
  console.log(`user_confirmed AND below Tanaka (already trusted below the estimate): ${confBelow.length}`)
  confBelow.forEach(r => console.log(fmt(r)))
  // §50 Asymmetry treats an UNATTRIBUTED max (source null) exactly like a device floor: rejected below
  // the estimate, and promoted to `user_confirmed` by any save. So the at-risk set is observed + null.
  const nullBelow = withMax.filter(r => r.max_hr_source == null && below(r))
  console.log(`unattributed (null source) AND below Tanaka: ${nullBelow.length}`)
  nullBelow.forEach(r => console.log(fmt(r)))
  // The 11-12 figure (7) is not reproducible from the 11-12 note alone; list every non-confirmed row
  // with no guardable age so the reader can see which assumed age would have produced it.
  for (const r of withMax.filter(r => r.max_hr_source !== 'user_confirmed' && ageOf(r) == null)) {
    const at = (a: number) => r.max_hr < Math.round(208 - 0.7 * a)
    console.log(`  no-age ${String(r.id).slice(0, 8)} src ${r.max_hr_source} max ${r.max_hr} below-if-30 ${at(30)} -35 ${at(35)} -40 ${at(40)}`)
  }

  // ── DOUBLE-STRIDES-01 ──
  const { data: ov, error: oe } = await db.from('session_overrides')
    .select('user_id, week_n, original_day, new_day, new_slot, superseded_at')
  if (oe) throw new Error(oe.message)
  const live = (ov ?? []).filter(o => o.superseded_at == null)
  console.log(`\nsession_overrides live rows: ${live.length}; with new_slot set (a double): ${live.filter(o => o.new_slot != null).length}; all-time with new_slot: ${(ov ?? []).filter(o => o.new_slot != null).length}`)
  const { data: plans, error: pe } = await db.from('plans').select('user_id, plan_json')
  if (pe) throw new Error(pe.message)
  let sessions = 0, strides = 0, hill = 0, plansWithStrides = 0
  for (const p of plans ?? []) {
    let any = false
    for (const w of (p.plan_json as any)?.weeks ?? []) for (const s of Object.values(w.sessions ?? {}) as any[]) {
      if (!s || s.type === 'rest' || s.type === 'strength') continue
      sessions++
      const lbl = String(s.label ?? '')
      if (/\+ hill strides/i.test(lbl)) { hill++; any = true }
      else if (/strides/i.test(lbl) || (s.coach_notes ?? []).some((n: unknown) => typeof n === 'string' && /strides/i.test(n))) { strides++; any = true }
    }
    if (any) plansWithStrides++
  }
  console.log(`plans: ${(plans ?? []).length}; run sessions ${sessions}; strides runs ${strides}; hill-strides runs ${hill}; plans carrying either ${plansWithStrides}`)
}
main().catch(e => { console.error(e); process.exit(1) })
