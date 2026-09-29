/**
 * DASHBOARD-HARNESS-01 — builds the Plan the dev harness renders with.
 *
 * 🔴 IT IS GENERATED, NOT WRITTEN, AND THAT IS THE WHOLE POINT. This repo has a recorded
 * defect class for hand-authored fixtures: `'Shin splints'` was typed where the product
 * emits `'shin_splints'`, so a test passed against a plan no engine would ever produce.
 * A harness built on invented data shows you a screen the runner will never see.
 *
 * So the fixture is real engine output from a REAL production input:
 *   · input   — `lib/plan/__fixtures__/real-inputs.json`, redacted at source and already
 *               the corpus the property sweep trusts.
 *   · start   — the case's own captured `plan_start`, NOT the wall clock. Four engine
 *               tests once called the generator with an absolute race date and no start,
 *               so the plan start walked toward the race one week per week until §44's
 *               prep-time gate refused to generate (TEST-CLOCK-PREPTIME-01). A fixture
 *               regenerated from `nextMonday()` would rot the same way.
 *   · check   — `validatePlan()` runs before anything is written. A fixture the engine's
 *               own constitution would reject is worse than no fixture.
 *
 * Regenerate with:  npx tsx scripts/build-harness-fixture.ts
 * Guarded by:       components/dashboard/__fixtures__/harnessPlan.test.ts
 */
import { writeFileSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { generateRulePlan } from '@/lib/plan/ruleEngine'
import { validatePlan } from '@/lib/plan/invariants'
import type { GeneratorInput } from '@/types/plan'
import type { Tier } from '@/lib/plan/ruleEngine'

/** The half marathon: the richest of the four real cases (most weeks, most session
 *  variety), so the harness exercises more of each screen than a 5K would. */
const CASE_ID = '8333720c'

const corpus = JSON.parse(
  readFileSync(join(process.cwd(), 'lib/plan/__fixtures__/real-inputs.json'), 'utf8'),
) as { cases: Array<{ id: string; input: GeneratorInput; tier: string; plan_start: string }> }

const c = corpus.cases.find(x => x.id === CASE_ID)
if (!c) throw new Error(`build-harness-fixture: case ${CASE_ID} is not in real-inputs.json`)

const plan = generateRulePlan(c.input, c.tier as Tier, c.plan_start)

// ⚠️ Validate BEFORE writing. `validatePlan` throws on error-severity violations under
// NODE_ENV=test/development and logs in production, so read the result rather than
// relying on it to throw here.
const violations = validatePlan(plan, c.input)
const errors = violations.filter(v => v.severity === 'error')
if (errors.length) {
  console.error('build-harness-fixture: the generated plan violates its own constitution:')
  for (const e of errors) console.error('  ', e.code ?? '', e.message)
  process.exit(1)
}

const out = join(process.cwd(), 'components/dashboard/__fixtures__/harnessPlan.json')
writeFileSync(out, JSON.stringify(plan, null, 2) + '\n')
console.log(
  `harness plan written: case ${CASE_ID}, ${plan.weeks.length} weeks, ` +
    `${violations.length} violation(s) (${errors.length} error) -> ${out}`,
)
