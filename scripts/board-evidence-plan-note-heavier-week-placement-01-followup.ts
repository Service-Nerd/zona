// Coaching Board follow-up evidence, 2026-11-20 — PLAN-NOTE-HEAVIER-WEEK-PLACEMENT-01.
// READ-ONLY: generates plans in memory and SELECTs from production. Writes nothing.
//
//   npx tsx scripts/board-evidence-plan-note-heavier-week-placement-01-followup.ts [stride] [tier]
//
// (A) Does the week-N mark reach every warned plan? warned (validatePlan ramp codes, on the plan the runner
//     receives) vs carriers of load_residual_week; does week N exist in plan.weeks; how many warned weeks per plan.
// (B) Where week N sits: index (is there a week before it, so it is visible as "Next" first?).
// (C) The plan-level tile at four ranks. The ordering is a REPLICA of planRationaleNotes, asserted identical to
//     the real producer at today's rank on every plan before any other rank is read.
// (D) Production: carriers and whether week N is past / current / future.
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'
import { generateRulePlan } from '../lib/plan/ruleEngine'
import { composePlanWithFoundation } from '../lib/plan/foundationCompose'
import { cohortGrid, COHORT_PLAN_START } from '../lib/plan/cohortGrid'
import { validatePlan } from '../lib/plan/invariants'
import { RAMP_RESIDUAL_CODES } from '../lib/plan/loadResidualNote'
import { planRationaleNotes, levelFitNote, onsetYieldNote, PLAN_RATIONALE_MAX_NOTES, PLAN_RATIONALE_MAX_WORDS } from '../lib/plan/planRationale'

const stride = Number(process.argv[2] ?? 23)
const tier = (process.argv[3] ?? 'free') as any
if (stride % 2 === 0) { console.error('odd stride only'); process.exit(2) }
const bump = (m: Record<string, number>, k: string) => { m[k] = (m[k] ?? 0) + 1 }
const wc = (s: string) => s.trim().split(/\s+/).filter(Boolean).length

type N = { label: string; text: string }
type Rank = 'today' | 'behindLongRun' | 'lastConstraint' | 'deadLast' | 'goes'
function replica(meta: any, rank: Rank): string[] {
  const H: N | null = meta.load_residual_note && meta.load_residual_week != null ? { label: 'Heavier week', text: meta.load_residual_note } : null
  const notes: N[] = []
  const push = (n: N | null) => { if (n) notes.push(n) }
  if (meta.volume_constraint_note) push({ label: 'Maintenance', text: meta.volume_constraint_note })
  else if (meta.volume_shortfall_note) push({ label: 'Volume', text: meta.volume_shortfall_note })
  if (rank === 'today') push(H)
  if (meta.long_run_shortfall_note) push({ label: 'Long run', text: meta.long_run_shortfall_note })
  if (rank === 'behindLongRun') push(H)
  if (meta.short_opening_block_note) push({ label: 'Recovery week', text: meta.short_opening_block_note })
  if (meta.goal_below_easy_ceiling_note) push({ label: 'Your target', text: meta.goal_below_easy_ceiling_note })
  if (meta.fitness_signal_note) push({ label: 'Your level', text: meta.fitness_signal_note })
  if (meta.hard_pref_note) push({ label: 'Hard sessions', text: meta.hard_pref_note })
  const y = onsetYieldNote(meta); if (y) push({ label: 'Quality timing', text: y })
  if (meta.terrain_effort_note) push({ label: 'Off-road', text: meta.terrain_effort_note })
  if (meta.intensity_reentry_omission_note) push({ label: 'Coming back', text: meta.intensity_reentry_omission_note })
  if (rank === 'lastConstraint') push(H)
  if (meta.peak_shortfall_note && !meta.volume_constraint_note && !meta.volume_shortfall_note) push({ label: 'Your peak', text: meta.peak_shortfall_note })
  if (meta.frequency_constraint_note && !meta.volume_constraint_note && !meta.volume_shortfall_note && !meta.peak_shortfall_note) push({ label: 'Your days', text: meta.frequency_constraint_note })
  if (meta.returning_runner_note && !meta.intensity_reentry_omission_note) push({ label: 'Coming back', text: meta.returning_runner_note })
  const fit = levelFitNote(meta); if (fit) push({ label: 'Shaped for you', text: fit })
  if (rank === 'deadLast') push(H)
  const out: string[] = []; let words = 0
  for (const n of notes.slice(0, PLAN_RATIONALE_MAX_NOTES)) {
    const w = wc(n.text)
    if (out.length > 0 && words + w > PLAN_RATIONALE_MAX_WORDS) break
    out.push(n.label); words += w
  }
  return out
}

function engine() {
  // cohortGrid does not vary injury; argv[4] (e.g. knee,achilles) overlays one so the injury arm is reached.
  const inj = process.argv[4] ? process.argv[4].split(',') : null
  const grid = cohortGrid().filter((_, i) => i % stride === 0).map(x => inj ? { ...x, injury_history: inj } : x)
  let plans = 0, threw = 0, warned = 0, carriers = 0, warnedNotCarrier = 0, carrierNotWarned = 0
  let weekMissing = 0, weekIsFirst = 0, carrierWithFoundation = 0, replicaMismatch = 0
  const warnedWeeks: Record<string, number> = {}
  const shown: Record<Rank, number> = { today: 0, behindLongRun: 0, lastConstraint: 0, deadLast: 0, goes: 0 }
  const displacing: Record<Rank, number> = { today: 0, behindLongRun: 0, lastConstraint: 0, deadLast: 0, goes: 0 }
  const lost: Record<Rank, Record<string, number>> = { today: {}, behindLongRun: {}, lastConstraint: {}, deadLast: {}, goes: {} }
  const goesTileCount: Record<string, number> = {}
  const scope: Record<string, number> = {}
  for (const input of grid) {
    let plan: any
    try {
      const raw = generateRulePlan(input, tier, COHORT_PLAN_START, undefined, COHORT_PLAN_START)
      plan = composePlanWithFoundation(raw, input, COHORT_PLAN_START, 'add').plan
    } catch { threw++; continue }
    plans++
    const v = validatePlan(plan, input).filter(x => RAMP_RESIDUAL_CODES.includes(x.code) && x.ramp && x.week > 0)
    const isWarned = v.length > 0
    const meta = plan.meta as any
    const isCarrier = meta.load_residual_week != null && !!meta.load_residual_note
    if (isWarned) { warned++; bump(warnedWeeks, String(new Set(v.map(x => x.week)).size)) }
    if (isWarned && !isCarrier) warnedNotCarrier++
    if (!isWarned && isCarrier) carrierNotWarned++
    // the real producer vs the replica, at today's rank, on EVERY plan
    const real = planRationaleNotes(meta).map(n => n.label).join('|')
    if (real !== replica(meta, 'today').join('|')) replicaMismatch++
    if (!isCarrier) continue
    carriers++
    const weeks = plan.weeks as any[]
    const idx = weeks.findIndex(w => w.n === meta.load_residual_week)
    if (idx < 0) weekMissing++
    if (idx === 0) weekIsFirst++
    if (weeks.some(w => w.phase === 'foundation' || w.foundation)) carrierWithFoundation++
    bump(scope, /injury history/.test(meta.load_residual_note) ? 'injury (non_long)' : 'general (week)')
    const base = replica(meta, 'goes')
    bump(goesTileCount, String(base.length))
    for (const r of ['today', 'behindLongRun', 'lastConstraint', 'deadLast', 'goes'] as Rank[]) {
      const got = replica(meta, r)
      if (got.includes('Heavier week')) shown[r]++
      const gone = base.filter(l => !got.includes(l))
      if (gone.length) { displacing[r]++; gone.forEach(l => bump(lost[r], l)) }
    }
  }
  console.log(`\n== ENGINE cohortGrid stride ${stride}, tier ${tier}, injury ${inj ?? 'none'}: ${plans} plans (${threw} threw)`)
  console.log(`replica vs planRationaleNotes at today's rank: ${replicaMismatch} mismatches of ${plans}`)
  console.log(`(A) warned ${warned}; carriers ${carriers}; warned-not-carrier ${warnedNotCarrier}; carrier-not-warned ${carrierNotWarned}`)
  console.log(`(A) distinct warned weeks per warned plan`, warnedWeeks)
  console.log(`(B) week N missing from plan.weeks ${weekMissing}; week N is the plan's first week ${weekIsFirst}; carriers with a foundation block ${carrierWithFoundation}`)
  console.log(`(B) note scope among carriers`, scope)
  console.log(`(C) tiles shown with the heavier tile GONE`, goesTileCount)
  for (const r of ['today', 'behindLongRun', 'lastConstraint', 'deadLast', 'goes'] as Rank[]) {
    console.log(`(C) ${r}: heavier shown ${shown[r]}/${carriers}; plans displacing another tile ${displacing[r]}`, lost[r])
  }
}

async function live() {
  const env = readFileSync('/Users/russe/rts-training-hub/.env.local', 'utf8')
  const g = (k: string) => env.match(new RegExp(`^${k}=(.*)$`, 'm'))?.[1]?.trim() ?? ''
  const sb = createClient(g('NEXT_PUBLIC_SUPABASE_URL'), g('SUPABASE_SERVICE_ROLE_KEY'))
  const { data, error } = await sb.from('plans').select('user_id, plan_json')
  if (error) throw error
  const today = new Date().toISOString().slice(0, 10)
  let carriers = 0, stampedNoWeek = 0; const rel: Record<string, number> = {}
  for (const p of data!) {
    const pj = p.plan_json as any; const m = pj?.meta ?? {}
    if (m.load_residual_note && m.load_residual_week == null) stampedNoWeek++
    if (m.load_residual_week == null) continue
    carriers++
    const w = (pj.weeks ?? []).find((x: any) => x.n === m.load_residual_week)
    if (!w?.date) { bump(rel, 'no-date'); continue }
    const s = String(w.date).slice(0, 10); const e = new Date(new Date(s).getTime() + 7 * 86400000).toISOString().slice(0, 10)
    bump(rel, today < s ? 'future' : today >= e ? 'past' : 'current')
  }
  console.log(`\n== LIVE ${today}: plans ${data!.length}; carriers (week set) ${carriers}`, rel, `; old-style note with no week (never shown) ${stampedNoWeek}`)
}

live().then(engine).catch(e => { console.error(e); process.exit(1) })
