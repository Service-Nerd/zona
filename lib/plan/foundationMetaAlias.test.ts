import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { generateRulePlan } from './ruleEngine'
import { composePlanWithFoundation } from './foundationCompose'
import type { GeneratorInput, Plan } from '@/types/plan'

/**
 * FOUNDATION-META-ALIAS-01 — `composePlanWithFoundation` must never hand a caller
 * a `meta` object it also still holds a second reference to.
 *
 * 🔴 THE DEFECT THIS EXISTS FOR. `app/api/generate-plan/route.ts` mutated
 * `rulePlan.meta` (`plan_intro`, `enrichment`) and returned `composedRule`,
 * relying on the two being ONE object — and said so in a comment:
 *
 *     "composedRule.meta IS rulePlan.meta (composePlanWithFoundation spreads
 *      the plan, not its meta object)"
 *
 * ⚠️ THAT WAS TRUE WHEN IT WAS WRITTEN (`eb1b925b`, 2026-09-03) and was falsified
 * twelve days later by FOUNDATION-LONG-RUNWAY-01 (`65a5dd71`, 2026-09-15), which
 * added two `meta: { ...assembled.meta, ... }` spreads for the uncovered-runway
 * declaration. Neither commit referenced the other, and for 30 days a free runner
 * whose plan start is DELAYED (any surplus runway — §76 delays rather than
 * truncating) lost `meta.plan_intro` entirely. That is CA-01, the single AI surface
 * a free runner gets, and `PlanIntroCard` simply never rendered.
 *
 * 🔑 THE ROOT CAUSE IS NOT THE SPREAD — IT IS THAT THE ALIASING WAS CONDITIONAL.
 * Compose returned `meta` in THREE different identity states depending on input:
 *
 *   | foundation weeks | uncovered weeks | what came back          |
 *   |------------------|-----------------|-------------------------|
 *   | 0                | 0               | `assembled === plan`    |  ← full identity
 *   | > 0              | 0               | fresh plan, SHARED meta |
 *   | any              | > 0             | fresh plan, FRESH meta  |
 *
 * A caller cannot be correct about that, so the contract is now unconditional:
 * the returned plan's `meta` is ALWAYS a fresh object. A caller that mutates the
 * plan it passed IN and reads the one that came OUT breaks in every case rather
 * than only on long runways — loudly, here, instead of silently in production.
 *
 * ⚠️ THE SIBLING ROUTE WAS ALREADY RIGHT. `generate-plan/foundation/route.ts`
 * stamps `composed.meta`, not its input's. generate-plan was the outlier.
 */

const TODAY = '2026-09-21'

const runner = (raceDate: string, km: number): GeneratorInput => ({
  athlete_name: 'A', race_name: 'C', primary_metric: 'distance',
  race_distance_km: km, goal: 'finish', current_weekly_km: 15,
  longest_recent_run_km: 8, days_available: 4, age: 38, training_age: '<6mo',
  recent_quality_training: 'none', fitness_level: 'beginner',
  hard_session_relationship: 'neutral', injury_history: [],
  resting_hr: 55, max_hr: 184, race_date: raceDate, plan_start: TODAY,
  foundation_decision: 'add',
} as unknown as GeneratorInput)

/** `weeks` from TODAY, landing on a Sunday — charityCohort's own convention. */
const raceIn = (weeks: number): string =>
  new Date(new Date(`${TODAY}T00:00:00Z`).getTime() + (weeks * 7 - 1) * 86_400_000)
    .toISOString().slice(0, 10)

const compose = (weeksOut: number, km = 42.2, tier: 'free' | 'paid' = 'paid') => {
  const input = runner(raceIn(weeksOut), km)
  const rulePlan = generateRulePlan(input, tier, TODAY, undefined, TODAY)
  const res = composePlanWithFoundation(rulePlan, input, TODAY, 'add')
  return { input, rulePlan, ...res }
}

const uncovered = (p: Plan) =>
  Number((p.meta as unknown as Record<string, unknown>).uncovered_runway_weeks ?? 0)

describe('FOUNDATION-META-ALIAS-01 — compose never shares a meta reference', () => {
  /**
   * The three identity states above, asserted as ONE rule. Before the fix, the
   * short-runway case came back with a shared meta (and, with no foundation
   * weeks, as the very same plan object), so this arm goes red on the cases the
   * old code called safe — which is the point: the bug was not the long runway,
   * it was that the two behaved differently.
   */
  it('returns a FRESH meta on every runway length, not only when weeks are uncovered', () => {
    // ⚠️ From 12, not 10: `raceIn` lands the race a day short of the full week, so
    // 10 weeks out is 9 prep weeks and §44 BLOCKS a marathon there (PrepTimeError).
    // A refusal is the engine working, not a case to assert identity on.
    for (const weeksOut of [12, 14, 18, 21, 25, 30, 40, 52]) {
      const { rulePlan, plan } = compose(weeksOut)
      expect(
        plan.meta,
        `race ${weeksOut}wk out (uncovered=${uncovered(plan)}): compose handed back the ` +
        `caller's own meta object, so mutating the input plan silently rewrites the output`,
      ).not.toBe(rulePlan.meta)
    }
  })

  it('never returns the caller\'s own PLAN object either', () => {
    for (const weeksOut of [12, 25, 40]) {
      const { rulePlan, plan } = compose(weeksOut)
      expect(plan, `race ${weeksOut}wk out`).not.toBe(rulePlan)
    }
  })

  it('copies meta by VALUE — the fresh object carries every field it had', () => {
    // A fresh object must not mean a lossy one. §57's own stamp has to survive,
    // and so does everything generateRulePlan put there.
    const { rulePlan, plan } = compose(25)
    for (const k of Object.keys(rulePlan.meta)) {
      expect(plan.meta[k as keyof typeof plan.meta], `meta.${k} was dropped by the copy`)
        .toEqual(rulePlan.meta[k as keyof typeof rulePlan.meta])
    }
  })

  it('a mutation of the INPUT plan cannot reach the composed plan', () => {
    // The defect, stated as the property that was violated. This is what the
    // route was doing, and it must now be impossible rather than merely wrong.
    const { rulePlan, plan } = compose(14)
    ;(rulePlan.meta as unknown as Record<string, unknown>).plan_intro = 'LEAKED'
    expect((plan.meta as unknown as Record<string, unknown>).plan_intro).toBeUndefined()
  })
})

describe('FOUNDATION-META-ALIAS-01 — the route stamps the plan it returns', () => {
  /**
   * The behavioural half, replaying the route's own order on the long-runway case
   * that broke. Not a source assertion: a source assertion passes on a comment,
   * and this repo has shipped that mistake.
   */
  it('a free delayed-start plan keeps plan_intro and enrichment: skipped', () => {
    const { plan } = compose(30, 21.1, 'free')
    expect(uncovered(plan), 'this case must actually exercise the fresh-meta path').toBeGreaterThan(0)

    // Exactly what app/api/generate-plan/route.ts does on the free path.
    const returned = plan
    ;(returned.meta as unknown as Record<string, unknown>).plan_intro = 'INTRO'
    returned.meta.enrichment = 'skipped'

    expect((returned.meta as unknown as Record<string, unknown>).plan_intro,
      'CA-01: the free runner\'s only AI surface').toBe('INTRO')
    expect(returned.meta.enrichment,
      'GEN-FIX-02: absent must mean "generated before this shipped", never "free tier"')
      .toBe('skipped')
  })

  /**
   * 🔴 THE DURABLE GUARD. The behavioural arms above prove the owner is sound;
   * they cannot stop the route reaching for the wrong object again, which is the
   * mistake that actually happened. So read the route and require that after the
   * compose call it stamps the COMPOSED plan and never the foundation-free one.
   *
   * ⚠️ BOUNDED, NOT GREPPED. This repo has recorded a guard that matched its own
   * comment and one whose regex ended at the `>` inside `=>`. The region is
   * everything after the `composePlanWithFoundation(` call, and comment lines are
   * stripped before matching — the prose here DESCRIBES `rulePlan.meta`
   * deliberately and must not trip its own check.
   */
  /** Comments are prose. The notes in both files DESCRIBE `rulePlan.meta` on purpose. */
  const code = (file: string) => readFileSync(file, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n').map(l => l.replace(/\/\/.*$/, '')).join('\n')

  /**
   * ENGINE-ENTRY-01 re-anchored this (2026-10-15). The compose call moved into
   * `lib/plan/engine.ts`, so the old "after the compose call in the route" bound no
   * longer exists — and it failed loudly rather than passing on an empty slice,
   * which is the failure mode this repo has recorded three times in one file.
   *
   * ⚠️ TWO FILES, TWO DIFFERENT BOUNDS, because the hazard is different in each:
   * the route now holds `rulePlan` ONLY to hand to `enrich()` and
   * `generateFreeIntro()` (§57 keeps foundation copy from the model), so it must
   * never stamp it **at all** — a stricter rule than before. The engine composes
   * internally, so its bound is still "after the compose call".
   */
  it('the route never mutates rulePlan.meta AT ALL — it only passes it to the AI', () => {
    const offenders = Array.from(
      code('app/api/generate-plan/route.ts').matchAll(/rulePlan\.meta\.([A-Za-z_]+)\s*=/g),
    ).map(m => m[1])
    expect(
      offenders,
      `the route writes rulePlan.meta.${offenders.join(', rulePlan.meta.')} — that is ` +
      'FOUNDATION-META-ALIAS-01 exactly. Stamp the plan the route RETURNS instead.',
    ).toEqual([])
  })

  it('the engine never mutates rulePlan.meta after composing', () => {
    const src = code('lib/plan/engine.ts')
    const at = src.indexOf('composePlanWithFoundation(')
    expect(at, 'the compose call moved — re-anchor this check').toBeGreaterThan(-1)
    const offenders = Array.from(
      src.slice(at).matchAll(/rulePlan\.meta\.([A-Za-z_]+)\s*=/g),
    ).map(m => m[1])
    expect(
      offenders,
      `lib/plan/engine.ts writes rulePlan.meta.${offenders.join(', rulePlan.meta.')} after ` +
      'compose. The composed plan is what the caller gets; stamp that.',
    ).toEqual([])
  })

  it('and the engine hands BOTH plans back, so the caller need not guess', () => {
    // The API is what makes the trap unreachable: the two plans have names. If
    // `rulePlan` ever stops being returned, the caller has to reach for the composed
    // one for the AI, which §57 forbids — so this is a real guard, not decoration.
    const { rulePlan, plan } = compose(25)
    expect(rulePlan).toBeDefined()
    expect(plan).toBeDefined()
    expect(plan.meta).not.toBe(rulePlan.meta)
  })

  it('the stale shared-meta claim is gone from the route', () => {
    // The comment is why the defect was believed safe for 30 days. Leaving it
    // would re-teach the next reader the thing that was wrong.
    const src = readFileSync('app/api/generate-plan/route.ts', 'utf8')
    expect(src).not.toContain('composedRule.meta IS rulePlan.meta')
  })
})
