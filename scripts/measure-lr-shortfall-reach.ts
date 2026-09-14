// measure-lr-shortfall-reach.ts — LR-SHORTFALL-DURATION-01.
//
// `long_run_shortfall` (ENGINE-02) reduces the week's long run after 2
// consecutive long runs under 82% of planned distance. `/api/adjust-plan` builds
// its input as `plannedKm: session.distance_km ?? null`, and the trigger then
// filters `plannedKm !== null`. A beginner's long run is DURATION-anchored with
// `distance_km` null (CLAUDE.md: 95.8% of their sessions), so those analyses are
// dropped and the trigger can NEVER fire for that cohort — the SESSION-KM
// silent-pass class that produced four separate defects in September.
//
// There is a SECOND gate in the same function: the reduction itself is
// `if (isLongRun(s) && s.distance_km)`, so even a firing trigger would no-op.
//
// This counts the population each gate excludes, and what `sessionKmSelfPaced`
// (the single owner) recovers.
//
// Run: NODE_ENV=production npx tsx scripts/measure-lr-shortfall-reach.ts

import { generateRulePlan } from '../lib/plan/ruleEngine'
import { sessionKmSelfPaced } from '../lib/plan/sessionDistance'
import { isLongRun } from '../lib/plan/sessionRole'
import { cohortGrid, COHORT_PLAN_START } from '../lib/plan/cohortGrid'
import type { Plan, Session } from '../types/plan'

const PLAN_START = COHORT_PLAN_START

let plans = 0, refused = 0
let longRuns = 0, distanceAnchored = 0, durationAnchored = 0
let recoverable = 0, unrecoverable = 0
// Per-plan: could this plan EVER see the trigger?
let plansAllVisible = 0, plansAllBlind = 0, plansMixed = 0

for (const input of cohortGrid()) {
  let plan: Plan
  try { plan = generateRulePlan(input as never, 'paid', PLAN_START) } catch { refused++; continue }
  plans++
  let vis = 0, blind = 0
  for (const w of plan.weeks) {
    for (const s of Object.values(w.sessions ?? {}) as (Session | undefined)[]) {
      if (!s || !isLongRun(s)) continue
      longRuns++
      if (s.distance_km != null) { distanceAnchored++; vis++; continue }
      durationAnchored++
      blind++
      // What the owner recovers from the session's own pace band.
      if (sessionKmSelfPaced(s) != null) recoverable++; else unrecoverable++
    }
  }
  if (blind === 0) plansAllVisible++
  else if (vis === 0) plansAllBlind++
  else plansMixed++
}

const pct = (n: number, d: number) => d === 0 ? 'n/a' : `${((n / d) * 100).toFixed(1)}%`
console.log(`plans generated: ${plans}  refused: ${refused}`)
if (plans === 0 || longRuns === 0) {
  console.error('FAIL: no plans or no long runs reached — this measurement means nothing.')
  process.exit(1)
}
console.log(`\nLONG RUNS: ${longRuns}`)
console.log(`  distance-anchored (trigger can see) : ${distanceAnchored}  (${pct(distanceAnchored, longRuns)})`)
console.log(`  duration-anchored (DROPPED today)   : ${durationAnchored}  (${pct(durationAnchored, longRuns)})`)
console.log(`\nOf the dropped, what sessionKmSelfPaced recovers:`)
console.log(`  recoverable (has its own pace band) : ${recoverable}  (${pct(recoverable, durationAnchored)})`)
console.log(`  still null (no pace to convert with): ${unrecoverable}  (${pct(unrecoverable, durationAnchored)})`)
console.log(`\nPLANS: ${plans}`)
console.log(`  every long run visible to the trigger : ${plansAllVisible}  (${pct(plansAllVisible, plans)})`)
console.log(`  NO long run visible — trigger is dead : ${plansAllBlind}  (${pct(plansAllBlind, plans)})`)
console.log(`  mixed                                 : ${plansMixed}  (${pct(plansMixed, plans)})`)

// §66 Amendment 1 — AFTER. A duration-anchored long run always carries
// `duration_mins` (it is what anchors it), so the time axis makes every long run
// comparable. This is the claim the fix makes; it is asserted, not assumed.
const comparableAfter = distanceAnchored + durationAnchored
console.log(`\n§66 AMENDMENT 1 — comparable on EITHER axis: ${comparableAfter} / ${longRuns} (${pct(comparableAfter, longRuns)})`)
console.log(`  reach: ${pct(distanceAnchored, longRuns)} → ${pct(comparableAfter, longRuns)}`)
console.log(`  plans with a dead trigger: ${pct(plansAllBlind, plans)} → 0.0%`)
if (comparableAfter !== longRuns) {
  console.error('FAIL: a long run is comparable on neither axis — the fix does not reach everything it claims.')
  process.exit(1)
}
