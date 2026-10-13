// PEAK-STEPBACK-S52-FLOOR-01 — how many generated plans fail §47 Am.2, and why?
//
//   npx tsx scripts/measure-stepback-reach.ts [--stride N]
//
// ⚠️ THIS SCRIPT OUTLIVED TWO WRONG DIAGNOSES AND THE HEADER RECORDS THEM, because
// the next person will reach for the same two.
//   1. "§47 steps back weeks that were never peak-level." It does not — the week
//      IS peak-level before the trim; it reads below 90% afterwards by construction.
//   2. "Nothing trims easy volume." `applyPeakStepBackVolume` has since 2026-09-16.
//
// The real cause: TWO floors can stop the trim and the checker forgave one.
// §52 caps the long run at LONG_RUN_MAX_PCT_OF_WEEKLY of the week, so trimming
// easy — which RAISES that share — cannot take the week below
// `longRun / 0.60`. Where that floor sits above the preceding week, §47 Am.2 is
// unreachable without breaching §52. §52 prevails (§47 Am.3, Coaching Board
// 2026-10-13) and the residual is declared as a warn.
//
import { generateRulePlan } from '../lib/plan/ruleEngine'
import { cohortGrid, targetedGrid, COHORT_PLAN_START } from '../lib/plan/cohortGrid'
import { fullEnvelope } from '../lib/plan/useCaseEnvelope'
import { validatePlan } from '../lib/plan/invariants'
import { isDesignedRefusal } from '../lib/plan/designedRefusal'

const sa = process.argv.indexOf('--stride')
const STRIDE = sa > -1 ? Number(process.argv[sa + 1]) : 29
const CODE = 'INV-PLAN-PEAK-STEPBACK-VOLUME'

function sweep(name: string, inputs: any[], planStart?: string) {
  let plans = 0, refused = 0, bad = 0
  const examples: string[] = []
  for (let i = 0; i < inputs.length; i += STRIDE) {
    const input = inputs[i]
    let p: any
    try { p = generateRulePlan(input, 'paid', planStart) }
    catch (e) { if (isDesignedRefusal(e)) refused++; continue }
    if (!p?.weeks?.length) continue
    plans++
    const v = validatePlan(p, input).filter(x => x.code === CODE && x.severity === 'error')
    if (v.length) {
      bad++
      if (examples.length < 4) examples.push(
        `${input.race_distance_km}km ${input.current_weekly_km}km/wk ${input.fitness_level} ` +
        `${input.days_available}d age${input.age} — ${v[0].actual}`)
    }
  }
  if (plans === 0) { console.error(`REFUSING TO REPORT ${name}: 0 plans, ${refused} refused.`); process.exit(2) }
  console.log(`${name.padEnd(16)} plans ${String(plans).padStart(5)} · refused ${String(refused).padStart(4)} · ` +
              `FAIL §47 Am.2: ${bad} (${(100*bad/plans).toFixed(2)}%)`)
  for (const e of examples) console.log('    ' + e)
}

console.log(`\n${CODE} — how many generated plans actually fail it? (stride ${STRIDE})\n`)
sweep('cohortGrid', cohortGrid(), COHORT_PLAN_START)
sweep('targetedGrid', targetedGrid(), COHORT_PLAN_START)
sweep('fullEnvelope', fullEnvelope().map((c: any) => c.input))
