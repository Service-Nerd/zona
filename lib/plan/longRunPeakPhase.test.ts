import { describe, it, expect } from 'vitest'
import { generateRulePlan } from './ruleEngine'
import { isLongRun } from './sessionRole'
import { cohortGrid, COHORT_PLAN_START } from './cohortGrid'
import type { GeneratorInput, Plan } from '@/types/plan'

/**
 * LR-NOTE-SCOPE-01 / LR-PEAK-NOT-LONGEST-01 (2026-10-10).
 *
 * 🔴 WHY THIS FILE EXISTS: IT IS THE TRADE THAT RELEASED A HOLD. §80's shortfall
 * note used to open *"Your longest run tops out at X"* while X is the **peak
 * phase's** maximum. The item was deliberately held rather than reworded,
 * because that sentence was **the only visible evidence of its cause** — a plan
 * whose longest run sits outside the peak phase — and silencing a symptom before
 * the cause is understood is how a defect disappears instead of getting fixed.
 *
 * The wording is now correct, so the symptom is gone. This file is what replaces
 * it: the shape defect as a **measured, non-growing baseline**, so it stays
 * visible while the Coaching Board rules on it.
 *
 * ⚠️ AND IT LIVES IN `npm run test` FOR A MEASURED REASON. The obvious home was
 * `planShapeInvariants` I3, which already carries a "peak is the peak" arm — but
 * `audit:plan-shape` is **NOT in `verify:ci`**, so it runs only when somebody
 * types it. A replacement signal that depends on remembering is not a
 * replacement, and this repo records that as equivalent to having no check.
 *
 * 📐 THE POPULATION IS §80's OWN COHORT, AND SCOPING IT WAS THE WHOLE
 * MEASUREMENT. Across 2,872 generated cohort plans the peak phase sits below the
 * plan's long-run maximum on **592 (20.6%)** — but **535 of those are
 * `time_target`**, where §24b/§24c restructure the 5K/10K long run and doctrine
 * says nothing about its size, so most of that 592 is **unruled behaviour rather
 * than a defect**. Baselining 592 would be an alarm nobody could act on. §80's
 * cohort — HM and marathon, goal `finish` — is where the note fires and where
 * the floor is peak-scoped.
 *
 * ⚠️ WHAT THIS DOES NOT CLAIM: doctrine is **SILENT** on whether the peak phase
 * must contain the plan's longest run. §23's overload requirement is weekly
 * VOLUME only; `INV-PLAN-PEAK-IN-PEAK-PHASE` and `planShapeInvariants` I3 both
 * guard km. So this is a watched number, not a rule — which is precisely why it
 * is a baseline here and an open item at the board, not an invariant.
 */

const N = 600

/** §80's cohort: the note only fires for finish-goal HM and marathon. */
const COHORT: GeneratorInput[] = (() => {
  const all = cohortGrid().filter((i: GeneratorInput) =>
    (i.race_distance_km === 21.1 || i.race_distance_km === 42.2) && i.goal === 'finish')
  const STRIDE = 7919   // coprime with the grid length, so the sample is spread
  return Array.from({ length: N }, (_, k) => all[(k * STRIDE) % all.length])
})()

/** Long-run maximum per phase, plus where the plan's overall maximum sits. */
function longRunShape(plan: Plan): { byPhase: Record<string, number>; max: number; maxPhase: string } {
  const byPhase: Record<string, number> = {}
  let max = 0, maxPhase = ''
  for (const w of plan.weeks) {
    if ((w.n ?? 0) < 1 || w.type === 'race') continue
    // A week with no phase cannot be attributed to one, and silently bucketing it
    // under '' would make the peak comparison read against a phantom phase.
    const phase = w.phase
    if (!phase) continue
    for (const s of Object.values(w.sessions ?? {})) {
      if (!s || !isLongRun(s)) continue
      const mins = s.duration_mins ?? 0
      byPhase[phase] = Math.max(byPhase[phase] ?? 0, mins)
      if (mins > max) { max = mins; maxPhase = phase }
    }
  }
  return { byPhase, max, maxPhase }
}

/** +1 absorbs whole-minute rounding, matching the engine's own write-back. */
const isInverted = (sh: ReturnType<typeof longRunShape>) =>
  (sh.byPhase['peak'] ?? 0) > 0 && sh.max > (sh.byPhase['peak'] ?? 0) + 1

interface Measured { generated: number; inverted: number; phases: Record<string, number> }

const measured: Measured = (() => {
  let generated = 0, inverted = 0
  const phases: Record<string, number> = {}
  for (const input of COHORT) {
    let plan: Plan
    try { plan = generateRulePlan(input, 'paid', COHORT_PLAN_START) } catch { continue }
    generated++
    const sh = longRunShape(plan)
    if (isInverted(sh)) { inverted++; phases[sh.maxPhase] = (phases[sh.maxPhase] ?? 0) + 1 }
  }
  return { generated, inverted, phases }
})()

/**
 * 📐 MEASURED 2026-10-10 on the sample above: 600 generated, **15 inverted
 * (2.5%), every one of them in the BUILD phase.** The baseline may FALL, never
 * rise. Lower it in the commit that improves it; raise it only with a declared
 * reason, exactly as `cohort:shape` and `measure:fitness` require.
 */
const INVERTED_BASELINE = 15

describe('LR-PEAK-NOT-LONGEST-01 — the peak phase vs the plan\'s longest run, watched', () => {
  it('the population is real — a gate over nothing is not a gate', () => {
    expect(COHORT.length).toBe(N)
    expect(measured.generated, '§80\'s cohort stopped generating').toBeGreaterThan(N * 0.9)
  })

  it('🔴 the inversion count does not GROW', () => {
    expect(
      measured.inverted,
      `${measured.inverted} of ${measured.generated} plans put the long-run maximum outside the `
      + `peak phase (${JSON.stringify(measured.phases)}). Baseline ${INVERTED_BASELINE}. `
      + 'If this rose, a change moved the long-run curve; if it fell, lower the baseline in '
      + 'the same commit. Doctrine is SILENT on whether this is wrong — see LR-PEAK-NOT-LONGEST-01.',
    ).toBeLessThanOrEqual(INVERTED_BASELINE)
  })

  it('the detector can actually SEE an inversion — vacuity', () => {
    // Without this, a `longRunShape` that always returns zeros passes the arm
    // above forever. The repo has shipped a green tick with nothing behind it.
    const synthetic = {
      weeks: [
        { n: 1, phase: 'build', type: 'normal', sessions: { sun: { id: 'a', type: 'easy', role: 'long_run', duration_mins: 180 } } },
        { n: 2, phase: 'peak',  type: 'normal', sessions: { sun: { id: 'b', type: 'easy', role: 'long_run', duration_mins: 120 } } },
      ],
    } as unknown as Plan
    const sh = longRunShape(synthetic)
    expect(sh.maxPhase).toBe('build')
    expect(isInverted(sh), 'a 180-min build long run against a 120-min peak must register').toBe(true)
    // And the clean direction must NOT register.
    const ok = {
      weeks: [
        { n: 1, phase: 'build', type: 'normal', sessions: { sun: { id: 'a', type: 'easy', role: 'long_run', duration_mins: 120 } } },
        { n: 2, phase: 'peak',  type: 'normal', sessions: { sun: { id: 'b', type: 'easy', role: 'long_run', duration_mins: 180 } } },
      ],
    } as unknown as Plan
    expect(isInverted(longRunShape(ok))).toBe(false)
  })
})

describe('LR-NOTE-SCOPE-01 — the note states the scope §80 actually has', () => {
  // ⚠️ MEASURED ON GENERATED OUTPUT, NOT A FIXTURE. The two files that carried
  // this sentence literally (`lrShortfallCause.test.ts`, `invariantLiveness.ts`)
  // are HAND-WRITTEN, so they stayed green through the change — a fixture that
  // does not track its producer cannot catch the producer drifting.
  const noted = (() => {
    for (const input of COHORT) {
      let plan: Plan
      try { plan = generateRulePlan(input, 'paid', COHORT_PLAN_START) } catch { continue }
      const note = (plan.meta as unknown as Record<string, unknown>).long_run_shortfall_note
      if (typeof note === 'string' && note.length > 0) return { plan, note }
    }
    return null
  })()

  it('the cohort actually produces the note — otherwise the arms below are vacuous', () => {
    expect(noted, 'no §80 shortfall note in 600 plans; this suite would assert nothing').not.toBeNull()
  })

  it('🔴 it says "in the peak weeks", because the number IS the peak phase\'s', () => {
    expect(noted!.note).toMatch(/Your longest run in the peak weeks tops out at/)
    expect(noted!.note, 'the unqualified claim is what lied').not.toMatch(/^Your longest run tops out at/)
  })

  it('🔴 and the figure it prints is the PEAK-phase maximum, not the plan\'s', () => {
    // The claim and the computation, reconciled on real output. §80 is
    // peak-scoped by design, so this is the agreement that had never been
    // asserted — and the one whose absence let the sentence drift.
    const sh = longRunShape(noted!.plan)
    const m = noted!.note.match(/tops out at (?:(\d+)h(?: (\d{2}))?|(\d+) min)\./)
    expect(m, `could not parse the duration out of: ${noted!.note.slice(0, 90)}`).not.toBeNull()
    const printed = m![3] ? Number(m![3]) : Number(m![1]) * 60 + Number(m![2] ?? 0)
    expect(printed).toBe(sh.byPhase['peak'] ?? 0)
  })
})
