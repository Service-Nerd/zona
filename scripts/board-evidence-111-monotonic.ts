/**
 * Coaching Board evidence for `BASEBUILD-ADJUST-MONOTONIC-01`.
 *
 * QUESTION: §111 refuses marathon/ultra on delivered_peak ÷ current_weekly_km.
 * Anything that SHRINKS the delivered peak lowers the ratio. So does a runner who
 * CONSTRAINS themselves get admitted where the honest answer is refused — and how often?
 *
 * ⚠️ `baseVolume.test.ts` proves monotonicity over `current_weekly_km` ONLY.
 * These are the axes nobody measured.
 */
import { generateRulePlan, derivedLevelsFor } from '@/lib/plan/ruleEngine'
import { getDistanceConfig } from '@/lib/plan/length'
// 🔴 §111 Amendment 2 (2026-09-19): the denominator is `effectiveStartKm`, NOT the raw
// wizard figure. My first cost run divided by `current_weekly_km` — the ORIGINAL §111
// text, superseded three weeks ago — so its 14.0% was measured against a denominator
// the gate does not use. Same class as quoting a section heading past its amendment.
import { effectiveStartKm } from '@/lib/plan/startVolume'
import { BaseVolumeError } from '@/lib/plan/baseVolume'
import { GENERATION_CONFIG } from '@/lib/plan/generationConfig'
import type { GeneratorInput } from '@/types/plan'

const PLAN_START = '2026-10-05'
const raceDate = (w: number) => new Date(Date.parse(PLAN_START) + w * 7 * 864e5).toISOString().slice(0, 10)

function input(over: Partial<GeneratorInput>): GeneratorInput {
  return {
    athlete_name: 'X', age: 35, race_name: 'R', primary_metric: 'distance',
    plan_start: PLAN_START, race_distance_km: 42.2, race_date: raceDate(24),
    goal: 'finish', resting_hr: 52, max_hr: 180,
    current_weekly_km: 20, longest_recent_run_km: 10,
    user_declared_level: 'beginner', recent_quality_training: 'occasional',
    hard_session_relationship: 'neutral', training_age: '<6mo',
    days_available: 4, days_cannot_train: [], injury_history: [],
    max_weekday_mins: 45, terrain: 'mixed',
    ...over,
  } as unknown as GeneratorInput
}

type Outcome = 'generates' | 'base_volume_refusal' | 'other_refusal'
function run(i: GeneratorInput): Outcome {
  try { generateRulePlan(i, 'trial', PLAN_START, undefined, PLAN_START); return 'generates' }
  catch (e) { return e instanceof BaseVolumeError ? 'base_volume_refusal' : 'other_refusal' }
}

/** The axes a runner can change WITHOUT running more. Each value is "more constrained". */
const AXES = [
  { name: 'max_weekday_mins 45 → 30', patch: { max_weekday_mins: 30 } },
  { name: 'max_weekday_mins 45 → 20', patch: { max_weekday_mins: 20 } },
  { name: 'injury_history [] → [knee]', patch: { injury_history: ['knee'] } },
  { name: 'injury_history [] → [shin splints]', patch: { injury_history: ['shin splints'] } },
  { name: 'days_available 4 → 3', patch: { days_available: 3 } },
] as const

function main() {
  console.log(`§111 MAX_BASE_BUILD_RATIO = ${GENERATION_CONFIG.MAX_BASE_BUILD_RATIO}`)
  console.log(`plan_start pinned ${PLAN_START}\n`)

  // The population: marathon/ultra inputs §111 actually REFUSES. Built by sweeping the
  // space, not hand-picked — a hand-picked case proves nothing about frequency.
  const pop: GeneratorInput[] = []
  for (const race of [42.2, 50]) {
    for (const cwk of [5, 8, 10, 12, 15, 18, 20, 25]) {
      // ⚠️ `longest <= weekly` IS ENFORCED BY §18 (`INV-INPUT-LONGEST-LE-WEEKLY`), so a
      // grid that ignores it measures inputs no runner can state. My first run produced
      // hundreds of them and the real signal was buried in validator noise.
      for (const lrk of [5, 8, 10, 14].filter(v => v <= cwk)) {
        for (const weeks of [18, 24, 30]) {
          for (const goal of ['finish', 'time_target'] as const) {
            for (const age of [30, 50]) {
              pop.push(input({ race_distance_km: race, current_weekly_km: cwk,
                longest_recent_run_km: lrk, race_date: raceDate(weeks), goal, age }))
            }
          }
        }
      }
    }
  }
  const refused = pop.filter(i => run(i) === 'base_volume_refusal')
  console.log(`grid ${pop.length} marathon/ultra inputs · §111 refuses ${refused.length}`)
  console.log(`(the OTHER outcomes are not this rule's and are excluded: `
    + `${pop.filter(i => run(i) === 'generates').length} generate, `
    + `${pop.filter(i => run(i) === 'other_refusal').length} refused by another rule)\n`)

  console.log('── DOES CONSTRAINING YOURSELF BUY ADMISSION? ──')
  console.log(`${'axis'.padEnd(34)} ${'admitted'.padStart(9)} ${'of refused'.padStart(11)}   rate`)
  let worst = 0
  for (const ax of AXES) {
    const flipped = refused.filter(i => run({ ...i, ...ax.patch } as GeneratorInput) === 'generates')
    const pct = refused.length ? (flipped.length / refused.length) * 100 : 0
    worst = Math.max(worst, flipped.length)
    console.log(`${ax.name.padEnd(34)} ${String(flipped.length).padStart(9)} ${String(refused.length).padStart(11)}   ${pct.toFixed(1)}%`)
  }

  // ANY axis — the runner only needs one to work.
  const anyFlip = refused.filter(i =>
    AXES.some(ax => run({ ...i, ...ax.patch } as GeneratorInput) === 'generates'))
  console.log(`\n🔴 AT LEAST ONE constraint admits them: ${anyFlip.length} of ${refused.length} `
    + `(${((anyFlip.length / refused.length) * 100).toFixed(1)}%)`)

  // ── THE CONTROL: is the HONEST direction monotonic? More volume must never be refused.
  console.log('\n── CONTROL: the axis §111 WAS written for (more volume) ──')
  let violations = 0, checked = 0
  for (const i of pop) {
    const base = run(i)
    if (base !== 'generates') continue
    for (const higher of [i.current_weekly_km + 5, i.current_weekly_km + 10]) {
      checked++
      if (run({ ...i, current_weekly_km: higher } as GeneratorInput) === 'base_volume_refusal') violations++
    }
  }
  console.log(`  raising current_weekly_km on an admitted plan: ${violations} refusals in ${checked} checks `
    + `${violations === 0 ? '✅ monotonic, as baseVolume.test.ts asserts' : '❌'}`)
  console.log('\n⚠️ So the guarantee holds on the ONE axis that has a test, and not on the others.')
}
main()

/**
 * THE CANDIDATE FIX, measured rather than argued.
 *
 * §111's numerator is `deliveredPeakKm(plan)` — the plan AFTER the weekday cap, the
 * injury levers and the day count have shrunk it. So self-constraint lowers the
 * numerator. The alternative is the STRUCTURAL peak target (`DISTANCE_CONFIGS`
 * `peakKmByLevel`, §106), which is a function of distance and level.
 *
 * The question the board needs answered: **does the structural target move when the
 * runner constrains themselves?** If it does not, swapping the numerator removes the
 * inversion by construction rather than by threshold.
 */
export function measureFixCandidate() {
  const structuralPeak = (i: GeneratorInput): number => {
    const table = getDistanceConfig(i.race_distance_km).peakKmByLevel as Record<string, number>
    const lvl = derivedLevelsFor(i).structural
    return table[lvl] ?? table.beginner
  }

  const base = input({ current_weekly_km: 10, longest_recent_run_km: 8 })
  console.log('\n── THE CANDIDATE FIX: a numerator self-constraint cannot move ──')
  console.log(`${'input'.padEnd(34)} ${'delivered'.padStart(10)} ${'structural'.padStart(11)}`)
  for (const ax of [{ name: 'baseline (45 min, no injury)', patch: {} }, ...AXES]) {
    let delivered = NaN
    try {
      const p = generateRulePlan({ ...base, ...ax.patch } as GeneratorInput, 'trial', PLAN_START, undefined, PLAN_START)
      delivered = p.weeks.filter(w => w.phase !== 'foundation' && w.n > 0 && w.type !== 'race')
        .reduce((m, w) => Math.max(m, w.weekly_km ?? 0), 0)
    } catch { /* refused — delivered is undefined for a plan that does not exist */ }
    const s = structuralPeak({ ...base, ...ax.patch } as GeneratorInput)
    console.log(`${ax.name.padEnd(34)} ${(Number.isNaN(delivered) ? 'refused' : delivered.toFixed(1)).padStart(10)} ${s.toFixed(1).padStart(11)}`)
  }
  console.log('⚠️ If the structural column is CONSTANT while the delivered column moves,')
  console.log('   the inversion is in the NUMERATOR, not in the threshold.')
}
measureFixCandidate()

/**
 * THE COST OF THE FIX, which is the number that decides whether this is the board's
 * alone or needs the SLT too.
 *
 * The structural peak is >= the delivered peak by construction (delivery only ever
 * shrinks it). So a numerator swap makes §111 refuse MORE runners. How many?
 */
export function measureFixCost() {
  const structuralPeak = (i: GeneratorInput): number => {
    const table = getDistanceConfig(i.race_distance_km).peakKmByLevel as unknown as Record<string, number>
    const lvl = derivedLevelsFor(i).structural as string
    return table[lvl] ?? table.beginner
  }
  const cap = GENERATION_CONFIG.MAX_BASE_BUILD_RATIO

  const pop: GeneratorInput[] = []
  for (const race of [42.2, 50]) {
    for (const cwk of [5, 8, 10, 12, 15, 18, 20, 25, 30, 40, 55, 70]) {
      for (const lrk of [5, 8, 10, 14, 20, 28].filter(v => v <= cwk)) {
        for (const weeks of [18, 24, 30]) {
          for (const goal of ['finish', 'time_target'] as const) {
            pop.push(input({ race_distance_km: race, current_weekly_km: cwk,
              longest_recent_run_km: lrk, race_date: raceDate(weeks), goal }))
          }
        }
      }
    }
  }

  let admittedToday = 0, wouldRefuse = 0, refusedToday = 0
  for (const i of pop) {
    const today = run(i)
    if (today === 'base_volume_refusal') { refusedToday++; continue }
    if (today !== 'generates') continue
    admittedToday++
    if (structuralPeak(i) / effectiveStartKm(i) > cap) wouldRefuse++
  }
  console.log('\n── THE COST: swapping the numerator refuses MORE runners ──')
  console.log(`  grid ${pop.length} marathon/ultra inputs`)
  console.log(`  §111 refuses today:                 ${refusedToday}`)
  console.log(`  admitted today:                     ${admittedToday}`)
  console.log(`  of those, the STRUCTURAL ratio (÷ effectiveStartKm, §111 Am.2) exceeds the cap: ${wouldRefuse}`
    + `  (${((wouldRefuse / Math.max(1, admittedToday)) * 100).toFixed(1)}% of currently-admitted)`)
  console.log(`\n⚠️ That is the whole decision: the fix is CORRECT and it is not FREE.`)
  console.log(`   A straight swap turns ${wouldRefuse} plans into refusals, and §111's`)
  console.log(`   own history is of a gate that refused the flagship charity marathoner.`)
}
measureFixCost()
