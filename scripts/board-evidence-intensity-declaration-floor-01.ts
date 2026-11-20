// board-evidence-intensity-declaration-floor-01.ts — READ-ONLY. INTENSITY-DECLARATION-FLOOR-01, sitting 2026-11-20.
// Live plans whose INTENSITY level (what the catalogue gate reads) is above their STRUCTURAL level, and what the
// intensity level would be had the runner declared nothing (§79's assessed intensity).
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'
import { resolveLevels } from '../lib/plan/fitnessAssessment'
const env = readFileSync('/Users/russe/rts-training-hub/.env.local', 'utf8')
const g = (k: string) => env.match(new RegExp(`^${k}=(.*)$`, 'm'))?.[1]?.trim() ?? ''
const sb = createClient(g('NEXT_PUBLIC_SUPABASE_URL'), g('SUPABASE_SERVICE_ROLE_KEY'))
const RANK: Record<string, number> = { beginner: 0, intermediate: 1, experienced: 2 }
const QUALITY = /tempo|threshold|cv_|interval|vo2|hill|fartlek|goal_pace|race_sim|progressive|over_under|ladder|pyramid|mile/
async function main() {
  const { data: plans, error } = await sb.from('plans').select('user_id, plan_json')
  if (error) throw error
  let total = 0, upward = 0, declaredUp = 0
  const rows: string[] = []
  for (const p of plans ?? []) {
    const m = (p.plan_json as any)?.meta ?? {}
    total++
    const s = m.fitness_level, i = m.fitness_intensity_level ?? m.fitness_level
    if (!s || !i || RANK[i] <= RANK[s]) continue
    upward++
    const gi = m.generator_input ?? {}
    const declared = gi.user_declared_level ?? m.fitness_level_declared
    if (declared && declared === i) declaredUp++
    let undeclared = '?'
    try { undeclared = resolveLevels({ ...gi, user_declared_level: undefined, fitness_level: undefined }, m.vdot ?? undefined).intensity } catch {}
    const ids = new Set<string>()
    for (const w of (p.plan_json as any).weeks ?? []) for (const x of Object.values(w.sessions ?? {}).flat() as any[])
      if (x?.catalogue_id && QUALITY.test(x.catalogue_id)) ids.add(x.catalogue_id)
    let maxQ = 0, firstQ: number | null = null
    for (const w of (p.plan_json as any).weeks ?? []) {
      const q = (Object.values(w.sessions ?? {}).flat() as any[]).filter(x => x && ['quality', 'intervals', 'tempo', 'hard'].includes(x.type)).length
      if (q > maxQ) maxQ = q
      if (q > 0 && firstQ == null) firstQ = w.n
    }
    rows.push(`maxQ/wk=${maxQ} firstQwk=${firstQ ?? '—'} ` + `${String(p.user_id).slice(0, 8)} struct=${s} int=${i} declared=${declared ?? '—'} assessedInt=${undeclared} vdot=${m.vdot ?? '—'} wk=${gi.current_weekly_km ?? '?'} lr=${gi.longest_recent_run_km ?? '?'} age=${gi.training_age ?? '?'} rqt=${gi.recent_quality_training ?? "—"} reentry=${m.intensity_reentry_active ?? "—"}/${m.intensity_reentry_weeks ?? "—"} sex=${gi.sex ?? "—"} goal=${m.goal ?? gi.goal}/${m.race_distance_km}km q=[${Array.from(ids).join(',')}]`)
  }
  console.log(`plans ${total}; intensity above structural ${upward}; of those intensity == declaration ${declaredUp}`)
  rows.sort((a, b) => parseFloat(a.split('vdot=')[1]) - parseFloat(b.split('vdot=')[1])).forEach(r => console.log(' ', r))
}
main()
