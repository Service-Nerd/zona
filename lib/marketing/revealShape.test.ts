import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { cohortGrid, COHORT_PLAN_START } from '@/lib/plan/cohortGrid'
import { generateRulePlan } from '@/lib/plan/ruleEngine'
import { planArcSeries } from '@/lib/plan/weekVolume'
import { isDeloadWeekObject } from '@/lib/plan/deloadCadence'
import { firstDipWeek } from '@/components/shared/PlanArc'
import type { GeneratorInput, Plan } from '@/types/plan'

/**
 * DESIGN-REVEAL-SHAPE-01 (Design Board § 6p) — the plan's SHAPE at the moment
 * it arrives, with ONE honest annotation.
 *
 * 🔴 WHAT THE SITTING MEASURED. `PlanArc` rendered on the Plan screen, in
 * `TabbedPhone` and on its own preview page — and NOT on the reveal.
 * `GeneratePlanScreen` imported `PlanHeroMetrics` and never `PlanArc`, so at
 * the one moment the plan arrives the runner met its NUMBERS and never its
 * SHAPE. That is why the second-typeface question could not be answered: there
 * was no chart to annotate.
 *
 * Two constraints are BINDING and both are asserted against real generated
 * plans, not against a fixture:
 *   · the annotated week must genuinely be EASIER than its neighbours —
 *     "easier on purpose" over a week that is not is a false claim about the
 *     plan (DELOAD-OWNER-01, board-binding);
 *   · it must NEVER be the peak — Wood, binding: "no emphasis, no marker, no
 *     colour change at the tallest bar."
 */

/**
 * ⚠️ COMMENTS STRIPPED, and this is the THIRD gate today to need it. The
 * component's own doc comment quotes the annotation to explain it, so
 * `indexOf('easier on purpose')` found the COMMENT and the count assertion
 * read 2. Same class as the S2 gate firing on the prose "Close. Bit of
 * fine-tuning to do." A guard that punishes you for documenting the thing it
 * guards is a guard that gets deleted with the documentation.
 */
const strip = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '')

const ARC = strip(readFileSync(join(process.cwd(), 'components/shared/PlanArc.tsx'), 'utf8'))
const GEN = strip(readFileSync(join(process.cwd(), 'app/dashboard/GeneratePlanScreen.tsx'), 'utf8'))

/**
 * ⚠️ THE PRODUCER ITSELF, NOT A MIRROR — and falsification is what forced this.
 * The first version of this file copied the rule locally, so mutating
 * `PlanArc` to annotate the PEAK left every assertion green: the test was
 * running its own copy. That is the recorded `tierResolution.test.ts` flaw.
 * `firstDipWeek` is now exported and this imports it.
 */
const annotatedWeek = firstDipWeek

describe('DESIGN-REVEAL-SHAPE-01 — the shape, at the moment it arrives', () => {
  it('the reveal renders the arc at all — the defect the sitting found', () => {
    expect(GEN, 'GeneratePlanScreen must render PlanArc').toMatch(/<PlanArc\b/)
    expect(GEN, 'at reveal scale').toMatch(/\breveal\b/)
    expect(ARC, 'and the reveal plot height is a named constant').toMatch(/const PLOT_REVEAL = \d+/)
  })

  it('the annotation is set in Inter — the type rule is not regressed', () => {
    // ⛔ Silvanto's veto is live against a handwriting face arriving quietly.
    // The hand is carried by the drawn rule, not the letterforms.
    const i = ARC.indexOf('easier on purpose')
    expect(i, 'the annotation moved; re-point this assertion').toBeGreaterThan(0)
    const block = ARC.slice(Math.max(0, i - 900), i + 200)
    expect(block, 'the annotation uses the UI font token').toContain("fontFamily: 'var(--font-ui)'")
    expect(ARC, 'no second family may appear').not.toMatch(/font-family:\s*(?!var\()/i)
  })

  it('on REAL plans, the annotated week is always easier than both neighbours', () => {
    // Not a fixture. If the engine's shape changes such that the first dip is
    // not a real dip, this says so.
    let checked = 0
    for (const input of cohortGrid().slice(0, 400)) {
      let plan: Plan
      try { plan = generateRulePlan(input as GeneratorInput, 'trial', COHORT_PLAN_START, undefined, COHORT_PLAN_START) as Plan }
      catch { continue }
      const km = planArcSeries(plan.weeks).km
      const w = annotatedWeek(km)
      if (w == null) continue
      checked++
      expect(km[w - 1], `week ${w} is not lower than week ${w - 1}`).toBeLessThan(km[w - 2])
      expect(km[w - 1], `week ${w} is not lower than week ${w}`).toBeLessThan(km[w])
    }
    expect(checked, 'no plan produced an annotation — the gate would be vacuous').toBeGreaterThan(50)
  })

  it('on REAL plans, the annotated week is NEVER the peak (Wood, binding)', () => {
    let checked = 0
    for (const input of cohortGrid().slice(0, 400)) {
      let plan: Plan
      try { plan = generateRulePlan(input as GeneratorInput, 'trial', COHORT_PLAN_START, undefined, COHORT_PLAN_START) as Plan }
      catch { continue }
      const km = planArcSeries(plan.weeks).km
      const w = annotatedWeek(km)
      if (w == null) continue
      checked++
      expect(km[w - 1], 'the annotation landed on the tallest bar').toBeLessThan(Math.max(...km))
    }
    expect(checked).toBeGreaterThan(50)
  })

  it('exactly ONE annotation, never one per dip', () => {
    // Measured: 2–5 dips per plan, mean 2.8, scattered. Five captions of one
    // sentence is wallpaper (Sierra), and at a 14.1px bar pitch a leader line
    // per dip is not a relationship a reader can see (Silvanto).
    expect(ARC, 'the annotation must not be inside a map over the series')
      .not.toMatch(/weekKm\.map[\s\S]{0,400}easier on purpose/)
    expect(Array.from(ARC.matchAll(/easier on purpose/g)).length).toBe(1)
  })

  it('the deload-week predicate has a single owner now', () => {
    // DELOAD-WEEK-PREDICATE-01 — found while building this.
    expect(isDeloadWeekObject({ type: 'deload' })).toBe(true)
    expect(isDeloadWeekObject({ badge: 'deload' })).toBe(true)
    expect(isDeloadWeekObject({ type: 'build' })).toBe(false)
    expect(isDeloadWeekObject(null)).toBe(false)
  })
})
