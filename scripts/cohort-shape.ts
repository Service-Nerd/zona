// COHORT-SHAPE-01 — print or re-baseline the cohort shape.
//
//   npm run cohort:shape            # print the current shape
//   npm run cohort:shape -- --write # re-baseline (ONLY with a declared reason)
//
// Re-baselining is a deliberate, reviewable act: the JSON diff IS the statement
// of what a change did to the population. Never run --write to make a red test
// green; run it when you can say, in the commit, which number moved and why.

import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { generateRulePlan } from '../lib/plan/ruleEngine'
import { composePlanWithFoundation } from '../lib/plan/foundationCompose'
import { cohortGrid, COHORT_PLAN_START, COHORT_REFUSAL } from '../lib/plan/cohortGrid'
import { summariseCohort, type CohortCase } from '../lib/plan/cohortShape'

export function runCohort(): CohortCase[] {
  return cohortGrid().map(input => {
    try {
      const raw = generateRulePlan(input, 'trial', COHORT_PLAN_START, undefined, COHORT_PLAN_START)
      // ADR-020 — compose is the single owner of plan.weeks post-generation, so
      // measuring raw engine output would measure a plan no runner receives.
      const plan = composePlanWithFoundation(raw, input, COHORT_PLAN_START, 'add').plan
      return { input, plan, refused: false }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      if (COHORT_REFUSAL.test(msg)) return { input, plan: null, refused: true }
      console.error('UNEXPECTED FAILURE:', msg.split('\n')[0])
      return { input, plan: null, refused: false }
    }
  })
}

const shape = summariseCohort(runCohort())

if (process.argv.includes('--write')) {
  const out = join(process.cwd(), 'lib', 'plan', '__fixtures__', 'cohortShapeBaseline.json')
  writeFileSync(out, JSON.stringify(shape, null, 2) + '\n')
  console.log(`Re-baselined → ${out}\n`)
}
console.log(JSON.stringify(shape, null, 2))
