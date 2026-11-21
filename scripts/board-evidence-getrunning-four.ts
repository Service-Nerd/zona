/**
 * READ-ONLY board evidence, 2026-11-20, for four Coaching Board items sharing the
 * get-running / staged / §118 path:
 *   GETRUNNING-S111-DENOMINATOR-01 · GETRUNNING-WALKRUN-LRHALF-01 ·
 *   STAGED-RAMP-RATIO-16W-01 · WALKRUN-DELOAD-CLAIM-01
 *
 * Production sequence, as the wizard drives it: runEngine unprompted → if a refusal carries
 * a §118 `get_running` offer → runEngine with acceptBaseBuild. Inputs are wizard-reachable
 * (weekly ruler step 5, longest-run ruler step 1, longest <= weekly). No writes anywhere.
 *
 *   npx tsx scripts/board-evidence-getrunning-four.ts            # grid
 *   npx tsx scripts/board-evidence-getrunning-four.ts --prod     # + live plans (service role, SELECT only)
 */
import { runEngine } from '@/lib/plan/engine'
import { validatePlan } from '@/lib/plan/invariants'
import { validateBaseBuildBlock, validateStagedRace, volumeCappedRampOf } from '@/lib/plan/baseBuildValidate'
import { generateGetRunningPlan, getRunningWeeks } from '@/lib/plan/getRunningPlan'
import { composeWalkRunStart, walkRunStartWeeks, walkRunSchedule } from '@/lib/plan/walkRunStart'
import { stagedRaceOf } from '@/lib/plan/stagedRacePlan'
import { GENERATION_CONFIG as G } from '@/lib/plan/generationConfig'
import type { GeneratorInput, Plan } from '@/types/plan'

const PLAN_START = '2026-11-23'
const addWeeks = (iso: string, w: number) => new Date(Date.parse(`${iso}T00:00:00Z`) + w * 7 * 864e5).toISOString().slice(0, 10)
const bbStart = (p: Plan) => Number((p.meta as unknown as Record<string, unknown>).base_build_start_km ?? 0)
const codes = (vs: { code: string; severity: string }[]) => vs.map(v => `${v.code}:${v.severity}`)

function mk(o: Partial<GeneratorInput>): GeneratorInput {
  return {
    race_distance_km: 42.195, race_date: addWeeks(PLAN_START, 26), days_available: 3, goal: 'finish',
    current_weekly_km: 5, longest_recent_run_km: 2, age: 35, injuries: [],
    recent_quality_training: 'none', training_age: '<6mo', user_declared_level: 'beginner',
    ...o,
  } as unknown as GeneratorInput
}

type Row = { input: GeneratorInput; route: 'staged' | 'accepted'; plan: Plan }

function grid(): Row[] {
  const rows: Row[] = []
  const quiet = console.error; console.error = () => {}
  try {
    for (const d of [5, 10, 21.0975, 42.195]) for (const cw of [0, 5, 10, 15, 20, 25, 30])
      for (const lr of [0, 1, 2, 3, 4, 6, 8, 12]) for (const rw of [10, 12, 16, 20, 24, 28, 32, 40])
        for (const ta of ['<6mo', '6-18mo'] as const) {
          if (lr > cw) continue
          const input = mk({ race_distance_km: d, current_weekly_km: cw, longest_recent_run_km: lr,
            race_date: addWeeks(PLAN_START, rw), training_age: ta })
          let out
          try { out = runEngine({ input, tier: 'free', displayUnits: 'km', planStart: PLAN_START, today: '2026-11-20' }) } catch { continue }
          if (out.kind === 'base_build') { rows.push({ input, route: 'staged', plan: out.plan }); continue }
          if (out.kind === 'refusal' && (out.body as Record<string, unknown>).get_running) {
            try {
              const acc = runEngine({ input, tier: 'free', displayUnits: 'km', planStart: PLAN_START, today: '2026-11-20', acceptBaseBuild: true })
              if (acc.kind === 'base_build') rows.push({ input, route: 'accepted', plan: acc.plan })
            } catch { /* engine fault: not counted */ }
          }
        }
  } finally { console.error = quiet }
  return rows
}

const rows = grid()
const staged = rows.filter(r => r.route === 'staged'), accepted = rows.filter(r => r.route === 'accepted')
console.log(`grid rows reaching a base_build plan: ${rows.length}  (staged ${staged.length}, accepted §118 ${accepted.length})`)

// ── 1. GETRUNNING-S111-DENOMINATOR-01 ──────────────────────────────────────────────────────
console.log('\n── 1. §111 denominators ──')
for (const [name, set] of [['staged', staged], ['accepted', accepted]] as const) {
  let blk = 0, raw = 0, both = 0, wr = 0
  const rawAt: Record<string, number> = {}
  for (const r of set) {
    const bb = validateBaseBuildBlock(r.plan.weeks, bbStart(r.plan), { volumeCappedInjury: volumeCappedRampOf(r.plan) }).some(v => v.code === 'INV-PLAN-GET-RUNNING-BUILD-RATIO')
    const vp = validatePlan(r.plan, r.input).some(v => v.code === 'INV-PLAN-BASE-BUILD-RATIO')
    if (r.plan.weeks.some(w => w.phase === 'walk_run_start')) wr++
    if (bb) blk++
    if (vp) { raw++; const k = `cw${r.input.current_weekly_km}/${r.input.race_distance_km}`; rawAt[k] = (rawAt[k] ?? 0) + 1 }
    if (bb && vp) both++
  }
  console.log(`  ${name}: n=${set.length} walk-run-start=${wr}  BLOCK-start ratio fires=${blk}  RAW validatePlan §111 fires=${raw}  both=${both}`)
  console.log(`     raw firings by cw/distance: ${JSON.stringify(rawAt)}`)
}
// The item's own case, cw 2 (NOT wizard-reachable: ruler step 5), reproduced:
{
  const input = mk({ current_weekly_km: 2, longest_recent_run_km: 1, race_date: '2027-04-25' })
  const { plan, endsAtKm } = generateGetRunningPlan(input, '2026-10-05', 29)
  const raw = validatePlan(plan, input).find(v => v.code === 'INV-PLAN-BASE-BUILD-RATIO')
  console.log(`  item case cw2/lr1 runway29: block start ${bbStart(plan)}, ends ${endsAtKm} → block ratio ${(endsAtKm / bbStart(plan)).toFixed(2)}x; raw verdict: ${raw ? raw.actual : 'none'}`)
}

// ── 2. GETRUNNING-WALKRUN-LRHALF-01 ────────────────────────────────────────────────────────
console.log('\n── 2. LR half (accepted §118 plans at/above floor with lr < 2) ──')
{
  const lrWarn = accepted.filter(r => validateStagedRace(r.plan).some(v => v.code === 'INV-PLAN-WALKRUN-START-PROGRESSION' && v.severity === 'warn'))
  const shape = accepted.filter(r => r.input.current_weekly_km >= G.BASE_BUILD_ONRAMP_MIN_START_KM && r.input.longest_recent_run_km! < G.WALK_RUN_START_MIN_LONGEST_RUN_KM)
  console.log(`  accepted=${accepted.length}  shape(cw>=floor & lr<2)=${shape.length}  carrying the LR-half warn=${lrWarn.length}`)
  const byCw: Record<number, number> = {}; for (const r of shape) byCw[r.input.current_weekly_km] = (byCw[r.input.current_weekly_km] ?? 0) + 1
  console.log(`  shape by cw: ${JSON.stringify(byCw)}  by lr: ${JSON.stringify(shape.reduce((a, r) => { a[r.input.longest_recent_run_km!] = (a[r.input.longest_recent_run_km!] ?? 0) + 1; return a }, {} as Record<number, number>))}`)
  // Cost of honouring Am. 7 on §118: endpoint today vs. a walk-run-start composition of the same plan length.
  console.log('  endpoint today vs walk-run-composed (same plan length), cw × runway:')
  for (const cw of [5, 6, 8, 10, 12, 15, 20]) {
    const parts: string[] = []
    for (const rw of [10, 15, 20, 29]) {
      const input = mk({ current_weekly_km: cw, longest_recent_run_km: 1 })
      const today = generateGetRunningPlan(input, PLAN_START, rw)
      const wrW = walkRunStartWeeks(), budget = getRunningWeeks(rw) - wrW, ramp = budget < 2 ? 0 : budget
      const c = composeWalkRunStart(input, { planStart: PLAN_START, rampStart: addWeeks(PLAN_START, wrW), rampWeeks: ramp, remainingWeeks: Math.max(0, rw - wrW - ramp) })
      parts.push(`rw${rw}: ${today.endsAtKm}→${c.endsAtKm} (${(c.endsAtKm - today.endsAtKm).toFixed(1)})`)
    }
    console.log(`    cw${cw}: ${parts.join('  ')}`)
  }
  // Week 1 of today's plan for the shape: continuous run lengths
  const ex = mk({ current_weekly_km: 10, longest_recent_run_km: 1 })
  const p = generateGetRunningPlan(ex, PLAN_START, 20).plan
  const w1 = Object.values(p.weeks[0].sessions ?? {}).filter((s: any) => s && s.type !== 'rest').map((s: any) => `${s.label ?? s.type} ${s.distance_km ?? '-'}km ${s.duration_mins ?? '-'}min run_walk=${!!s.run_walk}`)
  console.log(`  example cw10/lr1 week 1: ${w1.join(' | ')}`)
}

// ── 3. STAGED-RAMP-RATIO-16W-01 ─────────────────────────────────────────────────────────────
console.log('\n── 3. staged ramp ratio ──')
{
  const fire = staged.filter(r => validateBaseBuildBlock(r.plan.weeks, bbStart(r.plan), { volumeCappedInjury: volumeCappedRampOf(r.plan) }).some(v => v.code === 'INV-PLAN-GET-RUNNING-BUILD-RATIO'))
  const rampLen = (p: Plan) => p.weeks.filter(w => w.phase === 'base_build').length
  const dist: Record<number, number> = {}; for (const r of staged) dist[rampLen(r.plan)] = (dist[rampLen(r.plan)] ?? 0) + 1
  console.log(`  staged=${staged.length}  firing INV-PLAN-GET-RUNNING-BUILD-RATIO=${fire.length}`)
  console.log(`  ramp-week distribution (staged): ${JSON.stringify(dist)}  (GET_RUNNING_MAX_WEEKS=${G.GET_RUNNING_MAX_WEEKS})`)
  for (const r of fire) {
    const s = stagedRaceOf(r.plan)!
    const ramp = r.plan.weeks.filter(w => w.phase === 'base_build'); const end = ramp[ramp.length - 1].weekly_km
    console.log(`    ${r.input.race_distance_km}km cw${r.input.current_weekly_km} lr${r.input.longest_recent_run_km} ${r.input.training_age} runway→ramp ${ramp.length}w  ${bbStart(r.plan)}→${end} = ${(end! / bbStart(r.plan)).toFixed(2)}x  target_found=${s.target_found} reaches_door=${s.reaches_door} door=${s.door_km}`)
  }
  const over15 = staged.filter(r => rampLen(r.plan) > G.GET_RUNNING_MAX_WEEKS)
  console.log(`  staged ramps longer than ${G.GET_RUNNING_MAX_WEEKS} weeks: ${over15.length}`)
}

// ── 4. WALKRUN-DELOAD-CLAIM-01 ───────────────────────────────────────────────────────────────
console.log('\n── 4. walk-run deload ──')
{
  console.log(`  schedule: ${walkRunSchedule().map((w, i) => `w${i + 1}:L${w.level}${w.deload ? 'D' : ''}`).join(' ')}`)
  const wrPlans = rows.filter(r => r.plan.weeks.some(w => w.phase === 'walk_run_start'))
  let identical = 0, withDeload = 0
  for (const r of wrPlans) {
    const wr = r.plan.weeks.filter(w => w.phase === 'walk_run_start')
    const i = wr.findIndex(w => (w as any).type === 'deload')
    if (i <= 0) continue
    withDeload++
    if (JSON.stringify(wr[i].sessions) === JSON.stringify(wr[i - 1].sessions)) identical++
  }
  console.log(`  grid plans with a walk-run start: ${wrPlans.length}; with a walk-run deload: ${withDeload}; deload sessions byte-identical to the week before: ${identical}`)
  // Contrast: the running ramp's deload, same plans
  const ex = wrPlans.find(r => r.plan.weeks.some(w => w.phase === 'base_build' && (w as any).type === 'deload'))
  if (ex) {
    const bb = ex.plan.weeks.filter(w => w.phase === 'base_build')
    console.log(`  running-ramp weekly_km after a walk-run start (example): ${bb.map(w => `${w.weekly_km}${(w as any).type === 'deload' ? 'D' : ''}`).join(' ')}`)
  }
}

async function prod() {
  const { createClient } = await import('@supabase/supabase-js')
  const { readFileSync } = await import('fs')
  for (const l of readFileSync('.env.local', 'utf8').split('\n')) {
    const m = l.match(/^([A-Z0-9_]+)=(.*)$/); if (m) process.env[m[1]] ??= m[2].replace(/^["']|["']$/g, '')
  }
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
  const { data, error } = await db.from('plans').select('user_id, plan_json')
  if (error) { console.log(`\nPROD: query error ${error.message}`); return }
  const all = (data ?? []) as Array<{ user_id: string; plan_json: Plan }>
  const bb = all.filter(p => (p.plan_json?.meta as unknown as Record<string, unknown>)?.plan_kind === 'base_build')
  console.log(`\n── PRODUCTION (plans table, SELECT) ── rows ${all.length}, base_build ${bb.length}`)
  for (const p of bb) {
    const m = p.plan_json.meta as unknown as Record<string, unknown>
    const gi = m.generator_input as GeneratorInput | undefined
    const s = stagedRaceOf(p.plan_json)
    const ramp = p.plan_json.weeks.filter(w => w.phase === 'base_build')
    const start = bbStart(p.plan_json), end = ramp.length ? ramp[ramp.length - 1].weekly_km ?? 0 : 0
    const wr = p.plan_json.weeks.filter(w => w.phase === 'walk_run_start').length
    const raw = gi ? validatePlan(p.plan_json, gi).filter(v => v.code === 'INV-PLAN-BASE-BUILD-RATIO').map(v => v.actual) : ['no input']
    console.log(`  ${s ? 'staged' : '§118  '} cw${gi?.current_weekly_km} lr${gi?.longest_recent_run_km} ramp ${ramp.length}w ${start}→${end} (${start ? (end / start).toFixed(2) : '-'}x) walk-run weeks ${wr}  raw-§111 ${JSON.stringify(raw)}  blk ${JSON.stringify(codes(validateBaseBuildBlock(p.plan_json.weeks, start, { volumeCappedInjury: volumeCappedRampOf(p.plan_json) })).filter(c => c.includes('RATIO')))}`)
  }
}
if (process.argv.includes('--prod')) prod()

/** --prod-inputs: how often do real declarations take the LR-half shape (cw >= floor, longest < 2)? SELECT only. */
async function prodInputs() {
  const { createClient } = await import('@supabase/supabase-js')
  const { readFileSync } = await import('fs')
  for (const l of readFileSync('.env.local', 'utf8').split('\n')) {
    const m = l.match(/^([A-Z0-9_]+)=(.*)$/); if (m) process.env[m[1]] ??= m[2].replace(/^["']|["']$/g, '')
  }
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
  const seen = new Map<string, { cw: number; lr: number | undefined }>()
  const { data: plans } = await db.from('plans').select('user_id, plan_json')
  for (const p of (plans ?? []) as Array<{ user_id: string; plan_json: Plan }>) {
    const gi = (p.plan_json?.meta as unknown as Record<string, unknown>)?.generator_input as GeneratorInput | undefined
    if (gi) seen.set(`plan:${p.user_id}`, { cw: gi.current_weekly_km, lr: gi.longest_recent_run_km })
  }
  const { data: evs } = await db.from('ops_events').select('user_id, kind, detail').in('kind', ['plan_refused_by_design', 'plan_staged_for_race'])
  let evN = 0
  for (const e of (evs ?? []) as Array<{ user_id: string; kind: string; detail: Record<string, unknown> }>) {
    evN++
    const cw = Number(e.detail?.current_weekly_km), lr = e.detail?.longest_recent_run_km
    if (Number.isFinite(cw)) seen.set(`ev:${e.user_id}:${evN}`, { cw, lr: typeof lr === 'number' ? lr : undefined })
  }
  const rows = Array.from(seen.values())
  const withLr = rows.filter(r => typeof r.lr === 'number')
  const shape = withLr.filter(r => r.cw >= G.BASE_BUILD_ONRAMP_MIN_START_KM && (r.lr as number) < G.WALK_RUN_START_MIN_LONGEST_RUN_KM)
  console.log(`\n── PROD INPUTS ── plan rows ${plans?.length ?? 0}, refusal/staged events ${evN}; declarations with a longest run: ${withLr.length}; LR-half shape: ${shape.length} ${JSON.stringify(shape)}`)
}
if (process.argv.includes('--prod-inputs')) prodInputs()

/** --item3: STAGED-RAMP-RATIO-16W-01 reachability. (a) the ENGINE route over wide integer grids, (b) the PRODUCER
 *  called directly with doors the engine may or may not hand it — the latent count, not an impact figure. */
async function item3() {
  const { generateStagedRacePlan } = await import('@/lib/plan/stagedRacePlan')
  const quiet = console.error; console.error = () => {}
  const fireOf = (p: Plan) => validateBaseBuildBlock(p.weeks, bbStart(p), { volumeCappedInjury: volumeCappedRampOf(p) }).find(v => v.code === 'INV-PLAN-GET-RUNNING-BUILD-RATIO')
  let n = 0, fire = 0, maxRamp = 0
  for (const d of [21.0975, 42.195, 50, 80, 100]) for (const cw of [0, 1, 2, 3, 4, 5, 6, 8, 10, 12, 15, 20])
    for (const lr of [0, 1, 2, 4, 6]) for (const rw of [16, 24, 32, 40, 52, 64, 80]) for (const age of [35, 50]) {
      if (lr > cw) continue
      const input = mk({ race_distance_km: d, current_weekly_km: cw, longest_recent_run_km: lr, race_date: addWeeks(PLAN_START, rw), age })
      let o; try { o = runEngine({ input, tier: 'free', displayUnits: 'km', planStart: PLAN_START, today: '2026-11-20' }) } catch { continue }
      if (o.kind !== 'base_build' || !stagedRaceOf(o.plan)) continue
      n++; maxRamp = Math.max(maxRamp, o.plan.weeks.filter(w => w.phase === 'base_build').length)
      if (fireOf(o.plan)) fire++
    }
  console.log(`\n── 3b. ENGINE route, wide grid: staged ${n}, firing ${fire}, longest ramp ${maxRamp} weeks`)
  let pn = 0, pf = 0, pmax = 0; const ex: string[] = []
  for (const d of [21.0975, 42.195]) for (const cw of [1, 2, 3, 4, 5, 6, 7, 8, 10, 12, 15]) for (const lr of [0, 1, 2, 4])
    for (const rw of [20, 24, 28, 32, 40, 52]) for (const door of [8, 10, 13, 16, 20, 25, 30, 40]) {
      if (lr > cw) continue
      const input = mk({ race_distance_km: d, current_weekly_km: cw, longest_recent_run_km: lr, race_date: addWeeks(PLAN_START, rw) })
      let p: Plan | null; try { p = generateStagedRacePlan(input, PLAN_START, door) } catch { continue }
      if (!p) continue; pn++
      const len = p.weeks.filter(w => w.phase === 'base_build').length; pmax = Math.max(pmax, len)
      const v = fireOf(p); if (v) { pf++; if (ex.length < 4) ex.push(`${d}km cw${cw} lr${lr} rw${rw} door${door}: ramp ${len}w ${v.actual}`) }
    }
  console.error = quiet
  console.log(`── 3c. PRODUCER direct (arbitrary doors): ${pn} plans, firing ${pf}, longest ramp ${pmax} weeks\n   ${ex.join('\n   ')}`)
}
if (process.argv.includes('--item3')) item3()
