/**
 * `INJURY-RECENCY-01` — Coaching Board evidence, 2026-11-20. READ-ONLY (generates plans in memory, SELECTs only).
 *
 * The deliverable the Design Board sent back: what each recency ANSWER changes, per injury, measured the way
 * the 2026-11-14 chip table was. A bucket can only map onto engine states that already exist (the board does
 * not invent caps), so each candidate mapping is measured as a SUBSTITUTION of the chip the wizard sends:
 *
 *   chip as sent            = "current" (today's behaviour)
 *   chip removed            = the chip's every effect lifted, INCLUDING the any-injury gates
 *   'Back'  → 'Hip'         = back's long-run time cap lifted, the any-injury gates KEPT (Hip reaches only those)
 *   'Plantar fasciitis' → 'Calf'
 *                           = plantar's long-run time cap lifted, its hill swap and delivered cap KEPT
 *                             (calf sits in HILL_RESTRICTING_INJURIES and DELIVERED_CAP_INJURIES, not in
 *                             LONG_RUN_CAP_MINUTES_BY_INJURY)
 *
 * Run: npx tsx scripts/board-evidence-injury-recency-01.ts
 */
import { createClient } from '@supabase/supabase-js'
import { loadEnvConfig } from '@next/env'
import { generateRulePlan } from '../lib/plan/ruleEngine'
import type { GeneratorInput, Plan } from '../types/plan'

loadEnvConfig(process.cwd())
const PS = '2026-12-07'
const BASE: any = {
  age: 38, goal: 'finish', terrain: 'road', race_date: '2027-04-25', race_name: 'R', training_age: '1-2yr',
  days_available: 4, race_distance_km: 42.2, current_weekly_km: 20, longest_recent_run_km: 10,
  preferred_long_run_day: 'sun', recent_quality_training: 'occasional', hard_session_relationship: 'neutral',
}

function shape(plan: Plan) {
  const loading = plan.weeks.filter(w => (w.n ?? 0) >= 1 && w.type !== 'race')
  let lr = 0, hillWeeks = 0, quality = 0
  for (const w of loading) {
    let hill = false
    for (const s of Object.values(w.sessions) as any[]) {
      if (!s) continue
      if (/long/i.test(String(s.label ?? '')) || s.role === 'long') lr = Math.max(lr, s.distance_km ?? 0)
      if (/hill strides/i.test(String(s.label ?? ''))) hill = true
      if (s.type === 'quality' || s.type === 'intervals' || s.type === 'tempo') quality++
    }
    if (hill) hillWeeks++
  }
  const peak = Math.max(...loading.map(w => w.weekly_km))
  return `peak ${peak} · LR ${lr} · hill wks ${hillWeeks} · quality ${quality} · ${(plan.meta as any).volume_profile ?? '-'}`
}

function run(label: string, inj: string[], over: any) {
  const input = { ...BASE, ...over, injury_history: inj } as GeneratorInput
  try { return `${label.padEnd(26)} ${shape(generateRulePlan(input, 'paid', PS) as Plan)}` }
  catch (e: any) { return `${label.padEnd(26)} REFUSED/THREW: ${String(e?.message ?? e).slice(0, 80)}` }
}

const CASES: Array<[string, any]> = []
for (const dist of [42.2, 21.1]) for (const cw of [20, 40]) for (const lvl of ['intermediate', 'beginner'])
  CASES.push([`${dist} km · ${cw} km/wk · ${lvl}`, { race_distance_km: dist, current_weekly_km: cw, user_declared_level: lvl,
    training_age: lvl === 'beginner' ? '<6mo' : '1-2yr', recent_quality_training: lvl === 'beginner' ? 'none' : 'occasional',
    longest_recent_run_km: Math.round(cw * 0.45) }])

for (const [name, over] of CASES) {
  console.log(`\n## ${name}`)
  console.log(run('none', [], over))
  for (const chip of ['Knee', 'Shin splints', 'Back', 'Plantar fasciitis', 'Achilles', 'Hip']) console.log(run(chip, [chip], over))
  console.log(run('Back → Hip (LR cap lifted)', ['Hip'], over))
  console.log(run('Plantar → Calf (LR cap lifted)', ['Calf'], over))
}

async function live() {
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })
  const { data, error } = await db.from('plans').select('user_id, plan_json')
  if (error) throw new Error(error.message)
  const tally: Record<string, number> = {}
  let withInput = 0, withAny = 0
  for (const p of data ?? []) {
    const gi = (p.plan_json as any)?.meta?.generator_input
    if (!gi) continue
    withInput++
    const h: string[] = gi.injury_history ?? []
    if (h.length) withAny++
    for (const c of h) tally[c] = (tally[c] ?? 0) + 1
  }
  console.log(`\nLIVE: ${(data ?? []).length} plans, ${withInput} carry generator_input, ${withAny} with any injury chip`, tally)
}
live().catch(e => { console.error(e); process.exit(1) })
