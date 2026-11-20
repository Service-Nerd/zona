// Coaching Board evidence, 2026-11-20 — INJURY-HIP-INERT-01. READ-ONLY: generates plans in memory,
// SELECTs from production. Writes nothing.
//   NODE_ENV=production npx tsx scripts/board-evidence-injury-hip-inert-01.ts [stride]
// (A) Run plan: identical input with injury_history [] vs ['Hip'] (the wizard spelling), whole cohortGrid at a stride.
//     A plan "differs" if its weeks' sessions differ (meta.generated_at ignored). Breakdown by what moved.
// (B) Strength: which catalogue lifts the hip tag slows (INJURY_LOADED_MUSCLES.hip) and which it avoids/blocks.
// (C) Production: hip runners, strength_plans rows, lift logs.
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'
import { generateRulePlan } from '../lib/plan/ruleEngine'
import { composePlanWithFoundation } from '../lib/plan/foundationCompose'
import { cohortGrid, COHORT_PLAN_START } from '../lib/plan/cohortGrid'
import { hasInjuryKeyword } from '../lib/plan/injuryScope'
import { CATALOGUE } from '../packages/strength/catalogue'
import { STRENGTH_CONFIG as C } from '../packages/strength/config'

const stride = Number(process.argv[2] ?? 23)
const bump = (m: Record<string, number>, k: string) => { m[k] = (m[k] ?? 0) + 1 }
const gen = (input: any) => {
  const raw = generateRulePlan(input, 'free', COHORT_PLAN_START, undefined, COHORT_PLAN_START)
  return composePlanWithFoundation(raw, input, COHORT_PLAN_START, 'add').plan as any
}
const sig = (p: any) => JSON.stringify(p.weeks)
const qCount = (p: any) => p.weeks.reduce((a: number, w: any) => a + Object.values(w.sessions).filter((s: any) => s && (s.type === 'quality' || s.type === 'intervals')).length, 0)
const firstQ = (p: any) => p.weeks.findIndex((w: any) => Object.values(w.sessions).some((s: any) => s && s.type === 'quality'))
const peakKm = (p: any) => Math.max(...p.weeks.map((w: any) => w.weekly_km ?? 0))
const notesOf = (p: any) => p.weeks.flatMap((w: any) => Object.values(w.sessions).map((s: any) => s?.coach_notes ?? ''))

function engine() {
  const grid = cohortGrid().filter((_, i) => i % stride === 0)
  let n = 0, threw = 0, differ = 0, metaOnly = 0
  const what: Record<string, number> = {}, byQ: Record<string, [number, number]> = {}
  for (const input of grid) {
    let a: any, b: any
    try { a = gen({ ...input, injury_history: [] }); b = gen({ ...input, injury_history: ['Hip'] }) } catch { threw++; continue }
    n++
    const k = `rqt=${(input as any).recent_quality_training ?? '-'} age=${(input as any).training_age ?? '-'} hsr=${(input as any).hard_session_relationship ?? '-'}`
    byQ[k] ??= [0, 0]; byQ[k][0]++
    if (sig(a) === sig(b)) { if (JSON.stringify({ ...a.meta, generated_at: 0, injury_history: 0 }) !== JSON.stringify({ ...b.meta, generated_at: 0, injury_history: 0 })) metaOnly++; continue }
    differ++; byQ[k][1]++
    if (firstQ(a) !== firstQ(b)) bump(what, `quality onset ${firstQ(a) < firstQ(b) ? 'later' : 'earlier'} with Hip`)
    if (qCount(a) !== qCount(b)) bump(what, `quality count ${qCount(b) < qCount(a) ? 'lower' : 'higher'} with Hip`)
    if (peakKm(a) !== peakKm(b)) bump(what, 'peak weekly km moved')
    const sa = notesOf(a).filter((x: string) => /step-back/i.test(x)).length, sb = notesOf(b).filter((x: string) => /step-back/i.test(x)).length
    if (sa !== sb) bump(what, `step-back long runs ${sa}->${sb}`)
    if (a.weeks.length !== b.weeks.length) bump(what, 'plan length moved')
  }
  console.log(`\n== (A) cohortGrid stride ${stride}: ${n} pairs (${threw} threw); weeks differ with Hip: ${differ} (${(100 * differ / n).toFixed(1)}%); meta-only differences ${metaOnly}`)
  console.log('what moved', what)
  console.log('by strata [pairs, differ] (rows with differ>0)', Object.fromEntries(Object.entries(byQ).filter(([, v]) => v[1] > 0)))
  console.log(`grid strata total`, Object.keys(byQ).length)
}

function strength() {
  const m = C.INJURY_LOADED_MUSCLES.hip as readonly string[]
  const slowed = CATALOGUE.filter((e: any) => e.muscles.some((x: string) => m.includes(x)) && e.pattern !== 'warmup')
  const avoided = CATALOGUE.filter((e: any) => (e.avoid_with ?? []).includes('hip'))
  console.log(`\n== (B) strength: hip loaded muscles ${m.join(',')}; non-warm-up lifts whose progression it slows ${slowed.length} of ${CATALOGUE.filter((e: any) => e.pattern !== 'warmup').length}`)
  console.log(`   avoid_with includes hip: ${avoided.length}; hip in PLYO_RESTRICTING_INJURIES: ${(C.PLYO_RESTRICTING_INJURIES as string[]).includes('hip')}`)
  console.log(`   wizard 'Hip' matches strength tag 'hip': ${hasInjuryKeyword(['Hip'], 'hip')}`)
}

async function live() {
  const env = readFileSync('/Users/russe/rts-training-hub/.env.local', 'utf8')
  const g = (k: string) => env.match(new RegExp(`^${k}=(.*)$`, 'm'))?.[1]?.trim() ?? ''
  const sb = createClient(g('NEXT_PUBLIC_SUPABASE_URL'), g('SUPABASE_SERVICE_ROLE_KEY'))
  const { data: plans, error } = await sb.from('plans').select('user_id, plan_json')
  if (error) throw error
  const chips: Record<string, number> = {}; const hipUsers = new Set<string>()
  for (const p of plans!) {
    const pj = p.plan_json as any
    const ih: string[] = pj?.meta?.generator_input?.injury_history ?? pj?.meta?.injury_history ?? []
    for (const c of ih) bump(chips, String(c))
    if (hasInjuryKeyword(ih, 'hip')) hipUsers.add(p.user_id)
  }
  const sp = await sb.from('strength_plans').select('user_id')
  const spUsers = new Set((sp.data ?? []).map((r: any) => r.user_id))
  console.log(`\n== (C) LIVE plans ${plans!.length}; injury chips`, chips)
  console.log(`   runners with Hip: ${hipUsers.size}; strength_plans rows ${sp.error ? 'ERR ' + sp.error.message : sp.data!.length}; hip runners with a strength plan ${[...hipUsers].filter(u => spUsers.has(u)).length}`)
  for (const t of ['strength_lift_logs', 'strength_logs', 'lift_logs']) {
    const r = await sb.from(t).select('user_id', { count: 'exact', head: true })
    if (!r.error) console.log(`   ${t} rows: ${r.count}`)
  }
}
live().then(() => { strength(); engine() }).catch(e => { console.error(e); process.exit(1) })
