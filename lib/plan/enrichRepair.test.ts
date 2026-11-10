import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { cohortGrid, COHORT_PLAN_START } from './cohortGrid'
import { generateRulePlan } from './ruleEngine'
import { validatePlan } from './invariants'
import { errorBaseline } from './enrichAttribution'
import { repairEnrichedCopy } from './enrichRepair'
import type { GeneratorInput, Plan } from '@/types/plan'

// ENRICH-RESTORE-REPAIR-01 (2026-10-28). The generator's repair ladder was inline in the
// route, so the voice-restore script never ran it and wrote copy onto 4 live plans that
// promised a time trial their week did not hold (`INV-PLAN-COPY-MATCHES-SESSIONS`).

const input = cohortGrid().find(i => i.race_distance_km === 42.2 && i.goal === 'time_target' && (i.days_available ?? 0) >= 5) as GeneratorInput
const rule = generateRulePlan(input, 'paid', COHORT_PLAN_START) as Plan
const baseline = errorBaseline(validatePlan(rule, input))
const clone = (p: Plan): Plan => JSON.parse(JSON.stringify(p))
const hasTimeTrial = (w: Plan['weeks'][number]) => Object.values(w.sessions ?? {}).some(s => /time.?trial|benchmark/i.test(`${s?.label ?? ''} ${s?.catalogue_id ?? ''}`))

/** An "enriched" plan: every week's theme rewritten, one week falsely promising a time trial. */
function enrichedWithLie(): { plan: Plan; lieWeek: number } {
  const p = clone(rule)
  for (const w of p.weeks) w.theme = `AI theme for week ${w.n}.`
  const target = p.weeks.find(w => w.n > 0 && !hasTimeTrial(w))!
  target.theme = 'The 5K time trial on Tuesday is measurement, not training.'
  return { plan: p, lieWeek: target.n }
}

describe('repairEnrichedCopy (ENRICH-RESTORE-REPAIR-01)', () => {
  it('population: the fixture rule plan is valid and has a week with no time trial', () => {
    expect(validatePlan(rule, input).filter(v => v.severity === 'error')).toEqual([])
    expect(rule.weeks.some(w => w.n > 0 && !hasTimeTrial(w))).toBe(true)
  })

  it('clean copy is kept whole', () => {
    const p = clone(rule)
    for (const w of p.weeks) w.theme = `AI theme for week ${w.n}.`
    const r = repairEnrichedCopy(p, rule, baseline, input)
    expect(r.outcome).toBe('clean')
    expect(r.plan.weeks.every(w => w.theme === `AI theme for week ${w.n}.`)).toBe(true)
  })

  it('a week whose copy promises a time trial is reverted to rule copy; every other week keeps its AI copy', () => {
    const { plan, lieWeek } = enrichedWithLie()
    expect(validatePlan(plan, input).some(v => v.code === 'INV-PLAN-COPY-MATCHES-SESSIONS'), 'the lie must trip the check').toBe(true)
    const r = repairEnrichedCopy(plan, rule, baseline, input)
    expect(r.outcome).toBe('partial_revert')
    expect(Array.from(r.badWeeks)).toEqual([lieWeek])
    const reverted = r.plan.weeks.find(w => w.n === lieWeek)!
    expect(reverted.theme).toBe(rule.weeks.find(w => w.n === lieWeek)!.theme)
    expect(r.plan.weeks.filter(w => w.n !== lieWeek).every(w => w.theme === `AI theme for week ${w.n}.`)).toBe(true)
    expect(validatePlan(r.plan, input).filter(v => v.severity === 'error')).toEqual([])
  })

  // The composition the 28 Oct defect broke: every caller that ENRICHES a stored plan must
  // run the ladder. A new caller that skips it fails here.
  it('the generator route and the restore script both run the ladder', () => {
    const root = join(__dirname, '..', '..')
    for (const f of ['app/api/generate-plan/route.ts', 'scripts/reenrich-plans.ts']) {
      const s = readFileSync(join(root, f), 'utf8')
      // Bounded, not grepped (the first cut matched the script's OTHER repair call and stayed
      // green with the restore path's removed): after `await enrich(`, the ladder must run
      // before the first write of the plan.
      const calls = Array.from(s.matchAll(/await enrich\(/g)).map(m => m.index!)
      expect(calls.length, `${f}: enrich calls`).toBeGreaterThan(0)
      for (const at of calls) {
        const writes = ['.update(', '.upsert(', 'savePlanForUser(', 'plan_json: finalPlan', 'plan_json: res.plan']
          .map(x => s.indexOf(x, at)).filter(k => k > 0)
        // No write found after the call is itself a failure: an empty list made the bound
        // Infinity, and the gate passed while checking nothing.
        expect(writes.length, `${f}: a write after the enrich call at ${at}`).toBeGreaterThan(0)
        const repairAt = s.indexOf('repairEnrichedCopy(', at)
        expect(repairAt, `${f}: repair after enrich`).toBeGreaterThan(at)
        expect(repairAt, `${f}: repair before the first write`).toBeLessThan(Math.min(...writes))
      }
    }
  })
})

/**
 * 🔴 REENRICH-REPAIR-VALIDATOR-KIND-01 (2026-11-10) — THE REPAIR LADDER AND EVERY BASELINE THAT
 * FEEDS IT USE THE SAME KIND-DISPATCHING VALIDATOR.
 *
 * `repairEnrichedCopy` compares a candidate against a baseline its CALLER built. If the two
 * sides use different validators, `violationsIntroducedBy` diffs two constitutions and reports
 * phantom introductions — *test the composition, not the halves*. So this is a property of the
 * PAIR, not of either file, and a source arm is the only thing that can hold it: the behavioural
 * tests above pass whichever validator is used, because every fixture is a race plan and for a
 * race plan `validateSavedPlan` **is** `validatePlan`.
 *
 * ⚠️ `app/api/generate-plan/route.ts` is in the population and passes `composeViolations`, which
 * `foundationCompose` derives with raw `validatePlan` — deliberately, because that branch
 * destructures the `kind: 'plan'` outcome so only a race plan can reach it. That is asserted
 * below rather than left as a comment, because it is the one place the pair is allowed to differ.
 */
describe('REENRICH-REPAIR-VALIDATOR-KIND-01 — one validator across the repair ladder', () => {
  const src = (p: string) => readFileSync(join(process.cwd(), p), 'utf8')
  const code = (p: string) => src(p)
    .replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, ' '))
    .replace(/\/\/[^\n]*/g, m => m.replace(/[^\n]/g, ' '))

  const LADDER = ['lib/plan/enrichRepair.ts', 'scripts/reenrich-plans.ts'] as const

  it('the population is real — each file exists and calls the repair owner', () => {
    // An empty or wrong population makes every arm below vacuous, which is this repo's
    // most-recorded failure shape.
    expect(code('lib/plan/enrichRepair.ts')).toContain('export function repairEnrichedCopy')
    expect(code('scripts/reenrich-plans.ts')).toContain('repairEnrichedCopy(')
  })

  it('🔴 no file in the ladder calls raw validatePlan', () => {
    for (const f of LADDER) {
      expect(/\bvalidatePlan\(/.test(code(f)),
        `${f} must use validateSavedPlan — §116's dispatch, on both sides of the comparison`)
        .toBe(false)
      expect(code(f), `${f} must call the dispatching owner`).toContain('validateSavedPlan(')
    }
  })

  it('🔴 and both sides agree: the module and its baselines name the SAME function', () => {
    // The defect this guards is a MISMATCH, so assert the shared name rather than each half.
    const used = (f: string) => {
      const m = code(f).match(/\bvalidate(SavedPlan|Plan|StoredPlan|RepairedPlan|ReshapedPlan)\(/g) ?? []
      return Array.from(new Set(m.map(x => x.replace('(', '')))).sort()
    }
    expect(used('lib/plan/enrichRepair.ts')).toEqual(['validateSavedPlan'])
    expect(used('scripts/reenrich-plans.ts')).toEqual(['validateSavedPlan'])
  })

  it('the route keeps `composeViolations`, and only a RACE plan can reach that branch', () => {
    const route = code('app/api/generate-plan/route.ts')
    expect(route, 'the live path reuses the compose verdicts rather than re-validating')
      .toMatch(/errorBaseline\(composeViolations\)/)
    // `composeViolations` is carried ONLY by the `kind: 'plan'` outcome, which is what makes
    // the raw `validatePlan` behind it correct there. If that field ever appears on another
    // variant, this arm is the place that finds out.
    const engine = code('lib/plan/engine.ts')
    expect((engine.match(/composeViolations/g) ?? []).length,
      'composeViolations is declared once and returned once').toBe(2)
  })
})
