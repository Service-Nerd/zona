// Board evidence, 2026-11-20 follow-up — TUNE-UP-CALLOUT-INERT-01 (SLT, then Coaching Board).
// READ-ONLY: production SELECTs only; engine plans generated in memory, nothing written.
//
//   npx tsx scripts/board-evidence-tune-up-callout-inert-01-followup.ts [stride] [live|engine|both]
//
// Live:  (L1) carriers of week.tune_up_callout, callout week past/current/future, and the owner's tier
//        (L2) carriers that also carry meta.load_residual_week; same week?
// Engine (cohortGrid, ODD stride, NODE_ENV=production):
//        (E1) carriers of the tune-up; carriers of load_residual_week; SAME WEEK (the 13-in-58)
//        (E2) tune-up week carrying ANY ramp violation (INV-PLAN-DELIVERED-RAMP / -INJURY-CAP-DELIVERED),
//             not only the one week the note names
//        (E3) on a collision: tune-up week's phase, its position vs peak, quality sessions that week,
//             and whether an EARLIER non-deload build week with no ramp violation exists
import { readFileSync } from 'node:fs'
const env = readFileSync('/Users/russe/rts-training-hub/.env.local', 'utf8')
const g = (k: string) => env.match(new RegExp(`^${k}=(.*)$`, 'm'))?.[1]?.trim() ?? ''
process.env.NEXT_PUBLIC_SUPABASE_URL = g('NEXT_PUBLIC_SUPABASE_URL')
process.env.SUPABASE_SERVICE_ROLE_KEY = g('SUPABASE_SERVICE_ROLE_KEY')

import { createClient } from '@supabase/supabase-js'
import { generateRulePlan } from '../lib/plan/ruleEngine'
import { composePlanWithFoundation } from '../lib/plan/foundationCompose'
import { validatePlan } from '../lib/plan/invariants'
import { RAMP_RESIDUAL_CODES } from '../lib/plan/loadResidualNote'
import { cohortGrid, COHORT_PLAN_START } from '../lib/plan/cohortGrid'
import { isQualitySession } from '../lib/plan/sessionRole'
import { getUserTier } from '../lib/trial'

const stride = Number(process.argv[2] ?? 131)
const mode = process.argv[3] ?? 'both'
if (stride % 2 === 0) { console.error('odd stride only'); process.exit(2) }
const today = new Date().toISOString().slice(0, 10)
const bump = (m: Record<string, number>, k: string) => { m[k] = (m[k] ?? 0) + 1 }

function rel(weeks: any[], n: number): string {
  const w = weeks.find(x => x.n === n)
  if (!w?.date) return 'no-date'
  const start = String(w.date).slice(0, 10)
  const end = new Date(new Date(start).getTime() + 7 * 86400000).toISOString().slice(0, 10)
  return today < start ? 'future' : today >= end ? 'past' : 'current'
}

async function live() {
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
  const { data: plans, error } = await sb.from('plans').select('user_id, plan_json')
  if (error) throw error
  let carriers = 0, both = 0, same = 0
  const when: Record<string, number> = {}, tierAll: Record<string, number> = {}, tierAhead: Record<string, number> = {}
  for (const p of plans!) {
    const pj = p.plan_json as any; const weeks = pj?.weeks ?? []
    const tw = weeks.filter((w: any) => w.tune_up_callout)
    if (!tw.length) continue
    carriers++
    const r = rel(weeks, tw[0].n); bump(when, r)
    const tier = await getUserTier(p.user_id); bump(tierAll, String(tier))
    if (r === 'future' || r === 'current') bump(tierAhead, String(tier))
    const n = pj?.meta?.load_residual_week
    if (n) { both++; if (tw.some((w: any) => w.n === n)) same++ }
  }
  console.log(`\n== LIVE ${today}: plans ${plans!.length}`)
  console.log(`(L1) tune-up carriers ${carriers}; callout week`, when, `; owner tier (all carriers)`, tierAll, `; owner tier (week still ahead/current)`, tierAhead)
  console.log(`(L2) carriers also carrying load_residual_week ${both}; same week ${same}`)
}

function engine() {
  const prev = process.env.NODE_ENV
  ;(process.env as any).NODE_ENV = 'production'
  const grid = cohortGrid().filter((_, i) => i % stride === 0)
  let plans = 0, threw = 0, tune = 0, lrw = 0, same = 0, anyRamp = 0, anyRampNotNamed = 0
  const phase: Record<string, number> = {}, toPeak: Record<string, number> = {}, q: Record<string, number> = {}
  const dist: Record<string, number> = {}, distAll: Record<string, number> = {}, injury: Record<string, number> = {}
  const backBy: Record<string, number> = {}
  let earlierClean = 0, rampCodeOnTune: Record<string, number> = {}
  const rises: number[] = []
  for (const input of grid) {
    let plan: any
    try {
      const raw = generateRulePlan(input, 'trial', COHORT_PLAN_START, undefined, COHORT_PLAN_START)
      plan = composePlanWithFoundation(raw, input, COHORT_PLAN_START, 'add').plan
    } catch { threw++; continue }
    plans++
    const weeks = plan.weeks as any[]
    const tw = weeks.find(w => w.tune_up_callout)
    const n = plan.meta?.load_residual_week
    if (n) lrw++
    if (!tw) continue
    tune++
    bump(distAll, String(input.race_distance_km))
    const ramp = validatePlan(plan, input).filter(v => RAMP_RESIDUAL_CODES.includes(v.code) && (v as any).ramp && v.week > 0)
    const rampWeeks = new Set(ramp.map(v => v.week))
    const onTune = ramp.filter(v => v.week === tw.n)
    if (onTune.length) {
      anyRamp++
      onTune.forEach(v => bump(rampCodeOnTune, v.code))
      if (n !== tw.n) anyRampNotNamed++
      rises.push(Math.max(...onTune.map(v => (v as any).ramp.rise_pct)))
    }
    if (n && n === tw.n) {
      same++
      bump(phase, String(tw.phase))
      const firstPeak = weeks.find(w => w.phase === 'peak')?.n
      bump(toPeak, firstPeak == null ? 'no peak' : String(firstPeak - tw.n))
      const qn = Object.values(tw.sessions ?? {}).filter((s: any) => s && isQualitySession(s)).length
      bump(q, String(qn))
      bump(dist, String(input.race_distance_km))
      bump(injury, (input as any).injury_history?.length ? 'injury' : 'none')
      const earlier = weeks.filter(w => w.n >= 1 && w.n < tw.n && w.phase === 'build' && w.type !== 'deload' && !rampWeeks.has(w.n))
      if (earlier.length) { earlierClean++; bump(backBy, String(tw.n - Math.max(...earlier.map(w => w.n)))) }
    }
  }
  ;(process.env as any).NODE_ENV = prev
  rises.sort((a, b) => a - b)
  console.log(`\n== ENGINE cohortGrid stride ${stride}: ${plans} plans (${threw} threw)`)
  console.log(`(E1) tune-up carriers ${tune}; load_residual_week carriers ${lrw}; SAME WEEK ${same}`)
  console.log(`(E2) tune-up week carries ANY ramp violation ${anyRamp} of ${tune} (of which the note names a different week ${anyRampNotNamed}); codes`, rampCodeOnTune, `; rise% min/median/max ${rises[0]?.toFixed(1)}/${rises[Math.floor(rises.length / 2)]?.toFixed(1)}/${rises[rises.length - 1]?.toFixed(1)}`)
  console.log(`(E3) same-week collisions: phase`, phase, `; weeks to first peak week`, toPeak, `; quality sessions that week`, q, `; race km`, dist, `(carriers by race km`, distAll, `) ; injury`, injury, `; an earlier clean non-deload build week exists ${earlierClean} of ${same}; weeks back to the latest such week`, backBy)
}

;(async () => {
  if (mode !== 'engine') await live()
  if (mode !== 'live') engine()
})().catch(e => { console.error(e); process.exit(1) })
