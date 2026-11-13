// WEEK1-DELIVERED-CEILING-01 — the board's named evidence, and the finding it did not ask for.
//
//   npm run board:week1-bound
//
// The 2026-11-12 sitting ruled INSUFFICIENT EVIDENCE with the evidence named:
// 📊 Seiler: "The delivered week ignoring the declared week is a real finding and the step
// ratios are arithmetic, not evidence. What is missing is what BOUNDING week 1 costs."
// ⚖️ Condition: `measure:fitness` with and without a declared-week bound, at every distance,
// with `neverBuildsPct` and net build.
//
// 🔴 THE TWO METRICS THE BOARD NAMED CANNOT SHOW THE COST, AND THAT HAS TO BE SAID FIRST.
// In `measure-plan-fitness.ts` both are denominated on WEEK 1: `netBuildPct = peak/first - 1`
// and `neverBuilds` is `peak <= first * 1.02`, where `first` is the opening week's volume.
// Bounding week 1 LOWERS `first`, so net build RISES and neverBuilds FALLS — arithmetically,
// for every plan, whatever the bound does to the runner. Seiler's own objection ("the step
// ratios are arithmetic, not evidence") applies to the evidence he asked for. Running the
// harness both ways would have produced two favourable numbers and no information.
//
// 🔴 AND NO STANDARD CORPUS REACHES THIS ITEM'S RUNNERS. `cohortGrid`'s volume axis is
// [20, 35, 50, 70] and `targetedGridCore` is a constant 30, so the lowest declared volume in
// either is 20 km/week — while the cohort is "first-race, 4-8 km/week" (Sims, at the sitting).
// Measured on the standard corpora: **3 of 5,071 plans over the ceiling (0.1%)**, which is the
// population missing and not the engine behaving. So this builds a low-base cohort explicitly,
// at RULER values only — the wizard's weekly ruler steps by 5, so the declared 6 and 8 used by
// the item's own 2,520-probe measurement cannot be sent by any runner.
//
// WHAT IT MEASURES INSTEAD: whether the lever the board named can reach the gap at all.
// The sitting was explicit that the bound must act on the DELIVERED week via ADR-022's
// machinery — "easy runs trim while the §52 long run never does" — and explicit that bounding
// the CURVE was tried, measured and reverted (it lowered peak and opened §111's ratio door:
// designed refusals 782 -> 664, WEEK1-LEAP 70 -> 94). So the question that decides the ruling
// is not what the bound costs but whether the easy runs have the headroom to pay for it,
// above §52's per-session floor.
//
// ⚠️ IT MODELS THE LEVER'S REACH, NOT THE LEVER. `trimWeekEasyToTarget` needs a `PaceGuide`
// the plan does not carry, so this computes the trimmable headroom the trim would have —
// easy km above `MIN_SESSION_DISTANCE_KM.easy`, long run and quality excluded — rather than
// running it. A reach of zero cannot become non-zero by running the real trim; a reach that
// is positive would still need the real lever to confirm the cost.
// ⚠️ AND THE CURVE-BOUND'S FAILURE CANNOT RECUR HERE BY CONSTRUCTION, NOT BY MEASUREMENT:
// trimming week 1's sessions touches no curve value and no peak, so §111's denominator and
// the delivered peak are untouched. Stated as structure, NOT verified — the lever is unwired.

// WEEK1-DELIVERED-CEILING-01 — the board's named evidence, with the part it did not ask for.
//
// Condition from the 2026-11-12 sitting: "run the fitness harness with and without a
// declared-week bound, at every distance, and bring `neverBuildsPct` and net build with it."
import { cohortGrid, targetedGridCore, targetedGridExtra, COHORT_PLAN_START } from '../lib/plan/cohortGrid'
import { CHARITY_PERSONAS, charityInput, CHARITY_PLAN_START } from '../lib/plan/charityCohort'
import { generateRulePlan } from '../lib/plan/ruleEngine'
import { week1StepBaseKm } from '../lib/plan/startVolume'
import { sessionKmSelfPaced } from '../lib/plan/sessionDistance'
import { isLongRun } from '../lib/plan/sessionRole'
import { GENERATION_CONFIG as G, raceDistanceKey } from '../lib/plan/generationConfig'
import type { GeneratorInput, Plan, Session, Week } from '../types/plan'

const STRIDE = 7919
const spread = (xs: GeneratorInput[], n: number) =>
  Array.from({ length: Math.min(n, xs.length) }, (_, k) => xs[(k * STRIDE) % xs.length]!)

// 🔴 A CONSTRUCTED LOW-BASE COHORT, BECAUSE NO STANDARD CORPUS REACHES THIS ITEM'S RUNNERS.
// `cohortGrid`'s volume axis is [20, 35, 50, 70] and `targetedGridCore` is a constant 30, so
// the lowest declared volume anywhere in them is 20 km/week. The item's cohort is "first-race,
// 4-8 km/week" (Sims, at the sitting) and its own measurement was taken at a declared 5, 6, 8
// and 10. Measured on the standard corpora the answer is 3 of 5,071 plans over the ceiling —
// which is not the engine behaving, it is the population missing.
// ⚠️ AND ONLY RULER VALUES. The wizard's weekly ruler is min 0, max 160, STEP 5, so 6 and 8 —
// two of the four volumes the item's own measurement used — cannot be sent by any runner.
const R = G.WIZARD_VOLUME_RULER
const LOW_VOLUMES: number[] = []
for (let v = R.WEEKLY_KM_MIN; v <= 25; v += R.WEEKLY_KM_STEP) LOW_VOLUMES.push(v)
const DISTANCES = [5, 10, 21.1, 42.2]
const RUNWAYS = [10, 12, 16, 20, 24, 30]
const DAYS = [3, 4, 5]
const LONGEST = [0, 2, 5, 8]

const lowBase: GeneratorInput[] = []
for (const km of DISTANCES) for (const cwk of LOW_VOLUMES) for (const lr of LONGEST)
  for (const w of RUNWAYS) for (const d of DAYS) {
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

const rows: GeneratorInput[] = [
  ...lowBase,
  ...spread(cohortGrid() as GeneratorInput[], 1500),
  ...(targetedGridExtra() as GeneratorInput[]),
  ...CHARITY_PERSONAS.map(p => charityInput(p, CHARITY_PLAN_START)),
]

/** §2 Amendment 3's permitted week-1 ceiling. The formula `week1CeilingKm` held before it was
 *  deleted for having no consumer; re-derived here, where the evidence needs it. */
const ceilingOf = (input: GeneratorInput) => {
  const base = week1StepBaseKm(input)
  return Math.max(base * G.WEEK1_STEP_MAX_RATIO, base + G.WEEK1_STEP_MIN_ABS_KM)
}
const buildingWeeks = (p: Plan) => p.weeks.filter(w => (w.n ?? 0) >= 1 && w.type !== 'race')
const sessionsOf = (w: Week) => Object.values(w.sessions ?? {}).filter(Boolean) as Session[]

interface Agg {
  n: number; over: number; gap: number[]; w1: number[]; ceil: number[]
  reachable: number; partial: number; unreachable: number
  easyShare: number[]
}
const blank = (): Agg => ({ n: 0, over: 0, gap: [], w1: [], ceil: [], reachable: 0, partial: 0, unreachable: 0, easyShare: [] })
const byDist = new Map<string, Agg>()
const med = (xs: number[]) => xs.length ? xs.slice().sort((a, b) => a - b)[Math.floor(xs.length / 2)]! : NaN

let plans = 0
for (const input of rows) {
  let plan: Plan
  try { plan = generateRulePlan(input, 'trial', COHORT_PLAN_START, undefined, COHORT_PLAN_START) } catch { continue }
  plans++
  const ws = buildingWeeks(plan)
  const w1 = ws[0]
  if (!w1) continue
  const key = raceDistanceKey(input.race_distance_km)
  const a = byDist.get(key) ?? blank(); byDist.set(key, a)
  a.n++
  const delivered = w1.weekly_km ?? 0
  const ceiling = ceilingOf(input)
  a.w1.push(delivered); a.ceil.push(ceiling)
  if (delivered <= ceiling + 0.01) continue
  a.over++
  a.gap.push(delivered - ceiling)

  // CAN the ADR-022 lever reach it? "Easy runs trim while the §52 long run never does."
  // Trimmable headroom = easy km above the per-session floor, long run and quality excluded.
  const floor = G.MIN_SESSION_DISTANCE_KM.easy
  let easyKm = 0, headroom = 0
  for (const s of sessionsOf(w1)) {
    if (s.type !== 'easy' || isLongRun(s)) continue
    const km = sessionKmSelfPaced(s) ?? 0
    easyKm += km
    headroom += Math.max(0, km - floor)
  }
  a.easyShare.push(delivered > 0 ? easyKm / delivered * 100 : 0)
  const need = delivered - ceiling
  if (headroom >= need - 0.01) a.reachable++
  else if (headroom > 0.01) a.partial++
  else a.unreachable++
}

console.log(`OUT plans ${plans}  (easy per-session floor ${G.MIN_SESSION_DISTANCE_KM.easy} km; ceiling = max(base x ${G.WEEK1_STEP_MAX_RATIO}, base + ${G.WEEK1_STEP_MIN_ABS_KM}))`)
console.log('OUT dist     n   over-ceiling      median w1   median ceiling   median gap | lever: reaches / partial / cannot | median easy share of w1')
for (const k of ['5K', '10K', 'HM', 'MARATHON', '50K', '100K']) {
  const a = byDist.get(k); if (!a) continue
  const pct = a.n ? (a.over / a.n * 100) : 0
  console.log(`OUT ${k.padEnd(9)}${String(a.n).padStart(5)}  ${(a.over + ' (' + pct.toFixed(1) + '%)').padStart(14)}`
    + `${med(a.w1).toFixed(1).padStart(15)}${med(a.ceil).toFixed(1).padStart(17)}${med(a.gap).toFixed(1).padStart(13)}`
    + ` | ${String(a.reachable).padStart(5)} /${String(a.partial).padStart(5)} /${String(a.unreachable).padStart(6)}`
    + ` | ${med(a.easyShare).toFixed(0).padStart(4)}%`)
}
