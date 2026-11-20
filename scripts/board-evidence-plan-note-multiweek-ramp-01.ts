// Coaching Board evidence, 2026-11-20 — PLAN-NOTE-MULTIWEEK-RAMP-01. READ-ONLY: generates plans in memory,
// SELECTs from production. Writes nothing.
//   NODE_ENV=production npx tsx scripts/board-evidence-plan-note-multiweek-ramp-01.ts [stride] [injury,csv]
// For each warned plan: distinct warned weeks, which week the note names, the other warned weeks' rises,
// their distance from the named week, their phase, code and scope, and whether they sit in a run of consecutive weeks.
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'
import { generateRulePlan } from '../lib/plan/ruleEngine'
import { composePlanWithFoundation } from '../lib/plan/foundationCompose'
import { cohortGrid, COHORT_PLAN_START } from '../lib/plan/cohortGrid'
import { validatePlan } from '../lib/plan/invariants'
import { RAMP_RESIDUAL_CODES } from '../lib/plan/loadResidualNote'

const stride = Number(process.argv[2] ?? 23)
const inj = process.argv[3] ? process.argv[3].split(',') : null
const bump = (m: Record<string, number>, k: string | number) => { m[String(k)] = (m[String(k)] ?? 0) + 1 }
const q = (a: number[], p: number) => { if (!a.length) return NaN; const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(p * s.length))] }

function engine() {
  const grid = cohortGrid().filter((_, i) => i % stride === 0).map(x => inj ? { ...x, injury_history: inj } : x)
  let plans = 0, threw = 0, warned = 0, multi = 0, namedIsLargest = 0, namedNotLargest = 0
  const nWeeks: Record<string, number> = {}, gap: Record<string, number> = {}, otherPhase: Record<string, number> = {}
  const otherCode: Record<string, number> = {}, otherScope: Record<string, number> = {}, relPos: Record<string, number> = {}
  const byDist: Record<string, [number, number]> = {}
  let othersAboveCapPlus10 = 0, othersAtLeast20 = 0, adjacentToNamed = 0, othersTotal = 0
  let otherRiseFracOfNamed: number[] = [], otherRises: number[] = [], namedRises: number[] = []
  let multiWithNonAdjacentOther = 0
  for (const input of grid) {
    let plan: any
    try {
      const raw = generateRulePlan(input, 'free', COHORT_PLAN_START, undefined, COHORT_PLAN_START)
      plan = composePlanWithFoundation(raw, input, COHORT_PLAN_START, 'add').plan
    } catch { threw++; continue }
    plans++
    const d = String(input.race_distance_km); byDist[d] ??= [0, 0]
    const v = validatePlan(plan, input).filter(x => RAMP_RESIDUAL_CODES.includes(x.code) && x.ramp && x.week > 0)
    if (!v.length) continue
    warned++; byDist[d][0]++
    // per week: max rise across codes
    const perWeek = new Map<number, any>()
    for (const x of v) { const c = perWeek.get(x.week); if (!c || (x.ramp?.rise_pct ?? 0) > (c.ramp?.rise_pct ?? 0)) perWeek.set(x.week, x) }
    bump(nWeeks, Math.min(perWeek.size, 4) + (perWeek.size >= 4 ? '+' : ''))
    const named = plan.meta.load_residual_week
    const largest = Array.from(perWeek.values()).reduce((a, b) => b.ramp.rise_pct > a.ramp.rise_pct ? b : a)
    if (largest.week === named) namedIsLargest++; else namedNotLargest++
    if (perWeek.size < 2) continue
    multi++; byDist[d][1]++
    const namedV = perWeek.get(named)
    namedRises.push(namedV?.ramp.rise_pct ?? NaN)
    let anyNonAdj = false
    const weeks = plan.weeks as any[]
    for (const [wk, x] of Array.from(perWeek.entries())) {
      if (wk === named) continue
      othersTotal++
      const g = Math.abs(wk - named); bump(gap, g >= 5 ? '5+' : g)
      if (g === 1) adjacentToNamed++; else anyNonAdj = true
      bump(relPos, wk < named ? 'before named' : 'after named')
      const w = weeks.find(z => z.n === wk); bump(otherPhase, w?.phase ?? '?')
      bump(otherCode, x.code); bump(otherScope, x.ramp.scope)
      otherRises.push(x.ramp.rise_pct)
      if (namedV) otherRiseFracOfNamed.push(x.ramp.rise_pct / namedV.ramp.rise_pct)
      if (x.ramp.rise_pct >= 20) othersAtLeast20++
      if (x.ramp.rise_pct > x.ramp.cap_pct + 10) othersAboveCapPlus10++
    }
    if (anyNonAdj) multiWithNonAdjacentOther++
  }
  const pct = (a: number, b: number) => `${a} of ${b} (${(100 * a / b).toFixed(1)}%)`
  console.log(`\n== cohortGrid stride ${stride}, injury ${inj ?? 'none'}: ${plans} plans (${threw} threw)`)
  console.log(`warned ${warned}; multi-week ${pct(multi, warned)}`)
  console.log(`distinct warned weeks per warned plan`, nWeeks)
  console.log(`named week is the largest rise across both codes: ${namedIsLargest}; is not (injury arm preferred) ${namedNotLargest}`)
  console.log(`unnamed warned weeks: ${othersTotal}; adjacent to named ${adjacentToNamed}; plans with a NON-adjacent unnamed week ${pct(multiWithNonAdjacentOther, multi)}`)
  console.log(`gap from named`, gap, relPos)
  console.log(`unnamed weeks' phase`, otherPhase, `code`, otherCode, `scope`, otherScope)
  console.log(`unnamed rises: p10 ${q(otherRises, .1).toFixed(0)} median ${q(otherRises, .5).toFixed(0)} p90 ${q(otherRises, .9).toFixed(0)}; >=20% ${othersAtLeast20}`)
  console.log(`named rises (multi plans): median ${q(namedRises, .5).toFixed(0)}; unnamed/named ratio median ${q(otherRiseFracOfNamed, .5).toFixed(2)} p90 ${q(otherRiseFracOfNamed, .9).toFixed(2)}`)
  console.log(`by distance [warned, multi]`, byDist)
}

async function live() {
  const env = readFileSync('/Users/russe/rts-training-hub/.env.local', 'utf8')
  const g = (k: string) => env.match(new RegExp(`^${k}=(.*)$`, 'm'))?.[1]?.trim() ?? ''
  const sb = createClient(g('NEXT_PUBLIC_SUPABASE_URL'), g('SUPABASE_SERVICE_ROLE_KEY'))
  const { data, error } = await sb.from('plans').select('user_id, plan_json')
  if (error) throw error
  let carriers = 0
  for (const p of data!) if ((p.plan_json as any)?.meta?.load_residual_week != null) carriers++
  console.log(`\n== LIVE: plans ${data!.length}; carriers with load_residual_week ${carriers} (warned-week count not stored, so multi-week is not measurable in production)`)
}
live().then(engine).catch(e => { console.error(e); process.exit(1) })
