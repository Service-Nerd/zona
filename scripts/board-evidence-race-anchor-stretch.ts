// Board evidence — the ONE number blocking HM-ANCHOR-VS-GOAL-01 / §120.
//
// The Coaching Board ruled 2026-09-21: CORRECT WITH AMENDMENT on the anchor
// (on a time-target plan `HM` resolves to GOAL pace, as `T` already does and as
// the sibling `mp_blocks` row already is), INSUFFICIENT EVIDENCE on the
// amendment's BOUND. Willy's amendment is chair-adopted: above some divergence
// between the runner's goal pace and the pace they currently hold, the row is
// not offered at all, because three peak-phase sessions moved onto a goal pace
// far beyond current fitness is a LOAD change, not a relabelling.
//
// ⚠️ THE BOARD'S OWN INSTRUCTION: "the number must be MEASURED, not chosen."
// A 15% bound was said to cost 27% of these sessions their row and 20% to cost
// 19%, and losing the row presses on §22's own 50% race-specific floor. The
// bound trades one ratified principle against another.
//
// ⚠️ WHY THE TWO OBVIOUS GATES WERE REJECTED, so neither is re-proposed here:
//   - `goalBeyondMeasuredFitness` tests goal pace against INTERVAL pace, so it
//     only catches an impossible goal, never a 20-30% reach.
//   - `difficulty_band` tracks the reach closely but is forbidden by §44 point 3
//     (Willy's own constraint): the band reads pre-generation feasibility only,
//     never plan-quality signals.
//
//   npx tsx scripts/board-evidence-race-anchor-stretch.ts
//
// REPORTS ONLY. Asserts nothing, never gates.
//
// ⚠️ EVERY NUMBER IS READ OFF A GENERATED PLAN, never recomputed here. The
// runner's CURRENT HM pace is read from the `hm_pace_intervals` session's own
// `derived_set` work step (which is where the `HM` anchor resolves today), and
// T pace from the same session's HEADER — which is the defect itself: the
// header shows the threshold band over reps anchored elsewhere. Reconstructing
// either from a copy of the pace maths is how this repo has produced four wrong
// measurements; read the producer's artefact.
import { generateRulePlan, buildPaceFromVDOT } from '../lib/plan/ruleEngine'
import { V1_SESSION_CATALOGUE } from '../lib/plan/sessionCatalogueData'
import { isVo2maxSession } from '../lib/plan/sessionRole'
import type { GeneratorInput, Plan, Session } from '../types/plan'

// PINNED, never `today` — SWEEP-VACUOUS-01: a grid of fixed race dates silently
// stops generating once real time passes them.
const TODAY = '2026-09-22'

function raceDate(weeksOut: number): string {
  const d = new Date(`${TODAY}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + weeksOut * 7)
  return d.toISOString().slice(0, 10)
}

/** "5:07–5:19 /km" or "5:13 /km" -> minutes per km, midpoint. */
function paceMid(s: string | null | undefined): number | null {
  if (!s) return null
  const parts = Array.from(s.matchAll(/(\d+):(\d{2})/g))
    .map(m => Number(m[1]) + Number(m[2]) / 60)
  if (parts.length === 0) return null
  return parts.reduce((a, b) => a + b, 0) / parts.length
}

function hhmmss(totalSecs: number): string {
  const h = Math.floor(totalSecs / 3600)
  const m = Math.floor((totalSecs % 3600) / 60)
  const s = Math.round(totalSecs % 60)
  return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

// ─── The grid ────────────────────────────────────────────────────────────────
// The STRETCH axis is the point: the same runner, same benchmark, chasing a
// range of targets from conservative to unreasonable. Everything else varies
// around it so a finding cannot be an artefact of one archetype.
//
// `hm_pace_intervals` is `fitness_level_min: 'intermediate'` and
// `distance_eligibility: ['HM']`, `phase_eligibility: ['peak']` — so the grid is
// HM time-target only. A beginner cannot draw the row (§24b gives them no HM
// pace and the anchor gate excludes it), which is itself worth confirming
// rather than assuming, so beginners stay IN the grid and are counted.
const BENCHMARKS = [
  // 10 km benchmark times, spanning the intermediate-to-experienced range.
  { time: '0:52:00', distance_km: 10 },
  { time: '0:47:00', distance_km: 10 },
  { time: '0:42:00', distance_km: 10 },
  { time: '0:38:00', distance_km: 10 },
]
// HM target times, seconds. 1:25 to 2:20 is the range the decision doc names.
const TARGET_SECS = [
  85 * 60, 90 * 60, 95 * 60, 100 * 60, 105 * 60,
  110 * 60, 115 * 60, 120 * 60, 130 * 60, 140 * 60,
]
const WEEKS_OUT = [12, 16, 20]
const DAYS = [3, 4, 5]
const VOLUME = [30, 45, 60]
const TRAINING_AGE = ['1-2yr', '2-5yr', '5yr+'] as const
const AGES = [30, 45]

type Row = {
  input: GeneratorInput
  weekN: number
  goalMid: number        // goal pace, min/km
  hmMid: number          // CURRENT HM pace as the engine resolved the anchor
  headerMid: number|null // what the card SHOWS today (the defect)
  stretchPct: number     // (hm - goal) / hm * 100 — positive = goal is faster
  tMid: number|null      // THRESHOLD pace, from the producer's own PaceGuide
  cvMid: number|null     // critical velocity
  iMid: number|null      // interval / VO2max pace
  goalVsT: number|null   // (T - goal) / T * 100 — positive = goal faster than threshold
}

function workPaceOf(s: Session): string | null {
  const blocks = s.derived_set?.blocks ?? []
  for (const b of blocks) {
    for (const st of b.steps) {
      if (st.role === 'work' && st.pace) return st.pace
    }
  }
  return null
}

const rows: Row[] = []
let plansGenerated = 0
let plansRefused = 0
let plansWithRow = 0
let noVdot = 0
const s22: Array<{denom: number; hmRows: number}> = []
const refusalReasons = new Map<string, number>()

for (const bench of BENCHMARKS)
for (const targetSecs of TARGET_SECS)
for (const weeksOut of WEEKS_OUT)
for (const days of DAYS)
for (const volume of VOLUME)
for (const trainingAge of TRAINING_AGE)
for (const age of AGES) {
  const input: GeneratorInput = {
    race_date: raceDate(weeksOut),
    race_distance_km: 21.0975,
    goal: 'time_target',
    target_time: hhmmss(targetSecs),
    current_weekly_km: volume,
    longest_recent_run_km: Math.max(8, Math.round(volume * 0.35)),
    days_available: days,
    age,
    benchmark: { type: 'race', time: bench.time, distance_km: bench.distance_km },
    training_age: trainingAge,
    max_hr_source: 'observed',
  } as GeneratorInput

  let plan: Plan
  try {
    plan = generateRulePlan(input, 'paid')
    plansGenerated++
  } catch (e) {
    plansRefused++
    const msg = (e as Error).message.slice(0, 60)
    refusalReasons.set(msg, (refusalReasons.get(msg) ?? 0) + 1)
    continue
  }

  const goalMid = paceMid(plan.meta.goal_pace_per_km)
  if (goalMid == null) continue

  // ⚠️ THRESHOLD PACE COMES FROM THE PRODUCER, NOT FROM THE CARD HEADER.
  // The first cut of this script read T off `session.pace_target`, on the
  // reasoning that the header falls through to `pace.qualityPaceStr`. It
  // reported 0 of 12,960 sessions crossing threshold, which looked like a
  // finding and was an instrument fault: on a GOAL-PACE WEEK the header is
  // substituted to goal pace (mechanism 2 of the defect), so that comparison
  // was goal against goal and could only ever return zero. Traced on one real
  // plan — header 3:57-4:07 over reps at 4:03-4:18 with a 4:02 goal — which is
  // the only reason it was caught.
  const vdot = plan.meta.vdot, anchor = plan.meta.vdot_training_anchor
  if (vdot == null || anchor == null) { noVdot++; continue }
  const pg = buildPaceFromVDOT(anchor, vdot)
  const tMid = pg.minPerKmQuality, cvMid = pg.minPerKmCV, iMid = pg.minPerKmInterval

  // §22's own window: second-half build/peak, non-deload, non-VO2max quality.
  // Computed with the SAME predicates the invariant uses, not a re-reading of
  // its description -- a checker that paraphrases the rule is the class this
  // repo keeps recording.
  const totalWeeks = plan.weeks.length
  const halfWeek = Math.ceil(totalWeeks / 2)
  let denom = 0, hmRows = 0
  for (const w of plan.weeks) {
    if (w.n < halfWeek) continue
    if (w.phase !== 'build' && w.phase !== 'peak') continue
    if (w.type === 'deload') continue
    for (const sn of Object.values(w.sessions)) {
      if (!sn || sn.type !== 'quality') continue
      if (isVo2maxSession(sn, V1_SESSION_CATALOGUE)) continue
      denom++
      if (sn.catalogue_id === 'hm_pace_intervals') hmRows++
    }
  }
  if (denom > 0) s22.push({ denom, hmRows })

  let found = false
  for (const w of plan.weeks) {
    for (const s of Object.values(w.sessions)) {
      if (!s || s.catalogue_id !== 'hm_pace_intervals') continue
      const workPace = workPaceOf(s)
      const hmMid = paceMid(workPace)
      if (hmMid == null) continue
      found = true
      const headerMid = paceMid(s.pace_target)
      rows.push({
        input, weekN: w.n, goalMid, hmMid,
        headerMid, tMid, cvMid, iMid,
        stretchPct: ((hmMid - goalMid) / hmMid) * 100,
        goalVsT: ((tMid - goalMid) / tMid) * 100,
      })
    }
  }
  if (found) plansWithRow++
}

// ─── Report ──────────────────────────────────────────────────────────────────
const pct = (n: number, d: number) => d === 0 ? '  n/a' : `${(100 * n / d).toFixed(1)}%`

console.log('\n══ HM-ANCHOR-VS-GOAL-01 / §120 — the bound, measured ══\n')
console.log(`Grid                    ${plansGenerated + plansRefused} inputs`)
console.log(`  generated             ${plansGenerated}`)
console.log(`  refused by design     ${plansRefused}`)
console.log(`  carrying the row      ${plansWithRow}  (${pct(plansWithRow, plansGenerated)} of generated)`)
console.log(`hm_pace_intervals sessions measured: ${rows.length}\n`)

if (refusalReasons.size > 0) {
  console.log('Refusals (design, not failures):')
  for (const [m, c] of Array.from(refusalReasons).sort((a, b) => b[1] - a[1]).slice(0, 5)) {
    console.log(`  ${String(c).padStart(5)}  ${m}`)
  }
  console.log()
}

if (rows.length === 0) {
  console.log('🔴 NO SESSIONS MEASURED. The grid cannot reach the row — fix the grid before reading anything into a zero (SWEEP-VACUOUS-01).')
  process.exit(0)
}

// 1. The defect, restated as a number on THIS grid.
const headerDisagrees = rows.filter(r =>
  r.headerMid != null && Math.abs(r.headerMid - r.hmMid) / r.hmMid > 0.01)
console.log('── 1. The header defect on this grid ──')
console.log(`  sessions whose HEADER disagrees with their own reps: ${headerDisagrees.length} / ${rows.length}  (${pct(headerDisagrees.length, rows.length)})`)
if (headerDisagrees.length > 0) {
  const worst = headerDisagrees.reduce((a, b) =>
    Math.abs(b.headerMid! - b.hmMid) > Math.abs(a.headerMid! - a.hmMid) ? b : a)
  console.log(`  worst gap: header ${worst.headerMid!.toFixed(2)} vs reps ${worst.hmMid.toFixed(2)} min/km = ${Math.round(Math.abs(worst.headerMid! - worst.hmMid) * 60)} s/km\n`)
}

// 2. The stretch distribution — what the bound would be cutting.
const sorted = [...rows].sort((a, b) => a.stretchPct - b.stretchPct)
const q = (p: number) => sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))].stretchPct
console.log('── 2. Stretch distribution: (current HM pace − goal pace) / current HM pace ──')
console.log(`  min ${q(0).toFixed(1)}%   p10 ${q(0.10).toFixed(1)}%   p25 ${q(0.25).toFixed(1)}%   median ${q(0.50).toFixed(1)}%   p75 ${q(0.75).toFixed(1)}%   p90 ${q(0.90).toFixed(1)}%   max ${q(0.999).toFixed(1)}%`)
const negative = rows.filter(r => r.stretchPct <= 0).length
console.log(`  goal SLOWER than current HM pace (no stretch at all): ${negative} / ${rows.length}  (${pct(negative, rows.length)})`)
console.log(`    ⚠️ §120 makes these sessions EASIER, not harder. Willy's bound does not apply to them.\n`)

// 3. The physiological marker: does the goal pace cross THRESHOLD?
const withT = rows.filter(r => r.goalVsT != null)
console.log(`  (plans skipped for a missing VDOT: ${noVdot})`)
const goalFasterThanT = withT.filter(r => r.goalVsT! > 0)
console.log('── 3. The marker that is physiology rather than an arbitrary percentage ──')
console.log('  An "HM-pace" rep prescribed FASTER than the runner\'s threshold pace is no longer')
console.log('  race-specific rehearsal — it is threshold-or-harder work, at a volume authored for')
console.log('  race pace, three times in peak phase.')
console.log(`  goal pace faster than T: ${goalFasterThanT.length} / ${withT.length}  (${pct(goalFasterThanT.length, withT.length)})`)
if (goalFasterThanT.length > 0) {
  const s2 = [...goalFasterThanT].sort((a, b) => a.stretchPct - b.stretchPct)
  console.log(`  their stretch range: ${s2[0].stretchPct.toFixed(1)}% .. ${s2[s2.length - 1].stretchPct.toFixed(1)}%`)
  console.log(`  LOWEST stretch that still crosses threshold: ${s2[0].stretchPct.toFixed(1)}%`)
}
const s3 = [...withT].filter(r => r.goalVsT! <= 0).sort((a, b) => b.stretchPct - a.stretchPct)
if (s3.length > 0) {
  console.log(`  HIGHEST stretch that does NOT cross threshold: ${s3[0].stretchPct.toFixed(1)}%`)
}
console.log()

// 4. The cost curve — what each candidate bound excludes.
console.log('── 4. Cost of each candidate bound ──')
console.log('  bound   sessions excluded      plans losing every HM row')
const planKey = (r: Row) => JSON.stringify(r.input)
const allPlans = new Set(rows.map(planKey))
for (const bound of [5, 7.5, 10, 12.5, 15, 17.5, 20, 25, 30]) {
  const excluded = rows.filter(r => r.stretchPct > bound)
  const survivingPlans = new Set(rows.filter(r => r.stretchPct <= bound).map(planKey))
  const lostPlans = Array.from(allPlans).filter(p => !survivingPlans.has(p)).length
  const crossers = goalFasterThanT.filter(r => r.stretchPct > bound).length
  console.log(
    `  ${String(bound).padStart(5)}%  ${String(excluded.length).padStart(5)} (${pct(excluded.length, rows.length).padStart(6)})` +
    `      ${String(lostPlans).padStart(4)} (${pct(lostPlans, allPlans.size).padStart(6)})` +
    `   catches ${pct(crossers, Math.max(goalFasterThanT.length, 1))} of threshold-crossers`
  )
}

// 5. THE BOUND MEASURED AGAINST THRESHOLD, which is what §3 says it should be.
console.log('── 5. The same bound, expressed against THRESHOLD instead of against a percentage ──')
const sortedT = [...withT].sort((a, b) => (a.goalVsT!) - (b.goalVsT!))
const qt = (p: number) => sortedT[Math.min(sortedT.length - 1, Math.floor(p * sortedT.length))].goalVsT!
console.log(`  goal-vs-T distribution:  min ${qt(0).toFixed(1)}%   p25 ${qt(0.25).toFixed(1)}%   median ${qt(0.50).toFixed(1)}%   p75 ${qt(0.75).toFixed(1)}%   p90 ${qt(0.90).toFixed(1)}%   max ${qt(0.999).toFixed(1)}%`)
console.log('  (positive = the prescribed "HM-pace" rep is FASTER than this runner\'s threshold pace)\n')
console.log('  bound            sessions excluded      plans losing every HM row')
for (const bound of [0, 1, 2, 3, 4, 5, 6, 8, 10]) {
  const excluded = withT.filter(r => r.goalVsT! > bound)
  const survivingPlans = new Set(withT.filter(r => r.goalVsT! <= bound).map(planKey))
  const lostPlans = Array.from(allPlans).filter(p => !survivingPlans.has(p)).length
  console.log(
    `  goal > T + ${String(bound).padStart(2)}%   ${String(excluded.length).padStart(5)} (${pct(excluded.length, withT.length).padStart(6)})` +
    `      ${String(lostPlans).padStart(4)} (${pct(lostPlans, allPlans.size).padStart(6)})`
  )
}
console.log()


// 6. WHERE THE CROSSERS ACTUALLY LAND. "Faster than threshold" is not one thing:
//    T -> CV is a coherent, harder-but-real band; past INTERVAL pace is the
//    incoherent ordering SC-06/CD-16 already names, and `goalBeyondMeasuredFitness`
//    already flags it in the difficulty band.
console.log('── 6. Where a threshold-crossing goal pace lands ──')
const band = (r: Row) =>
  r.goalMid > r.tMid!  ? 'slower than T (no issue)'
  : r.goalMid > r.cvMid! ? 'between T and CV'
  : r.goalMid > r.iMid!  ? 'between CV and INTERVAL'
  : 'at or past INTERVAL pace'
const counts = new Map<string, number>()
for (const r of withT) counts.set(band(r), (counts.get(band(r)) ?? 0) + 1)
for (const k of ['slower than T (no issue)', 'between T and CV', 'between CV and INTERVAL', 'at or past INTERVAL pace']) {
  console.log(`  ${k.padEnd(26)} ${String(counts.get(k) ?? 0).padStart(6)}  (${pct(counts.get(k) ?? 0, withT.length)})`)
}
console.log('  ⚠️ "at or past INTERVAL pace" is the ordering SC-06/CD-16 names and')
console.log('     `goalBeyondMeasuredFitness` already flags in the difficulty band — so it is')
console.log('     visible to the runner today, in words, while the engine prescribes the opposite.')
console.log()

// 7. THREE NAMED CASES, so the board rules on runners rather than on percentages.
console.log('── 7. Exemplars, one per band ──')
const fmt = (m: number) => `${Math.floor(m)}:${String(Math.round((m % 1) * 60)).padStart(2, '0')}`
for (const [name, pick] of [
  ['T -> CV        ', (r: Row) => r.goalMid <= r.tMid! && r.goalMid > r.cvMid!],
  ['CV -> INTERVAL ', (r: Row) => r.goalMid <= r.cvMid! && r.goalMid > r.iMid!],
  ['past INTERVAL  ', (r: Row) => r.goalMid <= r.iMid!],
] as const) {
  const r = withT.find(pick)
  if (!r) { console.log(`  ${name} none in grid`); continue }
  const b = (r.input as { benchmark?: { time?: string; distance_km?: number } }).benchmark
  console.log(`  ${name} ${b?.distance_km}km in ${b?.time}, target ${(r.input as {target_time?: string}).target_time}, ${r.input.days_available}d, ${r.input.current_weekly_km}km/wk, age ${r.input.age}`)
  console.log(`  ${' '.repeat(16)}goal ${fmt(r.goalMid)}  |  T ${fmt(r.tMid!)}  CV ${fmt(r.cvMid!)}  I ${fmt(r.iMid!)}  |  current HM ${fmt(r.hmMid)}`)
  console.log(`  ${' '.repeat(16)}stretch ${r.stretchPct.toFixed(1)}%, goal is ${Math.round((r.tMid! - r.goalMid) * 60)} s/km faster than threshold`)
}
console.log()

// 8. IS A PERCENTAGE STRETCH A GOOD PROXY FOR THE BAND? If the stretch ranges of
//    the three bands OVERLAP, no single percentage can separate them and the
//    bound must be expressed against the pace ordering instead.
console.log('── 8. Does a stretch percentage separate the bands? ──')
const bands: Array<[string, (r: Row) => boolean]> = [
  ['slower than T', r => r.goalMid > r.tMid!],
  ['T -> CV', r => r.goalMid <= r.tMid! && r.goalMid > r.cvMid!],
  ['CV -> INTERVAL', r => r.goalMid <= r.cvMid! && r.goalMid > r.iMid!],
  ['past INTERVAL', r => r.goalMid <= r.iMid!],
]
const ranges: Array<[string, number, number]> = []
for (const [name, f] of bands) {
  const xs = withT.filter(f).map(r => r.stretchPct)
  if (xs.length === 0) { console.log(`  ${name.padEnd(16)} none`); continue }
  const lo = Math.min(...xs), hi = Math.max(...xs)
  ranges.push([name, lo, hi])
  console.log(`  ${name.padEnd(16)} stretch ${lo.toFixed(1)}% .. ${hi.toFixed(1)}%   (n=${xs.length})`)
}
let overlaps = 0
for (let i = 1; i < ranges.length; i++) {
  if (ranges[i][1] < ranges[i - 1][2]) {
    overlaps++
    console.log(`  🔴 OVERLAP: "${ranges[i - 1][0]}" reaches ${ranges[i - 1][2].toFixed(1)}% while "${ranges[i][0]}" starts at ${ranges[i][1].toFixed(1)}%`)
  }
}
console.log(overlaps === 0
  ? '  ✅ No overlap: a single stretch percentage CAN separate the bands on this grid.'
  : `  🔴 ${overlaps} overlap(s): no single stretch percentage separates the bands. The bound must be`
  + '\n     expressed against the PACE ORDERING (goal vs CV), not as a percentage of current HM pace.')
console.log()

// 10. WHAT WITHHOLDING THE ROW COSTS §22 -- the part that cannot be settled here.
console.log('── 10. The §22 exposure the row carries ──')
if (s22.length > 0) {
  const share = s22.map(x => x.hmRows / x.denom)
  const mean = share.reduce((a, b) => a + b, 0) / share.length
  const wouldBreak = s22.filter(x => (x.denom - x.hmRows) === 0).length
  console.log(`  plans measured                                   ${s22.length}`)
  console.log(`  mean share of §22's window that IS hm_pace_intervals   ${(mean * 100).toFixed(1)}%`)
  console.log(`  plans where it is the ONLY non-VO2max quality         ${wouldBreak}  (${pct(wouldBreak, s22.length)})`)
}
console.log('  🔴 THIS IS NOT THE §22 ANSWER AND MUST NOT BE READ AS ONE. Withholding the row does')
console.log('     not leave the slot EMPTY -- the selector picks another row, and on a goal-pace week')
console.log('     §22 substitutes a T-anchored row to goal pace, so the replacement may well count')
console.log('     toward the same floor. The real number can only be taken on the CHANGED engine.')
console.log()
console.log('⚠️ THE GRID IS UNIFORM OVER TARGET TIMES AND REAL RUNNERS ARE NOT.')
console.log('   Every (benchmark x target) cell carries equal weight here, so a figure like "30% of')
console.log('   sessions" is 30% OF THIS GRID, not 30% of runners. The grid is the right instrument')
console.log('   for finding WHERE a boundary sits and the wrong one for how many people are past it.')
console.log('⚠️ WHAT THIS DOES NOT MEASURE: the §22 consequence. A plan losing its HM row loses')
console.log('   race-specific exposure, and §22 requires 50%. That number can only be taken on the')
console.log('   CHANGED engine, because today those sessions satisfy §22 by displaying a pace they')
console.log('   do not run. Phase 2.')
