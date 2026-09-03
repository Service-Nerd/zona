import { describe, it, expect } from 'vitest'
import { generateRulePlan } from './ruleEngine'
import { composePlanWithFoundation } from './foundationCompose'
import { validatePlan } from './invariants'
import corpus from './__fixtures__/real-inputs.json'
import type { GeneratorInput, Plan } from '@/types/plan'

/**
 * REAL-CORPUS-01 — replay every plan a real runner has actually generated.
 *
 * The property sweep's grid is hand-authored, and it was repeatedly wrong about
 * what real people enter: it tested `max_weekday_mins` 45/60/90 while BOTH real
 * users chose 30, and 0 of its 18,060 plans carried a foundation block. Three
 * defects shipped behind a green sweep in a single day.
 *
 * Invented inputs test invented users. This suite tests the ones we have —
 * exact inputs, replayed from `meta.generator_input` (persisted since PV2-A) —
 * and grows every time someone generates a plan. Committed as a fixture so
 * `npm run verify` stays offline and deterministic; refresh with
 * `npx tsx scripts/sync-plan-corpus.ts`.
 *
 * A refusal is a valid outcome (§44 prep-time, §52 low-days) and is not a
 * failure — the assertion is that a plan we DO produce is constitutional.
 */

const REFUSAL = /prep|days|volume|longest/i

describe('REAL-CORPUS-01 — real generator inputs', () => {
  it('has a corpus to test', () => {
    expect(corpus.cases.length).toBeGreaterThan(0)
  })

  it.each(corpus.cases.map(c => [c.id, c] as const))(
    'plan %s replays with no error-severity violations',
    (_id, c) => {
      const input = c.input as unknown as GeneratorInput
      let plan: Plan
      try {
        plan = generateRulePlan(input, (c.tier ?? 'trial') as 'free' | 'trial' | 'paid', c.plan_start)
      } catch (e) {
        // A documented refusal is correct behaviour, not a regression.
        const msg = e instanceof Error ? e.message.split('\n')[0] : String(e)
        expect(msg, `unexpected throw for ${_id}: ${msg}`).toMatch(REFUSAL)
        return
      }

      const errors = validatePlan(plan, input).filter(v => v.severity === 'error')
      expect(errors.map(v => `${v.code} w${v.week}${v.day ? ' ' + v.day : ''}`)).toEqual([])
    },
  )

  it.each(corpus.cases.map(c => [c.id, c] as const))(
    'plan %s stays constitutional WITH its foundation block attached',
    (_id, c) => {
      const input = c.input as unknown as GeneratorInput
      let plan: Plan
      try {
        plan = generateRulePlan(input, (c.tier ?? 'trial') as 'free' | 'trial' | 'paid', c.plan_start)
      } catch { return }

      // ADR-020 Option A — composePlanWithFoundation is the single owner of
      // plan.weeks mutation post-generation, the same function
      // /api/generate-plan calls. Mirrors what the runner actually gets: the
      // plan includes foundation weeks whenever the gap warrants one.
      // Validating only the engine's output is exactly the blind spot
      // ADR-020 exists to close. `c.captured` is real captured wall-clock
      // time, not an invented literal, so this reproduces the real
      // classification for this corpus entry.
      const { plan: assembled, violations } = composePlanWithFoundation(plan, input, c.captured, 'add')
      if (!assembled.weeks.some(w => w.n <= 0)) return   // no block warranted for this gap

      const errors = violations.filter(v => v.severity === 'error')
      expect(errors.map(v => `${v.code} w${v.week}${v.day ? ' ' + v.day : ''}`)).toEqual([])
    },
  )

  it('covers inputs the hand-authored sweep grid missed', () => {
    const inputs = corpus.cases.map(c => c.input as Record<string, unknown>)
    // The three gaps that let real defects ship. If a future corpus refresh
    // loses them, the suite says so rather than quietly narrowing.
    expect(inputs.some(i => i.max_weekday_mins === 30)).toBe(true)
    expect(inputs.some(i => Array.isArray(i.days_cannot_train) &&
      (i.days_cannot_train as string[]).some(d => d.length <= 3))).toBe(true)
    expect(inputs.some(i => Array.isArray(i.days_cannot_train) &&
      (i.days_cannot_train as string[]).some(d => d.length > 3))).toBe(true)
  })
})
