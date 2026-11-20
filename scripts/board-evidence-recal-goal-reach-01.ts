// board-evidence-recal-goal-reach-01.ts — READ-ONLY. RECAL-GOAL-REACH-01 + RECAL-MIXED-MEAN-01, sitting 2026-11-20.
// How many live plans have EVER been recalibrated (meta.recalibrations_applied), and of those, how many carry a
// goal_pace_reach decision that a recalibration could have flipped? Also: plans archived (plan_archive) with one.
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'
const env = readFileSync('/Users/russe/rts-training-hub/.env.local', 'utf8')
const g = (k: string) => env.match(new RegExp(`^${k}=(.*)$`, 'm'))?.[1]?.trim() ?? ''
const sb = createClient(g('NEXT_PUBLIC_SUPABASE_URL'), g('SUPABASE_SERVICE_ROLE_KEY'))
async function main() {
  const { data: plans, error } = await sb.from('plans').select('user_id, plan_json')
  if (error) throw error
  let reached = 0, withReach = 0, recal = 0
  for (const p of plans ?? []) {
    const m = (p.plan_json as any)?.meta ?? {}
    if (m.goal_pace_reach) withReach++
    const r = m.recalibrations_applied ?? []
    if (r.length) {
      recal++
      console.log(`  live ${String(p.user_id).slice(0, 8)} recal=${JSON.stringify(r)} reach=${JSON.stringify(m.goal_pace_reach ?? null)} withheld=${JSON.stringify(m.goal_pace_withheld ?? null)} vdot=${m.vdot} goal=${m.goal} dist=${m.race_distance_km}`)
      if (m.goal_pace_reach) reached++
    }
  }
  console.log(`live plans ${plans?.length}; with goal_pace_reach ${withReach}; ever recalibrated ${recal}; recalibrated AND carry a reach decision ${reached}`)
  const { data: arch, error: e2 } = await sb.from('plan_archive').select('user_id, plan_json')
  if (e2) { console.log('plan_archive read failed:', e2.message); return }
  let ar = 0
  for (const p of arch ?? []) { const m = (p.plan_json as any)?.meta ?? {}; if ((m.recalibrations_applied ?? []).length) ar++ }
  console.log(`archived plans ${arch?.length}; ever recalibrated ${ar}`)
  const { count } = await sb.from('ops_events').select('*', { count: 'exact', head: true }).ilike('event', '%recalib%')
  console.log(`ops_events matching %recalib%: ${count ?? 'n/a'}`)
}
main()
