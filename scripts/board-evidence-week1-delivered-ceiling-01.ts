/**
 * READ-ONLY board evidence, WEEK1-DELIVERED-CEILING-01 re-sitting 2026-11-20.
 * Same population as `board-evidence-week1-bound.ts`; breaks the OVER-CEILING plans down
 * by declared weekly km, declared longest run, plan shape, and what week 1 is made of.
 * Generates plans, writes nothing.
 */
import { cohortGrid, targetedGridExtra, COHORT_PLAN_START } from '../lib/plan/cohortGrid'
import { CHARITY_PERSONAS, charityInput, CHARITY_PLAN_START } from '../lib/plan/charityCohort'
import { generateRulePlan } from '../lib/plan/ruleEngine'
import { week1StepBaseKm } from '../lib/plan/startVolume'
import { week1Leap } from '../lib/plan/planQuality'
import { sessionKmSelfPaced } from '../lib/plan/sessionDistance'
import { isLongRun } from '../lib/plan/sessionRole'
import { GENERATION_CONFIG as G, raceDistanceKey } from '../lib/plan/generationConfig'
import type { GeneratorInput, Plan, Session, Week } from '../types/plan'

const STRIDE = 7919
const spread = (xs: GeneratorInput[], n: number) =>
  Array.from({ length: Math.min(n, xs.length) }, (_, k) => xs[(k * STRIDE) % xs.length]!)
const R = G.WIZARD_VOLUME_RULER
const LOW: number[] = []; for (let v = R.WEEKLY_KM_MIN; v <= 25; v += R.WEEKLY_KM_STEP) LOW.push(v)
const lowBase: GeneratorInput[] = []
for (const km of [5, 10, 21.1, 42.2]) for (const cwk of LOW) for (const lr of [0, 2, 5, 8])
  for (const w of [10, 12, 16, 20, 24, 30]) for (const d of [3, 4, 5]) {
    if (lr > cwk) continue
    lowBase.push({
      athlete_name: 'A', age: 38, race_name: 'T', primary_metric: 'distance',
      plan_start: COHORT_PLAN_START, race_distance_km: km,
      race_date: new Date(Date.parse(`${COHORT_PLAN_START}T00:00:00Z`) + w * 7 * 864e5).toISOString().slice(0, 10),
      goal: 'finish', days_available: d, days_cannot_train: [],
      current_weekly_km: cwk, longest_recent_run_km: lr,
      training_age: '<6mo', recent_quality_training: 'none',
      hard_session_relationship: 'neutral', injury_history: [], max_weekday_mins: 60,
      acknowledged_days_warning: true, acknowledged_prep_warning: true,
    } as unknown as GeneratorInput)
  }
const rows = [...lowBase.map(i => ['low', i] as const),
  ...spread(cohortGrid() as GeneratorInput[], 1500).map(i => ['cohort', i] as const),
  ...(targetedGridExtra() as GeneratorInput[]).map(i => ['targeted', i] as const),
  ...CHARITY_PERSONAS.map(p => ['charity', charityInput(p, CHARITY_PLAN_START)] as const)]

const ceilingOf = (i: GeneratorInput) => { const b = week1StepBaseKm(i); return Math.max(b * G.WEEK1_STEP_MAX_RATIO, b + G.WEEK1_STEP_MIN_ABS_KM) }
const sessionsOf = (w: Week) => Object.values(w.sessions ?? {}).filter(Boolean) as Session[]
const tally = new Map<string, number>()
const inc = (k: string) => tally.set(k, (tally.get(k) ?? 0) + 1)
let plans = 0, over = 0
const shapes: string[] = []
for (const [src, input] of rows) {
  let plan: Plan
  try { plan = generateRulePlan(input, 'trial', COHORT_PLAN_START, undefined, COHORT_PLAN_START) } catch { continue }
  plans++
  const w1 = plan.weeks.filter(w => (w.n ?? 0) >= 1 && w.type !== 'race')[0]; if (!w1) continue
  const del = w1.weekly_km ?? 0, ceil = ceilingOf(input)
  const leapAll = week1Leap(plan.weeks.filter(w => (w.n ?? 0) >= 1 && w.type !== 'race'), input, del)
  if (leapAll) inc(`LEAP-cell:${raceDistanceKey(input.race_distance_km)} cw${input.current_weekly_km} lr${input.longest_recent_run_km} src:${src}`)
  if (leapAll) inc(`OWNER-week1Leap(all plans):${input.current_weekly_km === 0 ? 'cw0' : 'cw>0'}:${leapAll.split(' ').slice(0,3).join(' ')}`)
  if (del <= ceil + 0.01) continue
  over++
  inc(`overCeil-ownerSaysLeap:${leapAll ? 'yes' : 'no'}:${input.current_weekly_km === 0 ? 'cw0' : 'cw>0'}`)
  const kind = String((plan.meta as any)?.plan_kind ?? ((plan as any).staged_race ? 'staged' : 'race'))
  const ss = sessionsOf(w1).filter(s => s.type !== 'rest')
  const lr = ss.find(isLongRun); const lrKm = lr ? (sessionKmSelfPaced(lr) ?? 0) : 0
  const durAnch = ss.filter(s => s.duration_mins && !s.distance_km).length
  const lrDecl = input.longest_recent_run_km ?? 0
  const overLr = ss.filter(x => (sessionKmSelfPaced(x) ?? 0) > lrDecl + 0.05).length
  inc(`sessionsOverDeclaredLR:${input.current_weekly_km === 0 ? 'cw0:' : 'cw>0:'}${overLr === 0 ? 'none' : 'some'}`)
  inc(`runwalk:${ss.some(x => /walk/i.test(JSON.stringify(x))) ? 'yes' : 'no'}:cw${input.current_weekly_km === 0 ? 0 : '>0'}`)
  if (overLr && input.current_weekly_km) inc(`overLR-detail:${raceDistanceKey(input.race_distance_km)} cw${input.current_weekly_km} lr${lrDecl} maxSess${Math.max(...ss.map(x => sessionKmSelfPaced(x) ?? 0)).toFixed(1)}`)
  inc(`src:${src}`); inc(`cw:${input.current_weekly_km}`); inc(`lr:${input.longest_recent_run_km}`)
  inc(`kind:${kind}`); inc(`phase:${w1.phase}`); inc(`dist:${raceDistanceKey(input.race_distance_km)}`)
  inc(`lrShare:${del > 0 ? (lrKm / del >= 0.4 ? '>=40%' : '<40%') : 'na'}`)
  inc(`durAnchored:${durAnch === ss.length ? 'all' : durAnch ? 'some' : 'none'}`)
  if (shapes.length < 40 && (input.current_weekly_km ?? 0) > 0 && shapes.length % 1 === 0 && false) shapes.push(`${raceDistanceKey(input.race_distance_km)} cw${input.current_weekly_km} lr${input.longest_recent_run_km} d${input.days_available} ${kind}/${w1.phase}: w1 ${del} ceil ${ceil.toFixed(1)} | ` + ss.map(s => `${s.type}${isLongRun(s) ? '(LR)' : ''}:${s.distance_km ?? '-'}km/${s.duration_mins ?? '-'}m`).join(' '))
}
console.log(`plans ${plans}  over-ceiling ${over}`)
for (const [k, v] of Array.from(tally.entries()).sort()) console.log(`  ${k.padEnd(24)} ${v}`)
console.log('examples:'); for (const s of shapes) console.log('  ' + s)

// ── Production (READ-ONLY): does any stored live plan carry WEEK1-LEAP by the owner? ──
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
async function prod() {
  for (const l of readFileSync('.env.local', 'utf8').split('\n')) {
    const m = l.match(/^([A-Z0-9_]+)=(.*)$/); if (m) process.env[m[1]] ??= m[2].replace(/^["']|["']$/g, '')
  }
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
  const { data, error } = await db.from('plans').select('id, plan_json'); if (error) throw error
  let n = 0, withInput = 0, leaps = 0, lowBase = 0
  for (const r of data as any[]) {
    n++
    const gi = r.plan_json?.meta?.generator_input as GeneratorInput | undefined
    if (!gi) continue
    withInput++
    if ((gi.current_weekly_km ?? 99) <= 15) lowBase++
    const ws = (r.plan_json.weeks as Week[]).filter(w => (w.n ?? 0) >= 1 && w.type !== 'race')
    if (!ws[0]) continue
    const l = week1Leap(ws, gi, ws[0].weekly_km ?? 0)
    if (l) { leaps++; console.log(`  PROD leap ${r.id.slice(0, 8)} ${raceDistanceKey(gi.race_distance_km)} cw${gi.current_weekly_km} lr${gi.longest_recent_run_km} d${gi.days_available} phase ${ws[0].phase} kind ${r.plan_json?.meta?.plan_kind ?? '-'} gen ${String(r.plan_json?.meta?.generated_at ?? '').slice(0,10)} | ${l} | ` + sessionsOf(ws[0]).filter(s => s.type !== 'rest').map(s => `${s.type}${isLongRun(s) ? '(LR)' : ''}:${s.distance_km ?? '-'}km/${s.duration_mins ?? '-'}m`).join(' ')) }
  }
  console.log(`PROD plans ${n} · stamped generator_input ${withInput} · declared <=15 km/wk ${lowBase} · WEEK1-LEAP by owner ${leaps}`)
}
prod()
