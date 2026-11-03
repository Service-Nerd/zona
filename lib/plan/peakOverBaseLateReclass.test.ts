import { describe, it, expect } from 'vitest'
import { slowGoalGrid, slowGoalDates } from './slowGoalGrid'
import { generateRulePlan } from './ruleEngine'
import { validatePlan } from './invariants'
import { isDesignedRefusal } from './designedRefusal'
import { GENERATION_CONFIG } from './generationConfig'
import type { GeneratorInput, Plan } from '@/types/plan'

/**
 * S9-HELD-PEAK-CLASSIFY-01 — §23 is re-asked on the weeks the runner actually gets.
 *
 * 🔴 THE DEFECT. `volume_profile` was decided ~2,000 lines before the end of generation.
 * Two later passes move volume: §90 Am.1's quality yield (which calls
 * `applyWeekdayMinsCap` and recomputes `w.weekly_km`) and §82 Am.2's final cap pass. A
 * plan that read as a build and then stopped building kept the `build` declaration, and
 * `INV-PLAN-PEAK-OVER-BASE` fired on the shrunken week with the producer already
 * committed. Measured 2026-11-03: **3 of 880 slow-goal plans** — 5K, 20 km/week, a 7:30
 * marathon benchmark, 3 days, a 30-minute weekday cap, declared intermediate: peak 13 km
 * against week 1's 12 km, 108% under §23's 110%.
 *
 * It is `LOPSIDED-ORDER-01`'s class exactly: §52's detection was moved below the same
 * yield pass, for the same reason, and said so in its own comment.
 *
 * 🔴 AND THE FILED FIX WAS DANGEROUS AS WRITTEN. The item said *"re-run the
 * peak-over-base classification on delivered `weekly_km`"*. As a RECOMPUTE that is a
 * serious regression: `volume_profile` is composed from SIX triggers and §23 is one.
 * **Measured: 3,544 of 17,200 sampled plans pass §23's ratio on their delivered weeks
 * while being maintenance for one of the other five** (440 of 880 slow-goal, 2,336 of
 * 13,248 cohortGrid, 768 of 3,072 targetedGrid) — a recompute would have declared every
 * one a `build` and discarded its runner-facing `volume_constraint_note`.
 *
 * So the re-check is ONE-WAY, and the arm below is what holds it that way.
 */

const { planStart, benchmarkDate } = slowGoalDates()
const G = GENERATION_CONFIG

/** §23's test, as `INV-PLAN-PEAK-OVER-BASE` states it, on the delivered weeks. */
const meetsRatio = (p: Plan): boolean | null => {
  if (p.weeks.length < G.PEAK_OVERLOAD_MIN_PLAN_WEEKS) return null
  const w1 = (p.weeks.find(w => w.phase !== 'foundation') ?? p.weeks[0])?.weekly_km ?? 0
  const peaks = p.weeks.filter(w => w.phase === 'peak')
  if (!(w1 > 0) || peaks.length === 0) return null
  return Math.max(...peaks.map(w => w.weekly_km)) / w1 >= G.PEAK_OVER_BASE_RATIO
}

/**
 * 🔴 COLLECTED, NOT THROWN, AND MY FIRST VERSION OF THIS FILE GOT IT WRONG.
 *
 * Under `NODE_ENV=test` `generateRulePlan` THROWS on an error-severity violation, and
 * these plans are generated at module scope. So when I falsified the fix by reverting it,
 * the file did not go red — it reported **"no tests"**, because collection died on the
 * first throw. Both falsifying mutations did that, and a gate that VANISHES reads
 * completely differently from a gate that goes red the day somebody is skimming CI
 * output. `deliveredRampTail.test.ts` records the identical lesson in its own comment and
 * I did not apply it until a mutation showed me.
 *
 * So: every throw is collected and asserted in a NAMED arm below.
 */
const unexpected: string[] = []
const build = (input: GeneratorInput): Plan | null => {
  try { return generateRulePlan(input, 'paid', planStart) as Plan }
  catch (e) {
    if (isDesignedRefusal(e)) return null
    unexpected.push(String((e as Error).message).split('\n').slice(0, 2).join(' / ').slice(0, 220))
    return null
  }
}

const LATE_RULE = /^§23 — peak-over-base re-read/

/**
 * The exact cell that carried the defect, selected FROM THE GRID rather than hand-built —
 * a fixture written in values the product cannot emit is how 'Shin splints' never matched
 * 'shin_splints' for months. Four rows (one per goal gap); three of them flipped.
 */
const CELL = slowGoalGrid(planStart, benchmarkDate).filter(c =>
  c.race_distance_km === 5
  && (c as unknown as { benchmark: { time: string } }).benchmark.time === '7:30:00'
  && c.days_available === 3
  && c.max_weekday_mins === 30
  && (c as unknown as { user_declared_level?: string }).user_declared_level === 'intermediate')

describe('S9-HELD-PEAK-CLASSIFY-01 — a plan that stops building is declared maintenance', () => {
  const built = CELL.map(c => {
    const { gap, ...input } = c as unknown as Record<string, unknown>
    return { gap, input: input as unknown as GeneratorInput, plan: build(input as unknown as GeneratorInput) }
  }).filter((x): x is { gap: unknown; input: GeneratorInput; plan: Plan } => x.plan != null)

  it('the sample is real — the defect cell still generates', () => {
    expect(CELL.length).toBe(4)
    expect(built.length).toBeGreaterThanOrEqual(3)
  })

  it('🔴 nothing in this suite throws an error-severity violation', () => {
    // THE ARM THAT KEEPS THIS FILE VISIBLE. Reverting the fix makes the three defect
    // plans throw under NODE_ENV=test; without this arm the file reports "no tests"
    // instead of going red. Both of the mutations used to falsify this suite did exactly
    // that before it existed.
    expect(unexpected.slice(0, 4),
      'a plan failed validation during generation — the re-classification is not holding')
      .toEqual([])
  })

  it('🔴 the late re-check FIRES, and on the plans that need it', () => {
    // Vacuity: an arm asserting "no violations" passes on a corpus where the shape never
    // occurs, which is how this defect hid on a level-forced grid in the first place.
    const fired = built.filter(b => (b.plan.meta.rule_adjustments ?? []).some(a => LATE_RULE.test(a.rule)))
    expect(fired.length, 'nothing re-classified: this arm is asserting nothing').toBe(3)
    for (const b of fired) {
      expect(meetsRatio(b.plan), `gap ${b.gap} should still fail §23's ratio`).toBe(false)
      expect(b.plan.meta.volume_profile).toBe('maintenance')
    }
  })

  it('🔴 and §23 no longer fires on them', () => {
    for (const b of built) {
      const hits = validatePlan(b.plan, b.input).filter(v => v.code === 'INV-PLAN-PEAK-OVER-BASE')
      expect(hits.map(h => h.message), `gap ${b.gap}`).toEqual([])
    }
  })

  it('the declaration carries §23’s OWN note — no new runner-facing copy', () => {
    for (const b of built) {
      if (b.plan.meta.volume_profile !== 'maintenance') continue
      expect(b.plan.meta.volume_constraint_note, `gap ${b.gap} is maintenance with no reason`)
        .toBeTruthy()
    }
  })

  it('🩹 the audit line survives when it is the ONLY adjustment', () => {
    // `meta` is assembled ~80 lines before this pass with
    // `...(ruleAdjustments.length > 0 ? { rule_adjustments } : {})`, so pushing onto the
    // local array lands nowhere when no earlier rule fired — and all three of these
    // plans have exactly ONE adjustment, so they are precisely that case.
    const fired = built.filter(b => (b.plan.meta.rule_adjustments ?? []).some(a => LATE_RULE.test(a.rule)))
    expect(fired.length).toBe(3)
    for (const b of fired) {
      expect(b.plan.meta.rule_adjustments!.length, `gap ${b.gap}`).toBe(1)
    }
  })
})

describe('🔴 ONE-WAY — the re-check never strips a maintenance declaration', () => {
  // ⚠️ MY FIRST VERSION OF THIS ARM SELECTED THE WRONG POPULATION AND A MUTATION SAID SO.
  // It took every maintenance plan that passes §23's ratio — 440 on this grid — and the
  // two-way mutation left it GREEN, because 400 of those are HM and marathon, where §23
  // can still return maintenance on its OWN other two grounds (§46's volume floor, §24's
  // long-run floor). A recompute does not strip those, so they were never at risk.
  //
  // The population actually at risk is 5K and 10K: both of those floors are structurally
  // ZERO there (`volumeFloor` is set only for distKm >= 40, `longRunFloorKm` only for
  // HM/MARATHON time targets), so for them §23 can return nothing but `build` — and a
  // recompute therefore strips the declaration and its note. Measured: **40 of 960**
  // (5K 12, 10K 28).
  //
  // ⚠️ SELECTED BY SIGNATURE, NOT BY STRIDE. The at-risk plans CLUSTER — 32 of the 40 are
  // `days=3, max_weekday_mins=30, declared intermediate` — so a stride over the 480 5K/10K
  // rows finds 4 of 40 and the arm becomes nearly vacuous while looking thorough. The
  // whole-grid filter costs 480 generations (~30s); this cell costs 48 and holds 32 of them.
  const AT_RISK = slowGoalGrid(planStart, benchmarkDate)
    .filter(c => (c.race_distance_km === 5 || c.race_distance_km === 10)
      && c.days_available === 3
      && c.max_weekday_mins === 30
      && (c as unknown as { user_declared_level?: string }).user_declared_level === 'intermediate')
  const kept = AT_RISK.map(c => {
    const { gap, ...input } = c as unknown as Record<string, unknown>
    void gap
    return build(input as unknown as GeneratorInput)
  }).filter((p): p is Plan => p != null && p.meta.volume_profile === 'maintenance' && meetsRatio(p) === true)

  it('the at-risk population exists — a recompute would strip exactly these', () => {
    expect(kept.length,
      'no 5K/10K plan is maintenance-while-passing-the-ratio: this suite proves nothing, '
      + 'and that is how the first version of this arm stayed green under a two-way recompute')
      .toBeGreaterThan(20)
  })

  it('🔴 every one keeps BOTH the declaration and the reason', () => {
    for (const p of kept) {
      expect(p.meta.volume_profile).toBe('maintenance')
      expect(p.meta.volume_constraint_note, 'maintenance with no reason is a dishonest declaration')
        .toBeTruthy()
    }
  })
})
