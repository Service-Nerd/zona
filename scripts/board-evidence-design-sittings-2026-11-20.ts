// Design Board evidence, 2026-11-20 — five items, one read-only pass. READ-ONLY: selects only.
//
//   npx tsx scripts/board-evidence-design-sittings-2026-11-20.ts [stride]
//
// Live (production, service-role SELECTs):
//   (1) BENCHMARK-DATE-REQUIRED-01      — benchmarked plans, dateless count, dated ages
//   (2) PROFILE-BIRTH-YEAR-REQUIRED-01  — ageless runners; ageless WITH a stored max HR
//   (3) PLAN-NOTE-HEAVIER-WEEK-PLACEMENT-01 — live carriers of load_residual_week; is week N past/current/future
//   (4) METRIC-TOGGLE-SCOPE-01          — preferred_metric split; per-session overrides in use
//   (5) TUNE-UP-CALLOUT-INERT-01        — live carriers of week.tune_up_callout; past/current/future
// Engine (cohortGrid, ODD stride — even strides alias its 2^9 x 81 axes):
//   (3e) where week N sits (phase, deload, same week as the tune-up?)
//   (4e) share of rendered rows whose lead amount is in the chosen metric, both settings
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'
import { generateRulePlan } from '../lib/plan/ruleEngine'
import { composePlanWithFoundation } from '../lib/plan/foundationCompose'
import { cohortGrid, COHORT_PLAN_START } from '../lib/plan/cohortGrid'
import { buildSessionRows, resolveDisplayFigures } from '../lib/plan/sessionSteps'
import { composeSession } from '../lib/plan/sessionComposer'
import { formatDistance } from '@/lib/format'

const env = readFileSync('/Users/russe/rts-training-hub/.env.local', 'utf8')
const g = (k: string) => env.match(new RegExp(`^${k}=(.*)$`, 'm'))?.[1]?.trim() ?? ''
const sb = createClient(g('NEXT_PUBLIC_SUPABASE_URL'), g('SUPABASE_SERVICE_ROLE_KEY'))
const stride = Number(process.argv[2] ?? 131)
if (stride % 2 === 0) { console.error('odd stride only'); process.exit(2) }
const today = new Date().toISOString().slice(0, 10)
const bump = (m: Record<string, number>, k: string) => { m[k] = (m[k] ?? 0) + 1 }

function weekRelative(weeks: any[], n: number): string {
  const w = weeks.find(x => x.n === n)
  if (!w?.date) return 'no-date'
  const start = String(w.date).slice(0, 10)
  const end = new Date(new Date(start).getTime() + 7 * 86400000).toISOString().slice(0, 10)
  return today < start ? 'future' : today >= end ? 'past' : 'current'
}

async function live() {
  const { data: plans, error } = await sb.from('plans').select('user_id, plan_json')
  if (error) throw error
  console.log(`\n== LIVE (${today}) plans: ${plans!.length}`)

  // (1)
  let withBench = 0, dateless = 0; const ages: number[] = []
  for (const p of plans!) {
    const b = (p.plan_json as any)?.meta?.benchmark
    if (!b) continue
    withBench++
    if (!b.benchmark_date) { dateless++; continue }
    ages.push(Math.round((Date.parse(today) - Date.parse(b.benchmark_date)) / 86400000))
  }
  ages.sort((a, b) => a - b)
  console.log(`(1) benchmarked plans ${withBench}; DATELESS ${dateless}; dated ${ages.length}; ages(d) ${ages.join(',')}`)

  // (2)
  const { data: us, error: e2 } = await sb.from('user_settings').select('id, birth_year, date_of_birth, max_hr, max_hr_source, preferred_metric, preferred_units')
  if (e2) throw e2
  const planUsers = new Set(plans!.map(p => p.user_id))
  const ageless = us!.filter(u => u.birth_year == null)
  const agelessWithPlan = ageless.filter(u => planUsers.has(u.id))
  const agelessMax = ageless.filter(u => u.max_hr != null)
  console.log(`(2) ageless with a date_of_birth ${ageless.filter(u => (u as any).date_of_birth != null).length}; ageless plan-holders with stored max ${agelessWithPlan.filter(u => u.max_hr != null).length}`)
  const src: Record<string, number> = {}; agelessMax.forEach(u => bump(src, String(u.max_hr_source)))
  console.log(`(2) user_settings rows ${us!.length}; birth_year null ${ageless.length}; of those with a plan ${agelessWithPlan.length} (of ${us!.filter(u => planUsers.has(u.id)).length} with a plan); ageless WITH stored max_hr ${agelessMax.length}`, src)

  // (3) + (5)
  let lrw = 0; const lrwRel: Record<string, number> = {}
  let tune = 0; const tuneRel: Record<string, number> = {}; let both = 0, sameWeek = 0
  for (const p of plans!) {
    const pj = p.plan_json as any; const weeks = pj?.weeks ?? []
    const n = pj?.meta?.load_residual_week
    const tw = weeks.filter((w: any) => w.tune_up_callout)
    if (n) { lrw++; bump(lrwRel, weekRelative(weeks, n)) }
    if (tw.length) { tune++; for (const w of tw) bump(tuneRel, weekRelative(weeks, w.n)) }
    if (n && tw.length) { both++; if (tw.some((w: any) => w.n === n)) sameWeek++ }
  }
  console.log(`(3) live plans with load_residual_week ${lrw}; week N is`, lrwRel)
  console.log(`(5) live plans with a tune_up_callout ${tune} of ${plans!.length}; callout week is`, tuneRel, `; carry both ${both}, same week ${sameWeek}`)

  // (4)
  const pm: Record<string, number> = {}; us!.forEach(u => bump(pm, String(u.preferred_metric)))
  const pu: Record<string, number> = {}; us!.forEach(u => bump(pu, String(u.preferred_units)))
  const { data: smo, error: e4 } = await sb.from('session_metric_overrides').select('user_id, metric, superseded_at')
  if (e4) console.log('  session_metric_overrides error', e4.message)
  const active = (smo ?? []).filter(r => !r.superseded_at)
  const mm: Record<string, number> = {}; active.forEach(r => bump(mm, String(r.metric)))
  // (4b) which sessions the live per-session overrides sit on
  const { data: smo2 } = await sb.from('session_metric_overrides').select('user_id, week_n, session_key, metric').is('superseded_at', null)
  const planBy = new Map(plans!.map(p => [p.user_id, p.plan_json as any]))
  const on: Record<string, number> = {}
  for (const r of smo2 ?? []) {
    const pj = planBy.get(r.user_id); const w = pj?.weeks?.find((x: any) => x.n === r.week_n)
    const sess = w?.sessions?.[r.session_key]
    const anchor = !sess ? 'session not found' : sess.distance_km != null ? 'distance-anchored' : 'duration-anchored'
    bump(on, `${r.metric} on ${anchor} (${sess?.type ?? '?'})`)
  }
  console.log('(4b) active overrides by target session', on)
  console.log(`(4) preferred_metric`, pm, `preferred_units`, pu, `; session_metric_overrides rows ${smo?.length ?? 0} (active ${active.length}, users ${new Set(active.map(r => r.user_id)).size})`, mm)
}

function engine() {
  const grid = cohortGrid().filter((_, i) => i % stride === 0)
  let plans = 0, failed = 0, carriers = 0
  const phase: Record<string, number> = {}; let deload = 0, sameAsTune = 0, tuneCarriers = 0
  const posFrac: number[] = []
  const lead = { distance: { rows: 0, match: 0 }, duration: { rows: 0, match: 0 } }
  const missBy: Record<string, number> = {}
  const isDistUnit = (u: string) => /^(km|mi|m)$/.test(u.trim())
  const isTimeUnit = (u: string) => /^(min|s|sec|h|hrs?)$/.test(u.trim())
  let other = 0
  for (const input of grid) {
    let plan: any
    try {
      const raw = generateRulePlan(input, 'trial', COHORT_PLAN_START, undefined, COHORT_PLAN_START)
      plan = composePlanWithFoundation(raw, input, COHORT_PLAN_START, 'add').plan
    } catch { failed++; continue }
    plans++
    const weeks = plan.weeks as any[]
    const n = plan.meta?.load_residual_week
    const tw = weeks.filter(w => w.tune_up_callout)
    if (tw.length) tuneCarriers++
    if (n) {
      carriers++
      const w = weeks.find(x => x.n === n)
      bump(phase, String(w?.phase))
      if (w?.type === 'deload') deload++
      if (tw.some(x => x.n === n)) sameAsTune++
      posFrac.push(weeks.findIndex(x => x.n === n) / weeks.length)
    }
    for (const metric of ['distance', 'duration'] as const) {
      for (const w of weeks) for (const s of Object.values(w.sessions ?? {}) as any[]) {
        if (!s) continue
        const structure = composeSession({ session: s })
        if (!structure) continue
        const opts = { metric, units: 'km' as const, formatDist: (km: number) => formatDistance(km, 'km', { exact: true }) ?? '—' }
        const figures = resolveDisplayFigures(structure, { ...opts, sessionDistanceKm: s.distance_km ?? undefined })
        const rows = buildSessionRows(structure, s.derived_set, { ...opts, figures, raceSegmentTarget: '', raceSegmentSecondary: '' })
        for (const r of rows) {
          if (r.row.role === 'Strides') continue
          const u = (r.row as any).amountUnit as string
          if (!isDistUnit(u) && !isTimeUnit(u)) { other++; continue }
          lead[metric].rows++
          if (metric === 'distance' ? isDistUnit(u) : isTimeUnit(u)) lead[metric].match++
          else if (metric === 'distance') bump(missBy, `${structure.main.distance_km != null ? 'distance-anchored' : 'duration-anchored'} session · ${r.section}`)
        }
      }
    }
  }
  posFrac.sort((a, b) => a - b)
  console.log(`\n== ENGINE cohortGrid stride ${stride}: ${plans} plans (${failed} threw)`)
  console.log(`(3e) load_residual_week carriers ${carriers}; phase`, phase, `; week N is a deload ${deload}; same week as tune-up ${sameAsTune}; median position ${posFrac[Math.floor(posFrac.length / 2)]?.toFixed(2)}`)
  console.log(`(5e) plans carrying a tune_up_callout ${tuneCarriers} of ${plans}`)
  for (const m of ['distance', 'duration'] as const) console.log(`(4e) setting=${m}: rows ${lead[m].rows}, lead in chosen metric ${lead[m].match} (${(100 * lead[m].match / lead[m].rows).toFixed(2)}%)`)
  console.log('(4e) distance-setting misses by cause', missBy)
  console.log(`(4e) rows with an amount unit neither distance nor time (excluded): ${other}`)
}

live().then(() => process.argv[3] === 'live' ? undefined : engine()).catch(e => { console.error(e); process.exit(1) })
