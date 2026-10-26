// GRID-SLOW-GOALGAP-01 — `npm run measure:goal-gap`. The instrument for the 26 Oct RCA's items 1–3, on the runners
// they hit (`lib/plan/slowGoalGrid.ts`). It answers three questions no other check asks:
//
//   1. GOAL PACE — how often is goal-anchored work priced faster than the runner's own T, CV and I pace, by distance
//      and by how far the goal outruns current fitness? (No invariant asks whether a prescribed pace is runnable.)
//   2. §9 FLOOR — how many quality sessions fall under the 5 km floor (`INV-PLAN-MIN-SESSION-SIZE`)?
//   3. OVERRUN — how many weekday sessions are over their day's budget with no `weekday_overrun_note`, and by how much?
//
// Goal-paced work is what was PRESCRIBED, not a list of rows: a session stamped `stimulus: 'race_pace'` (§22 reprices
// tempo and threshold rows at goal pace in a goal-pace week, `ruleEngine.ts` `useGoalPace`), or one whose row's work
// steps are anchored 'goal' (derived from the catalogue, so a sixth row is counted the day it ships). Plans come from
// `runEngine`, the production entry, so a staged or on-ramp plan is measured as the runner receives it. Paces come from the producer's own `buildPaceFromVDOT` at the benchmark's VDOT.
// ⚠️ The engine discounts VDOT for some bands, so its own T can be slightly slower than this; the comparison is
// therefore conservative (it under-counts "faster than T").
//
// Read-only and deterministic. `--json` prints the table for a later baseline.

import { runEngine } from '../lib/plan/engine'
import { validatePlan } from '../lib/plan/invariants'
import { V1_SESSION_CATALOGUE, requiredPaceAnchors } from '../lib/plan/sessionCatalogueData'
import { benchmarkVdot } from '../lib/plan/benchmarkCheck'
import { buildPaceFromVDOT } from '../lib/plan/paceBands'
import { slowGoalGrid, slowGoalDates } from '../lib/plan/slowGoalGrid'
import type { GeneratorInput } from '../types/plan'

const { planStart: PLAN_START, benchmarkDate: BENCHMARK_DATE } = slowGoalDates()
const GOAL_ROWS = new Set(V1_SESSION_CATALOGUE.filter(r => requiredPaceAnchors(r).includes('goal')).map(r => r.id))
const WEEKDAYS = ['mon', 'tue', 'wed', 'thu', 'fri'] as const
/** The CENTRE of a pace band ("7:21–7:39 /km" → 7.5). The fast end over-counts: for a slow runner HM pace sits
 *  within seconds of T, and the band's fast edge crossed T on every half at a goal equal to current fitness. */
const centre = (s?: string | null) => {
  const m = Array.from((s ?? '').matchAll(/(\d+):(\d{2})/g)).map(x => +x[1] + +x[2] / 60)
  return m.length ? m.reduce((a, b) => a + b, 0) / m.length : null
}
/** Faster than a reference pace by more than rounding: the engine's own bound uses 0.5% (§120 Am.1); 1% here. */
const TOL = 0.01
const faster = (p: number, ref: number) => p < ref * (1 - TOL)

type Cell = { plans: number; refused: number; withGoalWork: number; goalSessions: number; fasterT: number; fasterCV: number; fasterI: number }
const cells = new Map<string, Cell>()
let floorViolations = 0, floorPlans = 0, overrunSilent = 0, overrunSilentFloor = 0, overrunMax = 0, overrunPlans = 0, plans = 0

const GRID = slowGoalGrid(PLAN_START, BENCHMARK_DATE)
for (const c of GRID) {
  const { gap, ...input } = c
  const key = `${c.race_distance_km} km · goal +${Math.round(gap * 100)}%`
  const cell = cells.get(key) ?? { plans: 0, refused: 0, withGoalWork: 0, goalSessions: 0, fasterT: 0, fasterCV: 0, fasterI: 0 }
  cells.set(key, cell)
  const out = runEngine({ input: input as unknown as GeneratorInput, tier: 'paid', displayUnits: 'km', planStart: PLAN_START })
  if (out.kind === 'refusal') { cell.refused++; continue }
  const plan: any = out.plan
  plans++; cell.plans++
  const v = benchmarkVdot(c.benchmark)!
  const g = buildPaceFromVDOT(v, v)

  // 1. goal-anchored work vs the runner's own paces (band centre, 1% tolerance)
  const goalSessions = plan.weeks.flatMap((w: any) => Object.values(w.sessions ?? {}))
    .filter((s: any) => s && (s.stimulus === 'race_pace' || GOAL_ROWS.has(s.catalogue_id)))
  if (goalSessions.length) cell.withGoalWork++
  for (const s of goalSessions) {
    const p = centre((s as any).pace_target); if (p == null) continue
    cell.goalSessions++
    if (faster(p, g.minPerKmQuality)) cell.fasterT++
    if (faster(p, g.minPerKmCV)) cell.fasterCV++
    if (faster(p, g.minPerKmInterval)) cell.fasterI++
  }

  // 2. §9 floor
  const fv = validatePlan(plan, input as unknown as GeneratorInput).filter(x => x.code === 'INV-PLAN-MIN-SESSION-SIZE').length
  floorViolations += fv; if (fv) floorPlans++

  // 3. weekday overrun with no note
  let planOverrun = false
  for (const w of plan.weeks) for (const d of WEEKDAYS) {
    const s = w.sessions?.[d]; const cap = (input as any).day_budgets?.[d] ?? (input as any).max_weekday_mins
    // A distance-anchored session has no `duration_mins`; price it at the runner's easy pace (an under-estimate for
    // quality work, so this side under-counts, never over-counts).
    const m = s ? (s.duration_mins ?? (s.distance_km != null ? s.distance_km * g.minPerKmEasy : null)) : null
    if (!s || cap == null || m == null || m <= cap || w.badge === 'race' || s.weekday_overrun_note) continue
    overrunSilent++; if (s.floor_protected) overrunSilentFloor++
    overrunMax = Math.max(overrunMax, Math.round(m - cap)); planOverrun = true
  }
  if (planOverrun) overrunPlans++
}

const pct = (n: number, d: number) => (d ? `${Math.round((100 * n) / d)}%` : '–')
const rows = Array.from(cells.entries()).map(([k, c]) => ({
  cell: k, plans: c.plans, refused: c.refused, plans_with_goal_work: c.withGoalWork, goal_sessions: c.goalSessions,
  faster_than_T: pct(c.fasterT, c.goalSessions), faster_than_CV: pct(c.fasterCV, c.goalSessions), faster_than_I: pct(c.fasterI, c.goalSessions),
}))
if (process.argv.includes('--json')) { console.log(JSON.stringify({ rows, floorViolations, floorPlans, overrunSilent, overrunSilentFloor, overrunMax, overrunPlans, plans }, null, 2)); process.exit(0) }

console.log(`GOAL-GAP measurement — ${plans} plans from ${GRID.length} slow-runner inputs (goal rows: ${Array.from(GOAL_ROWS).join(', ')})\n`)
console.log('1. Goal-anchored work priced faster than the runner can run (share of goal-paced sessions)')
console.table(rows)
console.log(`2. §9 floor: ${floorViolations} INV-PLAN-MIN-SESSION-SIZE violations on ${floorPlans} of ${plans} plans`)
console.log(`3. Weekday overrun with no note: ${overrunSilent} sessions (${overrunSilentFloor} floor-protected) on ${overrunPlans} of ${plans} plans, worst +${overrunMax} min`)
console.log('\nNOT measured: unbenchmarked runners, the free tier, and anything a device would show.')
