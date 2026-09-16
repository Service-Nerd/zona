// Board evidence — LONG-RUNWAY-EARNS-PLAN-01.
//
// THE QUESTION. §97 (CB-ONSET-03) ruled that surplus calendar weeks belong
// INSIDE the plan rather than in front of it, and raised the length cap from
// `DISTANCE_CONFIGS.idealWeeks` to §17's `max_weeks` — but only for a §89-gated
// runner. M1, the charity cohort's first-time marathoner, is the precise
// opposite of gated. Should the same headroom reach them?
//
// WHAT THIS MEASURES, and what it does NOT.
//  - Lengths, foundation weeks and uncovered weeks are MEASURED: `calcPlanLength`
//    takes `allowMaxWeeks` as a public parameter, so both sides of the comparison
//    come from the live function, not from arithmetic reproduced here.
//  - The DELIVERED shape of a +2-week plan cannot be measured before the change
//    exists: an ungated runner's cap is `idealWeeks` unconditionally, so the
//    engine will not build it. What IS measured is the engine's sensitivity to
//    plan length for this cohort (16 vs 18 weeks available), which is a real
//    response from `generateRulePlan` and is labelled as the extrapolation it is.
//
//   npx tsx scripts/board-evidence-long-runway.ts
//
// REPORTS ONLY. Asserts nothing, never gates (same rationale as
// board-evidence-onset.ts — a tool that quietly doubles as a gate is how you get
// a gate nobody runs).
import { calcPlanLength, getDistanceConfig, planWeekCap, parseDateLocal, formatDate, addDays } from '../lib/plan/length'
import { generateRulePlan } from '../lib/plan/ruleEngine'
import { composePlanWithFoundation } from '../lib/plan/foundationCompose'
import { plannedFoundationWeeks, gapDays } from '../lib/plan/foundationBlock'
import { GENERATION_CONFIG, raceDistanceKey } from '../lib/plan/generationConfig'
import { PLAN_SIGNATURES } from '../lib/plan/planSignatures'
import { CHARITY_PERSONAS, charityInput, CHARITY_PLAN_START } from '../lib/plan/charityCohort'
import type { GeneratorInput, Plan } from '../types/plan'

// PINNED, never the wall clock (SWEEP-VACUOUS-01).
const TODAY = '2026-09-21'

const pct = (n: number) => `${n.toFixed(1)}%`

function raceIn(weeks: number, from = TODAY): string {
  const d = new Date(`${from}T00:00:00Z`)
  return new Date(d.getTime() + (weeks * 7 - 1) * 86_400_000).toISOString().slice(0, 10)
}

// ── 1. The headroom §17 already declares, per distance ──────────────────────
// What the extension is WORTH before any runner is considered. If this is zero
// for a distance, no ruling can give that distance anything.
function headroomTable() {
  console.log('\n=== 1. HEADROOM §17 ALREADY DECLARES (no runner involved) ===')
  console.log('dist      idealWeeks  §17 max_weeks  capped cap  extension')
  const probes: Array<[string, number]> = [
    ['5K', 5], ['10K', 10], ['HM', 21.1], ['MARATHON', 42.2], ['50K', 50], ['100K', 100],
  ]
  for (const [label, km] of probes) {
    const ideal = getDistanceConfig(km).idealWeeks
    const max = PLAN_SIGNATURES[raceDistanceKey(km)].max_weeks
    const capped = planWeekCap(km)
    console.log(
      `${label.padEnd(9)} ${String(ideal).padStart(10)}  ${String(max).padStart(13)}` +
      `  ${String(capped).padStart(10)}  ${capped - ideal >= 0 ? '+' : ''}${capped - ideal}`,
    )
  }
}

// ── 2. Reach — WHO does this change, and does it touch anyone who would NOT idle? ──
// The board's scoping condition: "scoped to runners who would otherwise idle.
// If it reaches runners who would not, it does not ship."
function reachTable(km: number, label: string) {
  console.log(`\n=== 2. REACH — ${label} (${km} km), does the cap bind before the calendar? ===`)
  console.log('runway  weeksAvail  now  extended  delta  gap(d)  found  uncov now  uncov ext')
  for (const runway of [14, 16, 18, 19, 20, 21, 22, 25, 30, 40, 52]) {
    const race = raceIn(runway)
    // `ext` is the LIVE engine. `now` reproduces the PRE-2026-09-16 cap
    // (`idealWeeks`, ungated) by arithmetic, because that code path no longer
    // exists to be called — labelled as the historical reconstruction it is.
    const ext = calcPlanLength(km, race, TODAY)
    const now = { ...ext, totalWeeks: Math.min(ext.weeksAvailable, getDistanceConfig(km).idealWeeks) }
    now.planStartIso = formatDate(addDays(parseDateLocal(ext.raceWeekStartIso), -(now.totalWeeks - 1) * 7))
    const gapNow = gapDays(TODAY, now.planStartIso)
    const gapExt = gapDays(TODAY, ext.planStartIso)
    const foundNow = plannedFoundationWeeks(TODAY, now.planStartIso, 'add')
    const foundExt = plannedFoundationWeeks(TODAY, ext.planStartIso, 'add')
    const uncovNow = Math.max(0, Math.floor(gapNow / 7) - foundNow)
    const uncovExt = Math.max(0, Math.floor(gapExt / 7) - foundExt)
    console.log(
      `${String(runway).padStart(6)}  ${String(now.weeksAvailable).padStart(10)}` +
      `  ${String(now.totalWeeks).padStart(3)}  ${String(ext.totalWeeks).padStart(8)}` +
      `  ${String(ext.totalWeeks - now.totalWeeks).padStart(5)}  ${String(gapNow).padStart(6)}` +
      `  ${String(foundNow).padStart(5)}  ${String(uncovNow).padStart(9)}  ${String(uncovExt).padStart(9)}`,
    )
  }
}

// ── 3. The charity cohort — how many of the 14 are actually in scope? ────────
function charityScope() {
  console.log('\n=== 3. THE 14 CHARITY PERSONAS — who is in scope? ===')
  console.log('persona                                      dist   avail  now  ext  delta  gated')
  for (const p of CHARITY_PERSONAS) {
    if (p.expectRefusal) continue
    const input = charityInput(p)
    const ext = calcPlanLength(input.race_distance_km, input.race_date, CHARITY_PLAN_START)
    const now = { ...ext, totalWeeks: Math.min(ext.weeksAvailable, getDistanceConfig(input.race_distance_km).idealWeeks) }
    let gated = '?'
    try {
      const plan = generateRulePlan(input, 'paid', CHARITY_PLAN_START, undefined, CHARITY_PLAN_START)
      gated = plan.meta.early_quality_onset === true ? 'YES' : 'no'
    } catch { gated = 'refused' }
    console.log(
      `${p.id.slice(0, 44).padEnd(44)} ${String(input.race_distance_km).padStart(5)}` +
      `  ${String(now.weeksAvailable).padStart(5)}  ${String(now.totalWeeks).padStart(3)}` +
      `  ${String(ext.totalWeeks).padStart(3)}  ${String(ext.totalWeeks - now.totalWeeks).padStart(5)}  ${gated}`,
    )
  }
}

// ── 4. Sensitivity — what do 2 more weeks DO to this cohort's plan? ─────────
// Measured from the live engine by varying weeksAvailable BELOW the cap, where
// the calendar binds and the engine will actually build the shorter plan.
// This is the extrapolation basis, and is labelled as such.
function shape(plan: Plan) {
  const main = plan.weeks.filter(w => w.n >= 1)
  // RACE WEEK IS EXCLUDED FROM PEAK AND FROM THE STEP.
  //
  // This is the SAME defect the taper arm of `coaching-deviation-scan.ts`
  // carried until 2026-09-15: it took `peak` as the max over all weeks including
  // race week, so for a marathon (whose race week contains the 42.2 km race) the
  // peak was the race itself. First cut of this script reproduced it exactly and
  // reported M1's peak as 59.0 km with a 227.8% weekly step -- both of which are
  // week 17 (18 km) against race week (59 km). Identified by the week carrying a
  // `race` session rather than by index, because a Monday race (PV2-G) puts it in
  // a week that is not the last.
  const isRaceWeek = (w: typeof main[number]) =>
    Object.values(w.sessions ?? {}).some(sn => (sn as { type?: string } | undefined)?.type === 'race')
  const training = main.filter(w => !isRaceWeek(w))
  // `week.weekly_km` is the engine's own stamped DELIVERED figure (the same value
  // `cohortShape` reads). Recomputing it here would be a second answer to a
  // question the engine has already answered, which is the TAPER-DEPTH-02 trap:
  // a first pass compared the delivered figure against itself and scored 0.99.
  const vols = training.map(w => w.weekly_km ?? 0)
  // RAMP IS MEASURED BETWEEN NON-DELOAD WEEKS, which is the quantity §2 governs.
  // Step against the immediately preceding week measures the DELOAD REBOUND
  // instead: M1's headline 41.2% is week 6 (17 km, badge 'deload') to week 7
  // (24 km), which §2 does not govern and §3 deliberately produces. Reporting
  // the rebound as ramp aggression would have overstated it by ~4x.
  let maxStep = 0
  let prevProgressive: number | null = null
  for (const w of training) {
    const km = w.weekly_km ?? 0
    if (w.badge === 'deload') continue
    if (prevProgressive !== null && prevProgressive > 0 && km > prevProgressive) {
      maxStep = Math.max(maxStep, (km - prevProgressive) / prevProgressive * 100)
    }
    prevProgressive = km
  }
  const sessions = main.flatMap(w => Object.values(w.sessions ?? {})) as Array<{ type?: string }>
  // Quality is "not the aerobic/admin types", stated as an exclusion so a new
  // session type shows up as quality and gets noticed, rather than being silently
  // dropped by an allow-list that nobody updated. NOTE: a long run carries
  // `type: 'easy'` by design (see CLAUDE.md), so it is correctly not quality here.
  const AEROBIC = new Set(['easy', 'recovery', 'rest', 'race', 'cross_train', 'strength'])
  const quality = sessions.filter(sn => sn.type && !AEROBIC.has(sn.type))
  const phases = ['base', 'build', 'peak', 'taper'].map(
    ph => `${ph[0]}${main.filter(w => w.phase === ph).length}`,
  ).join(' ')
  return {
    weeks: main.length,
    phases,
    peak: vols.length ? Math.max(...vols) : 0,
    maxStep,
    quality: quality.length,
    qualityShare: sessions.length ? quality.length / sessions.length * 100 : 0,
  }
}

function sensitivity(mk: (race: string) => GeneratorInput, label: string) {
  console.log(`\n=== 4. SENSITIVITY TO PLAN LENGTH — ${label} (LIVE engine, calendar-bound) ===`)
  console.log('avail  built  phases         peak(NR)  max ramp    quality  quality share')
  for (const runway of [14, 15, 16, 17, 18]) {
    const input = mk(raceIn(runway))
    try {
      const plan = generateRulePlan(input, 'paid', TODAY, undefined, TODAY)
      const s = shape(plan)
      console.log(
        `${String(runway).padStart(5)}  ${String(s.weeks).padStart(5)}  ${s.phases.padEnd(14)}` +
        ` ${s.peak.toFixed(1).padStart(7)}  ${pct(s.maxStep).padStart(11)}` +
        `  ${String(s.quality).padStart(7)}  ${pct(s.qualityShare).padStart(13)}`,
      )
    } catch (e) {
      console.log(`${String(runway).padStart(5)}  REFUSED: ${(e as Error).message.slice(0, 60)}`)
    }
  }
}

// ── 5. What M1 is handed TODAY at a real charity runway ─────────────────────
function m1Today() {
  console.log('\n=== 5. WHAT M1 IS HANDED TODAY (25-week runway, the charity norm) ===')
  const input = m1Input(raceIn(25))
  const plan = generateRulePlan(input, 'paid', TODAY, undefined, TODAY)
  const { plan: composed } = composePlanWithFoundation(plan, input, TODAY, 'add')
  const s = shape(composed)
  const found = composed.weeks.filter(w => w.n <= 0).length
  console.log(`  plan_start        ${composed.meta.plan_start}`)
  console.log(`  main weeks        ${s.weeks}   phases ${s.phases}`)
  console.log(`  foundation weeks  ${found}`)
  console.log(`  uncovered weeks   ${composed.meta.uncovered_runway_weeks ?? 0}`)
  console.log(`  peak km (no race) ${s.peak.toFixed(1)}`)
  console.log(`  max ramp (§2)     ${pct(s.maxStep)}`)
  console.log(`  quality sessions  ${s.quality} (${pct(s.qualityShare)})`)
  console.log(`  gated (§89)       ${composed.meta.early_quality_onset === true ? 'YES' : 'no'}`)
}

function m1Input(race: string): GeneratorInput {
  return {
    athlete_name: 'A', race_name: 'C', primary_metric: 'distance',
    race_distance_km: 42.2, goal: 'finish', current_weekly_km: 15,
    longest_recent_run_km: 8, days_available: 4, age: 38, training_age: '<6mo',
    recent_quality_training: 'none', fitness_level: 'beginner',
    hard_session_relationship: 'neutral', injury_history: [],
    resting_hr: 55, max_hr: 184, race_date: race, plan_start: TODAY,
    foundation_decision: 'add',
  } as unknown as GeneratorInput
}

function hmInput(race: string): GeneratorInput {
  return { ...m1Input(race), race_distance_km: 21.1 } as GeneratorInput
}

headroomTable()
reachTable(42.2, 'MARATHON')
reachTable(10, '10K')
charityScope()
sensitivity(m1Input, 'M1 first-time marathoner (ungated, <6mo)')
sensitivity(hmInput, 'same runner at HM')
m1Today()
console.log()
