// Board evidence — DELIVERED quality onset vs the onset §89 believes it set.
//
// WHY THIS EXISTS. §89 (ADR-021, 2026-09-06) states its own purpose in numbers:
// "first quality at week 5 of a 12-week plan ... the first third of the plan
// indistinguishable from a novice's." It shortens base 35% -> 15% so quality
// starts ~2 weeks sooner. It does — INSIDE plan.weeks.
//
// But §76 anchors the plan on race week and caps its length at the distance's
// `idealWeeks` (10K = 12), so a runner who enters a race further out than that
// has the surplus DELAYED, not truncated. `composePlanWithFoundation` (ADR-020)
// then fills the delay with up to FOUNDATION_MAX_WEEKS all-easy foundation
// weeks — and `computePhases` never sees them.
//
// The runner counts calendar weeks, not array indices. This measures the gap.
//
//   npx tsx scripts/board-evidence-onset.ts
//
// REPORTS ONLY. Asserts nothing, never gates. Mechanical checks belong in
// validatePlan(); a tool that quietly doubles as a gate is how you get a gate
// nobody runs (trace-plan.ts, same rationale).
import { generateRulePlan } from '../lib/plan/ruleEngine'
import { composePlanWithFoundation } from '../lib/plan/foundationCompose'
import type { GeneratorInput, Plan } from '../types/plan'

// PINNED, never `today` — the lesson of SWEEP-VACUOUS-01, where a grid of fixed
// race dates silently stopped generating once real time passed them.
const TODAY = '2026-09-07'

function raceDate(weeksOut: number): string {
  const d = new Date(`${TODAY}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + weeksOut * 7)
  return d.toISOString().slice(0, 10)
}

// The founder's real 2026-09-07 trial input, which is KNOWN to fire the §89
// gate (meta.early_quality_onset = true in production). The grid varies one
// axis off this baseline so a null result means the axis, not a broken input.
function baselineInput(weeksToRace: number, ready: boolean): GeneratorInput {
  return {
    age: 44,
    goal: 'time_target',
    max_hr: 185,
    terrain: 'road',
    benchmark: { time: '0:49:00', type: 'race', distance_km: 10 },
    race_date: raceDate(weeksToRace),
    resting_hr: 52,
    target_time: '0:45:00',
    training_age: ready ? '2-5yr' : '<6mo',
    max_hr_source: 'observed',
    days_available: 4,
    max_weekday_mins: 60,
    race_distance_km: 10,
    current_weekly_km: 30,
    days_cannot_train: ['monday', 'wednesday', 'thursday'],
    user_declared_level: ready ? 'experienced' : 'beginner',
    longest_recent_run_km: 10,
    preferred_long_run_day: 'sun',
    recent_quality_training: ready ? 'regular' : 'none',
    hard_session_relationship: 'love',
  } as unknown as GeneratorInput
}

const isQuality = (w: Plan['weeks'][number]) =>
  Object.values(w.sessions).some(s => s && s.type === 'quality')

/** 1-indexed position of the first week carrying a quality session. */
function onsetIndex(weeks: Plan['weeks']): number | null {
  const i = weeks.findIndex(isQuality)
  return i === -1 ? null : i + 1
}

console.log('='.repeat(80))
console.log('§89 DELIVERED ONSET — what the principle sets vs what the runner waits')
console.log('10K, 4 days, 30 km/wk, benchmark 49:00, target 45:00 (the founder\'s live input)')
console.log('='.repeat(80))
console.log()
console.log(' weeks   plan    gate     found.   onset INSIDE   onset in CALENDAR   §89 gain')
console.log(' to race len     fired    weeks    plan.weeks     weeks (delivered)   delivered?')
console.log(' ' + '-'.repeat(78))

const rows: { weeksToRace: number, planLen: number, gate: boolean, found: number, plan: number | null, cal: number | null }[] = []

for (const weeksToRace of [12, 13, 14, 15, 16, 18, 20]) {
  for (const ready of [true, false]) {
    if (!ready && weeksToRace !== 14) continue  // one control row is enough
    const input = baselineInput(weeksToRace, ready)
    let plan: Plan
    try { plan = generateRulePlan(input, 'paid') } catch (e) {
      console.log(` ${String(weeksToRace).padStart(5)}   (generation failed: ${(e as Error).message.slice(0, 40)})`)
      continue
    }
    const composed = composePlanWithFoundation(plan, input, TODAY)
    const found = composed.plan.weeks.filter(w => w.phase === 'foundation').length
    const gate = Boolean((plan.meta as { early_quality_onset?: boolean }).early_quality_onset)
    const p = onsetIndex(plan.weeks)
    const c = onsetIndex(composed.plan.weeks)
    rows.push({ weeksToRace, planLen: plan.weeks.length, gate, found, plan: p, cal: c })

    // §89's own stated "before" number for a 12-week plan is week 5.
    const verdict = !gate ? '(control)'
      : c == null ? 'no quality at all'
      : c < 5 ? `yes — week ${c}`
      : `NO — still week ${c}`
    console.log(
      ` ${String(weeksToRace).padStart(5)}   ${String(plan.weeks.length).padStart(3)}     ` +
      `${(gate ? 'Y' : 'n').padStart(5)}    ${String(found).padStart(6)}   ` +
      `${String(p).padStart(12)}   ${String(c).padStart(17)}   ${verdict}`)
  }
}

const fired = rows.filter(r => r.gate)
const nullified = fired.filter(r => r.plan != null && r.cal != null && r.cal > r.plan)
console.log()
console.log(` Gate fired on ${fired.length}/${rows.length} rows.`)
console.log(` Foundation weeks pushed onset LATER on ${nullified.length}/${fired.length} of them.`)
const backToBaseline = fired.filter(r => r.cal != null && r.cal >= 5)
console.log(` Delivered onset still at or beyond §89's own "before" number (week 5):` +
  ` ${backToBaseline.length}/${fired.length}.`)
console.log()
