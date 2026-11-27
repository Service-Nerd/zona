import { describe, it, expect, beforeAll } from 'vitest'
import { goldenSample, GOLDEN_AS_OF } from '@/lib/corpus/goldenCorpus'
import { runEngine } from './engine'
import { verifyPlan } from '@/lib/engine/verifier/verifyPlan'
import { UNVERIFIED_PREFIX, isUnverified } from '@/lib/engine/verifier/verifyPlan'
import { buildRunnerProfile, factsFromInput } from '@/lib/engine/profile/buildRunnerProfile'
import { GENERATION_CONFIG as G } from './generationConfig'
import type { Plan, GeneratorInput, Session } from '@/types/plan'

/**
 * ADR-027 B3, sitting row B10 — *"the quality-variety bound uses the same weeks it counts."*
 *
 * 🔑 THE BOARD'S PREMISE WAS THAT IT DID NOT, AND THAT WAS MEASURED FALSE. The bound comes from
 * `meta.quality_pool_sizes` and the counts skip race weeks, so the worry was that pool entries from
 * a race week inflated the bound. **A race week never holds a `type: 'quality'` session**: 0 across
 * 2,396 cohort plans (stride-sampled from 41,472), 37 corpus plans and 44 live plans. There was
 * nothing to align BY WEEK, which is also why the board marked the row latent.
 *
 * 🔴 WHAT IS REALLY MISALIGNED IS PER-PICK. The producer pushes one pool size per PICK, and the live
 * fleet carries **196 entries against 216 non-race quality sessions, 4 of 44 plans disagreeing** —
 * three legacy plans predating the field, and one with **8 entries for 9 picks**. A short list
 * lowers the pigeonhole bound, lowers the cap, and makes the rule MORE likely to fire.
 *
 * ── WHAT THESE ARMS ARE FOR ─────────────────────────────────────────────────────────────────────
 * The property the board asked for holds today **by construction rather than by check**, which is
 * the shape this repo keeps paying for. Arm 1 makes it mechanical, over engine output, and it is the
 * arm that would have caught the 8-vs-9 plan at generation. Arms 2–4 pin the verifier's three cases.
 *
 * 🔻 WHAT THEY DO NOT CHECK: whether the pigeonhole bound is the right bound (§53's, ratified), and
 * whether the 2026-10-10 live plan's missing entry has a reproducible cause — it does not reproduce
 * on today's engine (0 of 2,396 misaligned), so there is nothing left to localise from here.
 */

const nonRaceQualityPicks = (plan: Plan) => plan.weeks
  .filter(w => w.type !== 'race')
  .flatMap(w => Object.values((w.sessions ?? {}) as Record<string, Session | undefined>))
  .filter(s => s?.type === 'quality').length

type Case = { id: string; plan: Plan; input: GeneratorInput }
const cases: Case[] = []

beforeAll(() => {
  // In `beforeAll`, not at import, so the cost is billed to a test and `check:slow` can see it.
  for (const row of goldenSample({ perGroup: 4 })) {
    let o
    try { o = runEngine({ input: row.input, tier: row.tier, displayUnits: 'km', planStart: row.planStart, today: row.asOf }) }
    catch { continue }
    if (o.kind !== 'plan') continue
    cases.push({ id: row.id, plan: o.plan, input: row.input })
  }
})

describe('B10 — the quality-variety bound and the pool it is computed from', () => {
  it('🔴 one pool entry per non-race quality PICK, on every generated plan', () => {
    // The board's property, made mechanical. It holds by construction today; this is what keeps it
    // holding, and it is the check that would have caught the live 8-for-9 plan when it was built.
    // 🔴 THE POPULATION AND THE ASSERTION READ THE SAME LIST, and they did not at first: the floor
    // counted `cases` filtered one way while `off` was derived from a second expression, so
    // emptying the asserted list left the floor passing — a mutation proved it. One derivation now.
    const judged = cases
      .filter(c => (c.plan.meta.quality_pool_sizes ?? []).length > 0)
      .map(c => ({ id: c.id, pools: (c.plan.meta.quality_pool_sizes ?? []).length, picks: nonRaceQualityPicks(c.plan) }))
    // FLOORED, not merely non-empty: `> 0` would pass on one plan, and one plan agreeing with
    // itself is what made this property look safe for months. Measured at perGroup 4: 14 plans,
    // all 14 carrying pool sizes and all 14 carrying a race week.
    expect(judged.length, `only ${judged.length} plans carried pool sizes: the population has shrunk`).toBeGreaterThanOrEqual(10)
    expect(judged.filter(x => x.pools !== x.picks),
      'a quality pick that recorded no pool size, or a pool size with no pick').toEqual([])
  })

  it('🔴 a race week carries NO quality session — the fact B10\'s premise denied', () => {
    // If this ever goes red, B10's original premise becomes live and the bound really does count a
    // week it does not judge. Asserted rather than remembered, because the whole row rested on it.
    const withRaceQuality = cases.filter(c => c.plan.weeks.some(w =>
      w.type === 'race' && Object.values((w.sessions ?? {}) as Record<string, Session | undefined>)
        .some(s => s?.type === 'quality'))).map(c => c.id)
    expect(withRaceQuality, 'quality session in a race week: B10 is no longer latent').toEqual([])
    // Floored for the same reason: this arm is only meaningful over plans that HAVE a race week.
    const withRaceWeek = cases.filter(c => c.plan.weeks.some(w => w.type === 'race')).length
    expect(withRaceWeek, `only ${withRaceWeek} plans had a race week`).toBeGreaterThanOrEqual(10)
  })

  it('🔻 records what the verifier does NOT do on a mismatch, and why that was reverted', () => {
    // 🔴 I MADE THE RULE REPORT `unverified` ON A MISMATCH AND REVIEW KILLED IT. The early return
    // abandoned the `share` bound as well, which needs no pool data at all: a plan with six
    // identical quality rows and a pool list short by one went from a real §53 finding to a bare
    // `unverified`. **And both guards that should have caught the swap are blind to it** — the
    // agreement harness keys findings on `rule|week|day|severity` with `detail` EXCLUDED, so an
    // unverified finding is indistinguishable from a real one, and `verifierShadow`'s `lost` joins
    // on rule id with no `isUnverified` filter, so a real finding REPLACED by an unverified one is
    // counted as neither lost nor gained. My "0 lost" was unfalsifiable for the only case that
    // mattered. Filed as `VERIFIER-UNVERIFIED-KEY-COLLISION-01` and
    // `QUALITY-POOL-PICK-ALIGNMENT-01`.
    //
    // So the behaviour today is unchanged and this arm PINS that, rather than leaving a reader to
    // infer it from an absence: a short pool list still gets a verdict, computed from a narrower
    // population than the counts. That is the open defect, not a property to celebrate.
    const base = cases.find(c => (c.plan.meta.quality_pool_sizes ?? []).length > 1)!
    const plan = JSON.parse(JSON.stringify(base.plan)) as Plan
    plan.meta.quality_pool_sizes = (plan.meta.quality_pool_sizes ?? []).slice(0, -1)
    const f = verify(plan, base.input).filter(x => x.rule_id === 'INV-PLAN-QUALITY-VARIETY-FULL-PLAN')
    expect(f.filter(isUnverified), 'a mismatch is NOT reported unverified today').toEqual([])
    expect(UNVERIFIED_PREFIX, 'the contract still exists for the rules that do use it').toBe('unverified: ')
  })
})

function verify(plan: Plan, input: GeneratorInput) {
  const profile = buildRunnerProfile(factsFromInput(input), { asOf: GOLDEN_AS_OF, timezone: null })
  return verifyPlan(plan, { input, profile }, 'saved')
}
