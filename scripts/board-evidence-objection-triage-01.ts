/**
 * OBJECTION-TRIAGE-01 — board evidence for the Phase 0.1 sitting (2026-11-20).
 *
 * READ-ONLY. Regenerates the five `audit:plans` cohorts exactly as
 * `scripts/audit-plan-quality.ts` builds them, scores each plan with the same owner
 * (`auditPlanQuality` + `objectionsOnly`), and breaks every objection class down by the
 * dimensions that explain it. Writes nothing, reads no stored plan.
 *
 *   npx tsx scripts/board-evidence-objection-triage-01.ts                 # breakdowns
 *   npx tsx scripts/board-evidence-objection-triage-01.ts --sample CODE N # N full week tables
 *   ... --sample CODE N --where key=value[,key=value]                     # filter the sample
 *
 * ⚠️ The beginner-marathon grid is COPIED from the audit script (it is private there and the
 * script runs on import). The totals line is printed so the copy can be checked against
 * `npm run audit:plans`: if they differ, this evidence is about a different population.
 */
import { targetedGridCore, targetedGridExtra, cohortGrid, COHORT_PLAN_START } from '../lib/plan/cohortGrid'
import { CHARITY_PERSONAS, ENGINE_PERSONAS, CHARITY_PLAN_START, charityRaceDate } from '../lib/plan/charityCohort'
import { generateRulePlan, derivedLevelsFor } from '../lib/plan/ruleEngine'
import { isDesignedRefusal } from '../lib/plan/designedRefusal'
import { sessionKmSelfPaced } from '../lib/plan/sessionDistance'
import { effectiveStartKm, week1StepBaseKm, isFreshReturn } from '../lib/plan/startVolume'
import { auditPlanQuality, objectionsOnly } from '../lib/plan/planQuality'
import { isLongRun } from '../lib/plan/sessionRole'
import type { GeneratorInput, Plan, Week, Session } from '../types/plan'

const BEGINNER_MARATHON_PLAN_START = '2026-10-05'
function beginnerMarathonGrid(): GeneratorInput[] {
  const out: GeneratorInput[] = []
  for (const cwk of [0, 5, 8, 10, 12, 15, 20, 25, 30])
    for (const longest of [0, 2, 3, 5, 8, 12])
      for (const days of [3, 4, 5])
        for (const raceWeeks of [16, 20, 24, 29])
          for (const age of [28, 42, 58])
            for (const injury of [[], ['Knee']] as string[][])
              for (const freshReturn of [undefined, 4]) {
                if (longest > cwk) continue
                const race = new Date(BEGINNER_MARATHON_PLAN_START)
                race.setDate(race.getDate() + raceWeeks * 7 - 1)
                out.push({
                  athlete_name: 'Athlete', age, race_name: 'London',
                  race_distance_km: 42.2, race_date: race.toISOString().slice(0, 10),
                  goal: 'finish', current_weekly_km: cwk, longest_recent_run_km: longest,
                  days_available: days, training_age: '<6mo',
                  recent_quality_training: 'none', hard_session_relationship: 'neutral',
                  injury_history: injury, max_hr: 184,
                  ...(freshReturn !== undefined ? { weeks_at_current_volume: freshReturn } : {}),
                } as unknown as GeneratorInput)
              }
  return out
}
const STRIDE = 7919
const stride = (xs: GeneratorInput[], n: number) =>
  Array.from({ length: Math.min(n, xs.length) }, (_, i) => xs[(i * STRIDE) % xs.length])

type Cohort = { name: string; inputs: GeneratorInput[]; planStart: string }
const cohorts: Cohort[] = [
  { name: 'BEGINNER MARATHON', inputs: beginnerMarathonGrid(), planStart: BEGINNER_MARATHON_PLAN_START },
  { name: 'cohortGrid', inputs: stride(cohortGrid(), 3000), planStart: COHORT_PLAN_START },
  { name: 'targetedGrid', inputs: [...stride(targetedGridCore(), 1500), ...targetedGridExtra()], planStart: COHORT_PLAN_START },
  { name: 'charity personas', planStart: CHARITY_PLAN_START,
    inputs: CHARITY_PERSONAS.map(p => ({ ...p.input, race_date: charityRaceDate(p.weeks, CHARITY_PLAN_START, p.raceDay ?? 'sun') } as GeneratorInput)) },
  { name: 'engine personas', planStart: CHARITY_PLAN_START,
    inputs: ENGINE_PERSONAS.map(p => ({ ...p.input, race_date: charityRaceDate(p.weeks, CHARITY_PLAN_START, p.raceDay ?? 'sun') } as GeneratorInput)) },
]

const isTraining = (w: Week) => w.n > 0 && w.type !== 'race' && w.phase !== 'foundation'
const runsIn = (w: Week) => Object.values(w.sessions ?? {}).filter(
  (s): s is Session => !!s && s.type !== 'rest' && s.type !== 'strength' && s.type !== 'cross-train')

type Row = Record<string, string | number | boolean | undefined>
const rows: { code: string; dims: Row; plan: Plan; input: GeneratorInput; cohort: string; detail: string }[] = []
const generatedBy: Record<string, number> = {}
const genDims: { cohort: string; dims: Row }[] = []

const bucket = (n: number, edges: number[]) => { for (const e of edges) if (n < e) return `<${e}`; return `>=${edges[edges.length - 1]}` }
const distLabel = (km: number) => km <= 5 ? '5K' : km <= 10 ? '10K' : km <= 21.2 ? 'HM' : km <= 43 ? 'MAR' : 'ULTRA'

function dimsFor(cohort: string, input: GeneratorInput, plan: Plan): Row {
  const m = plan.meta as unknown as Record<string, unknown>
  const weeks = plan.weeks.filter(isTraining)
  const nonDeload = weeks.filter(w => w.type !== 'deload')
  const w1 = weeks.find(w => w.n === 1)?.weekly_km ?? 0
  const peak = Math.max(0, ...nonDeload.map(w => w.weekly_km ?? 0))
  const lv = derivedLevelsFor(input)
  const peakLr = Math.max(0, ...nonDeload.flatMap(w => runsIn(w).filter(isLongRun).map(s => sessionKmSelfPaced(s) ?? 0)))
  const peakLrMins = Math.max(0, ...nonDeload.flatMap(w => runsIn(w).filter(isLongRun).map(s => s.duration_mins ?? 0)))
  return {
    cohort, dist: distLabel(input.race_distance_km), days: input.days_available, tAge: input.training_age ?? 'unset',
    declared: input.user_declared_level ?? input.fitness_level ?? '-',
    structural: lv.structural, intensity: lv.intensity,
    cwk: input.current_weekly_km, cwkB: bucket(input.current_weekly_km ?? 0, [5, 10, 15, 20, 30, 40, 55, 70]),
    longest: input.longest_recent_run_km ?? 0,
    cap: (input as unknown as { max_weekday_mins?: number }).max_weekday_mins ?? 'none',
    goal: input.goal, masters: (input.age ?? 0) >= 45,
    injury: (input.injury_history ?? []).length ? (input.injury_history ?? []).join('+') : 'none',
    fresh: isFreshReturn(input),
    weeks: weeks.length,
    profile: (m.volume_profile as string) ?? 'unset',
    compress: (m.compression_classification as string) ?? 'unset',
    timeComp: !!m.time_compressed, volConstr: !!m.volume_constrained,
    runWalk: !!m.run_walk_prescribed, finishRW: !!m.finish_goal_run_walk,
    peakTarget: (m.peak_km_target as number) ?? '-',
    note: m.volume_constraint_note ? 'yes' : 'no',
    noteKind: !m.volume_constraint_note ? 'none'
      : /already where this distance wants/.test(String(m.volume_constraint_note)) ? 'already-there'
      : /get you round/.test(String(m.volume_constraint_note)) ? 'get-round'
      : /injury/i.test(String(m.volume_constraint_note)) ? 'injury' : 'other',
    lopNote: /takes up most of the week/.test(JSON.stringify(m)) ? 'yes' : 'no',
    shownNote: m.volume_constraint_note ? (/takes up most of the week/.test(String(m.volume_constraint_note)) ? 'lopsided' : 'other') : 'none',
    capFeasible: (() => { const cap = (input as unknown as { max_weekday_mins?: number }).max_weekday_mins; const d = input.days_available ?? 0
      // can the runner's own cap carry their declared volume? weekday minutes at ~6.5 min/km plus a 2.5x-weekday long run
      if (!cap) return 'nocap'; const wk = (d - 1) * cap / 6.5 + 2.5 * cap / 6.5; return wk >= (input.current_weekly_km ?? 0) ? 'fits' : 'cwk>cap' })(),
    lrNote: /longest run reaches|new ground|long run (only )?reaches/i.test(JSON.stringify(m)) ? 'yes' : 'no',
    peakLrB: bucket(peakLr, [14, 16, 17, 19, 21, 22.5, 23.21]),
    w1VsCwk: (input.current_weekly_km ?? 0) > 0 ? bucket(w1 / (input.current_weekly_km ?? 1), [0.6, 0.8, 0.95, 1.05, 1.2]) : 'cwk0',
    effStart: Math.round(effectiveStartKm(input)), stepBase: Math.round(week1StepBaseKm(input)),
    w1: Math.round(w1), peak: Math.round(peak),
    peakVsCwk: (input.current_weekly_km ?? 0) > 0 ? bucket(peak / (input.current_weekly_km ?? 1), [0.8, 0.95, 1.05, 1.2, 1.5]) : 'cwk0',
    peakVsTarget: typeof m.peak_km_target === 'number' && m.peak_km_target > 0 ? bucket(peak / (m.peak_km_target as number), [0.6, 0.8, 0.95, 1.05]) : 'none',
    peakLr: Math.round(peakLr * 10) / 10, peakLrMins,
  }
}

for (const c of cohorts) {
  let built = 0
  for (const input of c.inputs) {
    let plan: Plan
    try { plan = generateRulePlan(input, 'paid', c.planStart) }
    catch (e) { if (!isDesignedRefusal(e)) console.log('CRASH', (e as Error).message.slice(0, 80)); continue }
    built++
    const dims = dimsFor(c.name, input, plan)
    genDims.push({ cohort: c.name, dims })
    for (const fi of objectionsOnly(auditPlanQuality(plan, input))) {
      const extra: Row = {}
      if (fi.code.startsWith('BINGE')) {
        // Which week, which session.
        let worst = 0; let at: Row = {}
        for (const w of plan.weeks.filter(isTraining)) {
          if (w.type === 'deload' || !w.weekly_km) continue
          const rs = runsIn(w)
          for (const s of rs) {
            const sh = (sessionKmSelfPaced(s) ?? 0) / w.weekly_km
            if (sh > worst) { worst = sh; at = { bWeek: w.n, bPhase: w.phase ?? '-', bType: w.type ?? 'normal',
              bRuns: rs.length, bSess: isLongRun(s) ? 'long' : s.type, bWeekKm: Math.round(w.weekly_km) } }
          }
        }
        Object.assign(extra, at)
      }
      // ── The split the sitting rules on, derived mechanically per class ──
      const d = dims as Row
      const cwk = input.current_weekly_km ?? 0
      if (fi.code === 'NEVER-BUILDS' || fi.code === 'FLAT-CURVE') {
        const holds = cwk > 0 && (d.peak as number) >= 0.95 * cwk
        const licensed = d.injury !== 'none' || input.training_age === '<6mo' || (input.days_available ?? 0) <= 3 || d.cap !== 'none'
        extra.split = holds ? 'HOLDS' : licensed ? 'CUT-LICENSED' : 'CUT-UNLICENSED'
        const rank = { beginner: 0, intermediate: 1, experienced: 2 } as Record<string, number>
        const tgt = typeof d.peakTarget === 'number' ? d.peakTarget : 0
        extra.mech = holds ? 'holds' : tgt < 0.95 * cwk
          ? (rank[String(d.declared)] > rank[String(d.structural)] ? 'target<cwk:declared-above-assessed' : 'target<cwk:other')
          : 'placed<target'
        extra.claimsCeiling = /already where this distance wants/.test(String((plan.meta as unknown as Record<string, unknown>).volume_constraint_note ?? '')) ? 'yes' : 'no'
      }
      if (fi.code.startsWith('BINGE')) extra.split = d.lopNote === 'yes' ? 'DECLARED' : 'UNDECLARED'
      if (fi.code === 'LONG-RUN-SHORT') {
        const bar = input.race_distance_km * 0.55
        const lr = d.peakLr as number
        extra.split = lr >= bar - 0.5 ? 'ROUNDING' : d.runWalk ? 'RUNWALK-BELOW-17' : lr >= 17 ? 'RUN-17-PLUS' : 'RUN-BELOW-17'
      }
      if (fi.code === 'WEEK1-LEAP') {
        const w1 = plan.weeks.find(w => w.n === 1)
        const rs = w1 ? runsIn(w1) : []
        const longest = input.longest_recent_run_km ?? 0
        const nonLongAtFloor = rs.filter(x => !isLongRun(x)).every(x => (sessionKmSelfPaced(x) ?? 0) <= 4.05)
        const maxOver = Math.max(0, ...rs.map(x => (sessionKmSelfPaced(x) ?? 0) - longest))
        extra.split = nonLongAtFloor && maxOver <= 0.5 ? 'FLOOR-COMPOSED' : nonLongAtFloor ? 'FLOOR-BUT-LR-OVER' : 'HEADROOM'
        extra.w1Runs = rs.length
        extra.maxOver = Math.round(maxOver * 10) / 10
      }
      if (fi.code === 'WEEK1-LEAP') extra.arm = fi.detail.startsWith("week 1's longest") ? 'session' : fi.detail.includes('adds') ? 'absolute' : 'ratio'
      rows.push({ code: fi.code, dims: { ...dims, ...extra }, plan, input, cohort: c.name, detail: fi.detail })
    }
  }
  generatedBy[c.name] = built
}

// ── Output ──────────────────────────────────────────────────────────────────
const args = process.argv.slice(2)
const si = args.indexOf('--sample')
const ci = args.indexOf('--cross')
if (args.includes('--declared')) {
  // §106 x §79: does declaring ABOVE the assessed structural level ever LOWER the peak, against the same
  // runner declaring the assessed level? Over the cohortGrid sample, every plan, not only flagged ones.
  const rank: Record<string, number> = { beginner: 0, intermediate: 1, experienced: 2 }
  const peakOf = (p: Plan) => Math.max(0, ...p.weeks.filter(isTraining).filter(w => w.type !== 'deload').map(w => w.weekly_km ?? 0))
  let n = 0, lower = 0, belowCwk = 0, twinHolds = 0
  for (const i of cohorts[1].inputs) {
    const lv = derivedLevelsFor(i)
    if (!(rank[String(i.user_declared_level)] > rank[lv.structural])) continue
    let a: Plan, b: Plan
    try { a = generateRulePlan(i, 'paid', COHORT_PLAN_START); b = generateRulePlan({ ...i, user_declared_level: lv.structural } as GeneratorInput, 'paid', COHORT_PLAN_START) } catch { continue }
    n++
    const pa = peakOf(a), pb = peakOf(b), cw = i.current_weekly_km ?? 0
    if (pa < pb - 1) lower++
    if (pa < 0.95 * cw) { belowCwk++; if (pb >= 0.95 * cw) twinHolds++ }
  }
  console.log(`declared-above-assessed plans: ${n}`)
  console.log(`  peak LOWER than the same runner declaring the assessed level (by >1 km): ${lower}`)
  console.log(`  peak below 95% of current volume: ${belowCwk}; of those, the assessed-level twin holds current volume: ${twinHolds}`)
} else if (args.includes('--cf')) {
  // Counterfactual for every NEVER-BUILDS plan that CUTS the runner's volume: remove the runner's own
  // constraints one at a time and see whether the plan then holds their volume. Names the binder.
  const cutters = rows.filter(r => r.code === 'NEVER-BUILDS' && r.dims.split !== 'HOLDS')
  const t: Record<string, number> = {}
  const holdsWith = (inp: GeneratorInput, start: string): boolean | 'refused' => {
    try {
      const p = generateRulePlan(inp, 'paid', start)
      const pk = Math.max(0, ...p.weeks.filter(isTraining).filter(w => w.type !== 'deload').map(w => w.weekly_km ?? 0))
      return pk >= 0.95 * (inp.current_weekly_km ?? 0)
    } catch { return 'refused' }
  }
  for (const r of cutters) {
    const start = r.cohort === 'cohortGrid' || r.cohort === 'targetedGrid' ? COHORT_PLAN_START : CHARITY_PLAN_START
    const noCap = { ...r.input, max_weekday_mins: undefined } as GeneratorInput
    const fiveDays = { ...noCap, days_available: 5, days_cannot_train: ['tuesday', 'thursday'].slice(0, 0) } as GeneratorInput
    const healthy = { ...fiveDays, injury_history: [], weeks_at_current_volume: undefined } as GeneratorInput
    const a = holdsWith(noCap, start), b = holdsWith(fiveDays, start), c = holdsWith(healthy, start)
    const binder = a === true ? 'weekday-cap' : b === true ? 'days(+cap)' : c === true ? 'injury/fresh' : 'engine (none of the runner\'s constraints)'
    const detailKeys = (process.argv[process.argv.indexOf('--cf') + 1] ?? '').startsWith('--') ? [] : (process.argv[process.argv.indexOf('--cf') + 1] ?? '').split(',').filter(Boolean)
    const k = `${String(r.dims.split).padEnd(15)} ${r.dims.dist} claimsCeiling=${r.dims.claimsCeiling} binder=${binder}` + detailKeys.map(x => ` ${x}=${r.dims[x]}`).join('')
    t[k] = (t[k] ?? 0) + 1
  }
  for (const k of Object.keys(t).sort()) console.log(`${String(t[k]).padStart(5)}  ${k}`)
} else if (args.includes('--splits')) {
  const t: Record<string, number> = {}
  for (const r of rows) { const k = `${r.code.padEnd(16)} ${r.cohort.padEnd(18)} ${String(r.dims.split ?? '-')}`; t[k] = (t[k] ?? 0) + 1 }
  for (const k of Object.keys(t).sort()) console.log(`${String(t[k]).padStart(5)}  ${k}`)
  console.log(`TOTAL ${rows.length}`)
} else if (ci >= 0) {
  // --cross CODE cohort k1,k2,... : flagged/generated per combination, largest first
  const [code, ch, keyList] = [args[ci + 1], args[ci + 2], args[ci + 3]]
  const keys = keyList.split(',')
  const key = (d: Row) => keys.map(k => `${k}=${d[k]}`).join(' ')
  const flagged: Record<string, number> = {}, gen: Record<string, number> = {}
  for (const r of rows) if (r.code === code && r.cohort === ch) flagged[key(r.dims)] = (flagged[key(r.dims)] ?? 0) + 1
  for (const g of genDims) if (g.cohort === ch) gen[key(g.dims)] = (gen[key(g.dims)] ?? 0) + 1
  for (const [k, n] of Object.entries(flagged).sort((a, b) => b[1] - a[1])) console.log(`${String(n).padStart(5)}/${String(gen[k]).padEnd(5)} ${k}`)
} else if (si < 0) {
  const tally: Record<string, number> = {}
  for (const r of rows) tally[`${r.cohort} / ${r.code}`] = (tally[`${r.cohort} / ${r.code}`] ?? 0) + 1
  console.log('generated:', JSON.stringify(generatedBy))
  console.log('totals (check against audit:plans):'); for (const [k, v] of Object.entries(tally)) console.log(`  ${k.padEnd(40)} ${v}`)
  console.log(`  TOTAL ${rows.length}`)

  const BREAK: Record<string, string[]> = {
    'NEVER-BUILDS': ['dist', 'cwkB', 'structural', 'declared', 'days', 'cap', 'goal', 'injury', 'fresh', 'weeks', 'profile', 'note', 'peakVsCwk', 'timeComp', 'compress'],
    'LONG-RUN-SHORT': ['cohort', 'cwkB', 'longest', 'days', 'injury', 'fresh', 'masters', 'weeks', 'goal', 'structural', 'runWalk', 'finishRW', 'profile', 'peakLrMins', 'cap'],
    'BINGE-WEEK': ['cohort', 'dist', 'days', 'cap', 'cwkB', 'structural', 'injury', 'fresh', 'goal', 'bSess', 'bPhase', 'bType', 'bRuns', 'profile'],
    'BINGE-SEVERE-75': ['dist', 'days', 'cap', 'cwkB', 'structural', 'bSess', 'bPhase', 'bRuns', 'injury', 'fresh'],
    'WEEK1-LEAP': ['arm', 'cwkB', 'longest', 'days', 'injury', 'fresh', 'masters', 'weeks', 'runWalk'],
    'FLAT-CURVE': ['dist', 'cwk', 'structural', 'days', 'cap', 'goal', 'profile', 'weeks'],
  }
  for (const [code, keys] of Object.entries(BREAK)) {
    const sel = rows.filter(r => r.code === code)
    console.log(`\n══════ ${code}: ${sel.length} ══════`)
    const cohortsHere = Array.from(new Set(sel.map(r => r.cohort)))
    for (const ch of cohortsHere) {
      const sub = sel.filter(r => r.cohort === ch)
      const base = genDims.filter(g => g.cohort === ch)
      console.log(`\n  ── ${ch}: ${sub.length} of ${base.length} generated`)
      for (const k of keys) {
        const vals = Array.from(new Set(base.map(g => String(g.dims[k])).concat(sub.map(r => String(r.dims[k])))))
        const cells = vals.sort().map(v => {
          const n = sub.filter(r => String(r.dims[k]) === v).length
          const d = base.filter(g => String(g.dims[k]) === v).length
          return n ? `${v}:${n}/${d}(${d ? Math.round(n / d * 100) : '-'}%)` : ''
        }).filter(Boolean)
        console.log(`    ${k.padEnd(11)} ${cells.join('  ')}`)
      }
    }
  }
} else {
  const code = args[si + 1]; const n = Number(args[si + 2] ?? 3)
  const wi = args.indexOf('--where')
  const filt = wi >= 0 ? args[wi + 1].split(',').map(kv => kv.split('=')) : []
  const sel = rows.filter(r => r.code === code && filt.every(([k, v]) => String(r.dims[k]) === v))
  console.log(`${sel.length} match; showing ${Math.min(n, sel.length)} (evenly spaced)`)
  for (let i = 0; i < Math.min(n, sel.length); i++) {
    const r = sel[Math.floor(i * sel.length / Math.min(n, sel.length))]
    console.log(`\n── ${r.cohort} | ${r.detail}`)
    console.log('   ' + Object.entries(r.dims).map(([k, v]) => `${k}=${v}`).join(' '))
    const m = r.plan.meta as unknown as Record<string, unknown>
    if (m.volume_constraint_note) console.log(`   note: ${String(m.volume_constraint_note).slice(0, 220)}`)
    for (const w of r.plan.weeks) {
      const sess = Object.entries(w.sessions ?? {}).filter(([, s]) => s && s.type !== 'rest')
        .map(([d, s]) => `${d.slice(0, 3)}:${isLongRun(s as Session) ? 'L' : (s as Session).type.slice(0, 4)}${(sessionKmSelfPaced(s as Session) ?? 0).toFixed(1)}${(s as Session).duration_mins ? `/${(s as Session).duration_mins}m` : ''}`)
      console.log(`   w${String(w.n).padStart(2)} ${(w.phase ?? '').padEnd(10)} ${(w.type ?? '').padEnd(7)} ${String(Math.round((w.weekly_km ?? 0) * 10) / 10).padStart(5)}km  ${sess.join(' ')}`)
    }
  }
}
