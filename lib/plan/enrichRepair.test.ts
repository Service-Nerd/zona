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
