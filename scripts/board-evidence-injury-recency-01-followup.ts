/**
 * READ-ONLY board evidence — INJURY-RECENCY-01 follow-up (Design Board, 2026-11-20).
 *
 * The control question: how many live runners would ever SEE a recency follow-up (Back or
 * Plantar fasciitis ticked), how many would see two, and what else they ticked alongside.
 * Reads `plans.plan_json.meta.generator_input.injury_history`. Writes nothing.
 *
 * Run: npx tsx scripts/board-evidence-injury-recency-01-followup.ts
 */
import { createClient } from '@supabase/supabase-js'
import { loadEnvConfig } from '@next/env'
loadEnvConfig(process.cwd())

const VARYING = new Set(['back', 'plantar fasciitis'])

async function main() {
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })
  const { data, error } = await db.from('plans').select('user_id, plan_json')
  if (error) throw error
  const rows = data ?? []
  let withInput = 0, withAny = 0, withVarying = 0, withBoth = 0
  const chipsPerInjured: Record<number, number> = {}
  const tally: Record<string, number> = {}
  const varyingUsers = new Set<string>()
  const injuredUsers = new Set<string>()
  const varyingDetail: string[] = []
  for (const p of rows) {
    const gi = (p.plan_json as any)?.meta?.generator_input
    if (!gi) continue
    withInput++
    const h: string[] = (gi.injury_history ?? []).map((s: string) => String(s).toLowerCase())
    if (!h.length) continue
    withAny++
    injuredUsers.add(p.user_id)
    chipsPerInjured[h.length] = (chipsPerInjured[h.length] ?? 0) + 1
    for (const c of h) tally[c] = (tally[c] ?? 0) + 1
    const v = h.filter(c => VARYING.has(c))
    if (v.length) {
      withVarying++
      varyingUsers.add(p.user_id)
      varyingDetail.push(`${String(p.user_id).slice(0, 8)} · ${gi.race_distance_km ?? gi.race_distance ?? '?'} · [${h.join(', ')}]`)
    }
    if (v.length === 2) withBoth++
  }
  console.log(`plans: ${rows.length} · with generator_input: ${withInput} · any chip: ${withAny} (${injuredUsers.size} users)`)
  console.log('chip tally:', tally)
  console.log('chips per injured plan:', chipsPerInjured)
  console.log(`plans that would show a follow-up (back or plantar): ${withVarying} (${varyingUsers.size} users) · showing TWO: ${withBoth}`)
  for (const d of varyingDetail) console.log('  ', d)
}
main().catch(e => { console.error(e); process.exit(1) })
