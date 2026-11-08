import { describe, it, expect } from 'vitest'
import { generateRulePlan } from './ruleEngine'
import { validatePlan } from './invariants'
import { cohortGrid, targetedGrid, COHORT_PLAN_START } from './cohortGrid'
import { slowGoalGrid, slowGoalDates } from './slowGoalGrid'
import { buildPaceFromVDOT } from './paceBands'
import { weekdayBudgetFor } from './weekdayOverrunNote'
import { buildFallbackPace } from './ruleEngine'
import { sessionKmOrZero } from './sessionDistance'
import type { FitnessLevel } from './fitnessAssessment'
import type { GeneratorInput, Plan, Session } from '@/types/plan'

/**
 * WEEKLY-KM-AFTER-CAP-01 — a week restates its total whenever the final weekday-cap pass
 * changes its sessions, not only when it cuts one below the km floor.
 *
 * 🔴 WHAT WAS MISSING WAS THE CHECK, NOT JUST THE RESTATE. There was no invariant anywhere that
 * `week.weekly_km` equals the sum of that week's own sessions, so every pass that resized a
 * session after the total was computed left a figure the week no longer contained — silently,
 * because a stale number looks exactly like a correct one. §82 Amendment 2 had restated ONE
 * case (a held easy run cut below the km floor); everything else was uncovered.
 *
 * 📐 MEASURED 2026-11-08, same sample size on both sides. The pass changes sessions on
 * **1,002 of 38,994 slow-grid weeks** and **436 of 41,206 `cohortGrid` weeks** — `targetedGrid`
 * **0**, which is why `verify:parity` came back IDENTICAL on a grid of that shape and must not
 * be read as "nothing changed". Past the 1 km rounding width: **21 of 2,625 slow-grid plans and
 * 2 of 2,875 `cohortGrid` plans, worst 2 km**. Zero after.
 *
 * ⚠️ AN EARLIER PROBE OF MINE REPORTED "worst 5 km" AND THAT WAS NOT THE DEFECT'S SIZE — it
 * measured every week the pass moved, including the floor-cut weeks the old code already
 * restated correctly. The defect's worst measured gap is 2 km.
 */

const WD = ['mon', 'tue', 'wed', 'thu', 'fri'] as const
const CODE = 'INV-PLAN-WEEKLY-KM-MATCHES-SESSIONS'

/** The producer's own basis, rebuilt from the plan's stamped inputs — see the invariant. */
function guideFor(plan: Plan) {
  const m = plan.meta as { vdot?: number; vdot_training_anchor?: number; fitness_level?: string }
  if (m.vdot != null && m.vdot_training_anchor != null) return buildPaceFromVDOT(m.vdot_training_anchor, m.vdot)
  return m.fitness_level != null ? buildFallbackPace(m.fitness_level as FitnessLevel) : null
}

function worstGap(plan: Plan): number {
  const guide = guideFor(plan)
  if (!guide) return 0
  let worst = 0
  for (const w of plan.weeks ?? []) {
    if (w.phase === 'foundation' || w.weekly_km == null || !w.sessions) continue
    let total = 0, unpriceable = false
    for (const sn of Object.values(w.sessions) as (Session | undefined)[]) {
      if (!sn || sn.type === 'strength' || sn.type === 'rest' || sn.type === 'race') continue
      if (sn.distance_km == null && sn.duration_mins == null) { unpriceable = true; break }
      total += sessionKmOrZero(sn, guide.minPerKmEasy)
    }
    if (unpriceable) continue
    worst = Math.max(worst, Math.abs(w.weekly_km - Math.round(total)))
  }
  return worst
}

function sample(rows: GeneratorInput[], n: number): GeneratorInput[] {
  const out: GeneratorInput[] = []
  // A coprime stride so every prefix is spread — a round-robin over a corpus only ever
  // consumes its head, which is how the liveness debt was three times the sample, not the rules.
  for (let i = 0; i < n; i++) out.push(rows[(i * 1013) % rows.length])
  return out
}

/** ⚠️ EACH GRID WITH ITS OWN START. `slowGoalGrid` carries `slowGoalDates().planStart`; handing
 *  it `COHORT_PLAN_START` builds a different plan and measures the wrong thing, which is the
 *  `ONRAMP-W8-SPACING-01` mistake (a probe that passed arguments the real call does not). */
function generated(rows: GeneratorInput[], n: number, start: string | undefined): Plan[] {
  const out: Plan[] = []
  for (const input of sample(rows, n)) {
    try { out.push(generateRulePlan(input, 'trial', start, undefined, start)) }
    catch { /* a refusal is the engine working (§44/§52/§111/§113) */ }
  }
  return out
}

describe('WEEKLY-KM-AFTER-CAP-01 — a week states the week it contains', () => {
  const { planStart, benchmarkDate } = slowGoalDates()

  // The slow-goal grid is where §82's easy-run floor binds, so it is where the cap pass
  // actually resizes things. `targetedGrid` reaches 0 of them, measured.
  const slowRows = slowGoalGrid(planStart, benchmarkDate) as unknown as GeneratorInput[]
  /** The input a generated plan came from. The engine stamps its own, so read it from there
   *  rather than zipping two arrays whose lengths differ once a refusal drops a row. */
  const inputFor = (p: Plan): GeneratorInput =>
    ((p.meta as { generator_input?: GeneratorInput }).generator_input ?? {}) as GeneratorInput
  const slow = generated(slowRows, 600, planStart)
  const cohort = generated(cohortGrid(), 400, COHORT_PLAN_START)

  it('the population is real: both corpora generate, and the slow grid is the binding one', () => {
    expect(slow.length, 'slow-goal plans').toBeGreaterThan(300)
    expect(cohort.length, 'cohort plans').toBeGreaterThan(200)
    // The pass must actually touch something in this sample, or every arm below passes by
    // selecting nothing.
    //
    // ⚠️ MY FIRST PROXY WAS `floor_protected` AND IT IS ZERO ON THIS GRID — measured 0 of 551,
    // so the arm failed on its first run and was right to. The trim's real fingerprint is a
    // weekday session sitting at EXACTLY its day's budget: measured **276 of 551**.
    const atCap = slow.filter(p => (p.weeks ?? []).some(w =>
      WD.some(d => {
        const sn = (w.sessions as Record<string, Session | undefined>)?.[d]
        return sn?.duration_mins != null && sn.duration_mins === weekdayBudgetFor(inputFor(p), d)?.cap
      })))
    expect(atCap.length, 'no weekday session in the slow sample sits at its cap, so the pass has nothing to resize')
      .toBeGreaterThan(50)
  })

  it('no generated week states a total more than 1km from its own sessions', () => {
    const bad = [...slow, ...cohort].map(p => worstGap(p)).filter(g => g > 1)
    expect(bad.length, `${bad.length} plans state a week total away from their own sessions, worst ${Math.max(0, ...bad)}km`).toBe(0)
  })

  it('and the invariant agrees — producer and checker, not one of them', () => {
    // ⚠️ The arm above and this one are NOT the same check twice. That one recomputes the sum
    // here; this one runs `validatePlan`, which is what production and the sweep run. A
    // producer verified only by a test that re-derives the answer is the shape
    // `deloadCadence.test.ts` was written to break.
    // ⚠️ THE INPUT COMES OFF THE PLAN, not from zipping two arrays. A refusal drops a row, so
    // index i in `plans` stops corresponding to index i in the inputs the moment one is
    // refused — and the slow grid refuses by design (§44/§111/§113).
    let fired = 0
    for (const p of [...slow, ...cohort]) {
      for (const v of validatePlan(p, inputFor(p))) if (v.code === CODE) fired++
    }
    expect(fired, `${CODE} fired ${fired} times on generated plans`).toBe(0)
  })

  it('a foundation week is EXEMPT, and the exemption is exercised rather than assumed', () => {
    // A foundation week's `weekly_km` is its BUDGET (FRESH-FLOOR-01). The engine's cap pass
    // never sees one — `composePlanWithFoundation` runs after generation (ADR-020) — so this
    // invariant is the ONLY place the exemption can matter, and an exemption no case reaches is
    // a branch nothing proves. Built by hand because no corpus composes a block.
    const base = generated(cohortGrid(), 1, COHORT_PLAN_START)[0]!
    const plan = JSON.parse(JSON.stringify(base)) as Plan
    const w0 = JSON.parse(JSON.stringify(plan.weeks[0])) as Plan['weeks'][number]
    w0.n = 0
    w0.phase = 'foundation' as typeof w0.phase
    // A budget deliberately far from what its sessions come to: the FRESH-FLOOR-01 shape.
    w0.weekly_km = (w0.weekly_km ?? 10) + 9
    plan.weeks = [w0, ...plan.weeks]
    const codes = validatePlan(plan, inputFor(plan)).filter(v => v.code === CODE)
    expect(codes, 'the foundation exemption is not holding').toEqual([])

    // And the same week WITHOUT the foundation phase must fire, or the arm above proves only
    // that the invariant is asleep.
    const notFoundation = JSON.parse(JSON.stringify(plan)) as Plan
    notFoundation.weeks[0]!.phase = plan.weeks[1]!.phase
    notFoundation.weeks[0]!.n = plan.weeks[1]!.n
    const fired = validatePlan(notFoundation, inputFor(notFoundation)).filter(v => v.code === CODE)
    expect(fired.length, 'the same 9km-off week outside a foundation phase must be caught')
      .toBeGreaterThan(0)
  })

  it('a session with neither a distance nor a duration is skipped, not priced as zero', () => {
    // `?? 0` asserts "this session covered no ground" — four measured defects came from it
    // (SESSION-KM-01/02). An unpriceable week is skipped, which is the honest answer.
    const plan = JSON.parse(JSON.stringify(generated(cohortGrid(), 1, COHORT_PLAN_START)[0]!)) as Plan
    const target = plan.weeks.find(w => w.phase !== 'foundation')!
    for (const d of WD) {
      const sn = (target.sessions as Record<string, Session | undefined>)[d]
      if (sn && sn.type !== 'rest') { sn.distance_km = null as unknown as number; sn.duration_mins = null as unknown as number; break }
    }
    target.weekly_km = (target.weekly_km ?? 10) + 20
    expect(validatePlan(plan, inputFor(plan)).filter(v => v.code === CODE), 'an unpriceable week must be skipped, not guessed at').toEqual([])
  })

  it('targetedGrid reaches none of this, which is why parity returned IDENTICAL', () => {
    // 📐 Measured: the cap pass changes 0 of 45,968 `targetedGrid` weeks. Recorded as an arm
    // because `verify:parity` came back "IDENTICAL, 6,210 cases byte-for-byte" on a grid of
    // that shape, and reading that as "the change does nothing" would have been wrong.
    const plans = generated(targetedGrid(), 200, COHORT_PLAN_START)
    expect(plans.length).toBeGreaterThan(100)
    expect(Math.max(0, ...plans.map(worstGap))).toBeLessThanOrEqual(1)
  })
})
