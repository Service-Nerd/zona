/**
 * PLAN-QUALITY-AUDIT — "would we be PROUD to hand this plan over?"
 *
 * The founder's standing instruction, 2026-09-19: every plan, every distance,
 * every input, must be fit for purpose and something the coaching board and the
 * product group are proud to give someone. Priority one is the marathon runner
 * just starting out — never run before, or very low mileage, does not know what
 * to do — and the measure is minimising dropouts.
 *
 * ⚠️ THIS IS THE FIFTH QUESTION AND IT IS NOT ANSWERED BY THE OTHER FOUR.
 *   verify:sweep      — are plans VALID?          (says nothing about good)
 *   verify:parity     — are they UNCHANGED?
 *   cohort:shape      — did WHO-GETS-WHAT move?
 *   measure:fitness   — does the plan BUILD the runner?
 * A plan can be valid, unchanged, correctly classified, genuinely building, and
 * still be a plan no coach would hand over — seven consecutive two-run weeks
 * (S52-LOPSIDED-BOUND-01) passed all four.
 *
 * ⚠️ GATED — it runs inside `npm run verify` (2026-09-19). It shipped baselined
 * but ungated earlier the same day, which this repo's own history says is a
 * check that does not run: `measure:fitness` shipped ungated and that was
 * recorded as the mistake. 18 s against the chain's existing cost.
 *
 * ⚠️ IT CARRIES ITS OWN BEGINNER-MARATHON GRID ON PURPOSE. `cohortGrid` derives
 * `longest_recent_run_km` from volume and never varies injury; `targetedGrid`
 * pins age 40. Neither can express "never run before, wants to run London".
 * This repo's recorded lesson is that when a cohort reads as unreachable, the
 * corpus is the suspect before the rule — so priority one gets a corpus.
 */
import { cohortGrid, targetedGrid, COHORT_PLAN_START } from '../lib/plan/cohortGrid'
import { CHARITY_PERSONAS, ENGINE_PERSONAS, CHARITY_PLAN_START, charityRaceDate } from '../lib/plan/charityCohort'
import { generateRulePlan } from '../lib/plan/ruleEngine'
import { isDesignedRefusal } from '../lib/plan/designedRefusal'
import { sessionKmSelfPaced } from '../lib/plan/sessionDistance'
import { effectiveStartKm } from '../lib/plan/startVolume'
import { auditPlanQuality as audit, objectionsOnly, type Finding } from '../lib/plan/planQuality'
import type { GeneratorInput, Plan, Week, Session } from '../types/plan'

// ── The beginner-marathon corpus — priority one ─────────────────────────────
// Deliberately reaches BELOW what the other grids can express: a 0 km/week
// runner is accepted by §55 and is exactly the "never run before" case.
const BEGINNER_MARATHON_PLAN_START = '2026-10-05'      // a Monday
function beginnerMarathonGrid(): GeneratorInput[] {
  const out: GeneratorInput[] = []
  for (const cwk of [0, 5, 8, 10, 12, 15, 20, 25, 30])
    for (const longest of [0, 2, 3, 5, 8, 12])
      for (const days of [3, 4, 5])
        for (const raceWeeks of [16, 20, 24, 29])       // Oct -> Apr is ~29
          for (const age of [28, 42, 58])
            for (const injury of [[], ['Knee']] as string[][])
              for (const freshReturn of [undefined, 4]) {
                if (longest > cwk) continue             // incoherent input
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


// ── Run ─────────────────────────────────────────────────────────────────────
type Cohort = { name: string; inputs: GeneratorInput[]; planStart: string }
const STRIDE = 7919
const stride = (xs: GeneratorInput[], n: number) =>
  Array.from({ length: Math.min(n, xs.length) }, (_, i) => xs[(i * STRIDE) % xs.length])

const cohorts: Cohort[] = [
  { name: 'BEGINNER MARATHON (priority one)', inputs: beginnerMarathonGrid(), planStart: BEGINNER_MARATHON_PLAN_START },
  { name: 'cohortGrid', inputs: stride(cohortGrid(), 3000), planStart: COHORT_PLAN_START },
  { name: 'targetedGrid', inputs: stride(targetedGrid(), 1500), planStart: COHORT_PLAN_START },
  { name: 'charity personas', planStart: CHARITY_PLAN_START,
    inputs: CHARITY_PERSONAS.map(p => ({ ...p.input, race_date: charityRaceDate(p.weeks, CHARITY_PLAN_START, p.raceDay ?? 'sun') } as GeneratorInput)) },
  // PERSONA-CORPUS-01 (2026-09-19) — realistic runners the GRIDS CANNOT REACH.
  // A grid is an axis product and cannot express "experienced AND back running
  // regularly AND only 12 weeks", because its axes are independent and a real
  // runner's are not. E4 in this set produced an inverted `base 1..0` phase
  // that 0 of 45,764 grid plans reached.
  { name: 'engine personas', planStart: CHARITY_PLAN_START,
    inputs: ENGINE_PERSONAS.map(p => ({ ...p.input, race_date: charityRaceDate(p.weeks, CHARITY_PLAN_START, p.raceDay ?? 'sun') } as GeneratorInput)) },
]

const WRITE = process.argv.includes('--write')
const summary: Record<string, Record<string, number>> = {}
let grand = 0
for (const c of cohorts) {
  const tally: Record<string, number> = {}
  let built = 0, refused = 0, crashed = 0
  const refusalsBy: Record<string, number> = {}
  const examples: Record<string, string> = {}
  for (const input of c.inputs) {
    let plan: Plan
    try { plan = generateRulePlan(input, 'paid', c.planStart) }
    catch (e) {
      if (isDesignedRefusal(e)) { refused++; refusalsBy[(e as Error).name] = (refusalsBy[(e as Error).name] ?? 0) + 1 }
      else { crashed++; console.log(`  CRASH ${(e as Error).name}: ${(e as Error).message.slice(0, 90)}`) }
      continue
    }
    built++
    // RUBRIC-GAPS-01(a) — WATCHED findings are exempted rules, counted by
    // `measure:envelope` and reported beside the fit rate. They must NOT be
    // scored here: this harness gates on "no regression against baseline", and
    // an exempted rule appearing as a regression would fail the build for a
    // rule the board deliberately relaxed.
    //
    // ⚠️ FOUND BY CHECKING THE EXIT CODE, NOT THE OUTPUT. `npm run verify`
    // printed a passing test line and exited 1; this was the third consumer of
    // `auditPlanQuality` and the only one I had not updated.
    for (const fi of objectionsOnly(audit(plan, input))) {
      tally[fi.code] = (tally[fi.code] ?? 0) + 1
      examples[fi.code] ??= `${input.race_distance_km}km cwk=${input.current_weekly_km} longest=${input.longest_recent_run_km} `
        + `days=${input.days_available} age=${input.age}${(input.injury_history ?? []).length ? ' +injury' : ''}`
        + `${input.weeks_at_current_volume !== undefined ? ' +freshreturn' : ''} -> ${fi.detail}`
    }
  }
  const flagged = Object.values(tally).length
    ? c.inputs.length - built + Object.keys(tally).length * 0 : 0
  void flagged
  console.log(`\n═══ ${c.name} ═══`)
  console.log(`inputs ${c.inputs.length} | generated ${built} | REFUSED ${refused}`
    + `${Object.keys(refusalsBy).length ? ` (${Object.entries(refusalsBy).map(([k, v]) => `${k.replace('Error', '')} ${v}`).join(', ')})` : ''}`
    + ` | crashed ${crashed}`)
  if (built) {
    const rows = Object.entries(tally).sort((a, b) => b[1] - a[1])
    if (!rows.length) console.log('  no findings — every generated plan passes every predicate')
    for (const [code, n] of rows) {
      console.log(`  ${code.padEnd(16)} ${String(n).padStart(5)}  ${(n / built * 100).toFixed(1).padStart(5)}% of generated`)
      console.log(`     e.g. ${examples[code]}`)
    }
    grand += rows.reduce((a, [, n]) => a + n, 0)
    summary[c.name] = Object.fromEntries([
      ['generated', built], ['refused', refused],
      ...rows.map(([code, n]) => [code, n] as [string, number]),
    ])
  }
}
console.log(`\ntotal findings across all cohorts: ${grand}`)

// ── Baseline, the debt-register pattern (SWEEP-BASELINE-01, planFitnessBaseline) ──
// Makes the bleeding stop: a NEW regression fails, existing debt is tracked and
// visible rather than hidden. Re-baseline only with a declared reason.
import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join } from 'path'
import { compareToBaseline } from '../lib/plan/qualityBaselineCompare'
const BASELINE = join(process.cwd(), 'lib/plan/__fixtures__/planQualityBaseline.json')
if (WRITE) {
  writeFileSync(BASELINE, JSON.stringify(summary, null, 2) + '\n')
  console.log(`\nbaseline written to ${BASELINE}`)
} else if (existsSync(BASELINE)) {
  const base = JSON.parse(readFileSync(BASELINE, 'utf8')) as typeof summary
  // ⚠️ THE COMPARISON IS NOT A PER-CODE `n > b` AND HAS NOT BEEN SINCE
  // BINGE-BUCKET-CROSS-01: `BINGE-SEVERE-75` and `BINGE-WEEK` are two severity
  // buckets of ONE predicate, so a plan improving from 75% to 74% moved between
  // them and read as a +1 regression. It failed the build on a better plan.
  // `compareToBaseline` owns the rule and is tested; do not re-inline it.
  const worse = compareToBaseline(summary, base)
  console.log(worse.length ? `\n✗ WORSE THAN BASELINE:\n  ${worse.join('\n  ')}` : '\n✓ no regression against the committed baseline')
  if (worse.length) process.exit(1)
} else {
  console.log(`\n(no baseline yet — run with --write)`)
}
