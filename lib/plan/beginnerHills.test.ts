import { describe, it, expect } from 'vitest'
import { cohortGrid, COHORT_PLAN_START } from './cohortGrid'
import { generateRulePlan } from './ruleEngine'
import { GENERATION_CONFIG } from './generationConfig'
import { isHillStrideWeek, neuromuscularNote } from './neuromuscular'
import { resolveLevels } from './fitnessAssessment'
import { validatePlan } from './invariants'
import type { GeneratorInput } from '@/types/plan'

// CB-BEGINNER-HILLS-01 / §28 Amendment 1 — the gate on the hills half.
//
// MEASURED GAP that prompted it: plans containing any hills — beginner 0.0%,
// intermediate 43.7%, experienced 40.5%. Nobody decided beginners should not do
// hills; `hill_reps` is typed `vo2max` in the catalogue and
// QUALITY_SESSIONS_PER_WEEK_MAX.beginner = 0, so hills reached them through no
// path at all.
//
// ⚠️ THE STRIDES HALF OF THE ORIGINAL RULING WAS WITHDRAWN. §28 already gave
// every runner strides (100% of plans, mean 10.1 runs); the submission that
// prompted it measured session `type` and `label` and could not see a
// coach-note prescription. Legislating it would have shipped a no-op.

const HILL = /hill strides/i
const STRIDE = /strides/i

const sample = (pred: (i: any) => boolean, n: number) => {
  const out: any[] = []
  let i = 0
  for (const input of cohortGrid() as any[]) {
    if (i++ % 7 !== 0 || !pred(input)) continue
    out.push(input)
    if (out.length >= n) break
  }
  return out
}

const notesOf = (plan: any): string[] =>
  plan.weeks.flatMap((w: any) =>
    Object.values(w.sessions).flatMap((s: any) => (s?.coach_notes ?? []) as string[]))

describe('§28 Am.1 — beginners get hill strides', () => {
  const beginners = sample(i => i.fitness_level === 'beginner', 12)

  it('the sample is real', () => expect(beginners.length).toBeGreaterThan(5))

  // ▲ SCOPED 2026-11-03 by §28 Am.4's re-sitting, and the universal claim is now the
  // SECOND arm, which is the stronger one. §79's intensity re-entry window collapses the
  // stride run to FLAT for a returning runner, so "every beginner plan" stopped being
  // true — measured over 1,892 level-set beginner plans: **97 lose the hill arm to the
  // collapse** (5.1%), on top of 136 that never had it (short plans, §21 injury bars).
  //
  // ⚠️ THE ARM WAS SCOPED, NOT LOOSENED. What Willy's ruling actually guarantees is
  // *"flat strides, never nothing"*, and that is asserted below on the SAME sample with
  // no exceptions: **0 of 1,892 plans lose their neuromuscular note.**
  it('🔴 every beginner plan carries hill strides, outside §79\'s re-entry window', () => {
    let checked = 0
    for (const input of beginners) {
      const plan = generateRulePlan(input, 'trial', COHORT_PLAN_START, undefined, COHORT_PLAN_START)
      const m = plan.meta as unknown as { intensity_reentry_active?: boolean }
      if (m.intensity_reentry_active === true) continue   // §28 Am.4: collapses to flat
      checked++
      expect(notesOf(plan).some(n => HILL.test(n)), `${input.race_distance_km}km`).toBe(true)
    }
    // The exception must not swallow the sample — an arm that checks nothing is not an arm.
    expect(checked, 'the re-entry exception must not empty this sample').toBeGreaterThan(3)
  })

  it('🩹 FLAT STRIDES, NEVER NOTHING — no beginner plan loses the stimulus', () => {
    // The universal half of §28, and the condition on every collapse arm Am.1–Am.4 adds.
    for (const input of beginners) {
      const plan = generateRulePlan(input, 'trial', COHORT_PLAN_START, undefined, COHORT_PLAN_START)
      expect(notesOf(plan).some(n => STRIDE.test(n)), `${input.race_distance_km}km has no neuromuscular note`)
        .toBe(true)
    }
  })

  it('🔴 it ALTERNATES with strides — never both in one week', () => {
    // The board authorised hills "dosed like §28's strides". A hill run
    // ALONGSIDE the stride run would double the weekly neuromuscular dose.
    for (const input of beginners) {
      const plan = generateRulePlan(input, 'trial', COHORT_PLAN_START, undefined, COHORT_PLAN_START)
      for (const w of plan.weeks) {
        const notes = Object.values(w.sessions).flatMap((s: any) => (s?.coach_notes ?? []) as string[])
        const hill = notes.filter(n => HILL.test(n)).length
        const plain = notes.filter(n => STRIDE.test(n) && !HILL.test(n)).length
        expect(hill + plain, `week ${w.n} carries ${hill + plain} neuromuscular notes`).toBeLessThanOrEqual(1)
      }
    }
  })

  it('🔴 non-beginners are UNCHANGED — they already get real hills', () => {
    // Intermediate and experienced reach hills through the catalogue (43.7% /
    // 40.5%). A second, weaker hill stimulus is not something any seat asked for.
    for (const input of sample(i => i.fitness_level !== 'beginner', 8)) {
      const plan = generateRulePlan(input, 'trial', COHORT_PLAN_START, undefined, COHORT_PLAN_START)
      expect(notesOf(plan).some(n => HILL.test(n)), `${input.fitness_level}`).toBe(false)
    }
  })

  it('🔴 a hill stride NEVER lands on a quality session', () => {
    // §28 Am.1's whole safety argument is that these are coach notes on EASY
    // runs, so QUALITY_SESSIONS_PER_WEEK_MAX (0 for beginners) cannot be
    // breached by construction. This is that argument, asserted.
    for (const input of beginners) {
      const plan = generateRulePlan(input, 'trial', COHORT_PLAN_START, undefined, COHORT_PLAN_START)
      for (const w of plan.weeks) {
        for (const s of Object.values(w.sessions) as any[]) {
          if (!s?.coach_notes?.some((n: string) => STRIDE.test(n))) continue
          expect(s.type, `week ${w.n}: neuromuscular note on a '${s.type}' session`).toBe('easy')
        }
      }
    }
  })

  it('the cadence is config, not written into the logic', () => {
    const n = GENERATION_CONFIG.BEGINNER_HILL_STRIDE_EVERY_N_WEEKS
    const first = GENERATION_CONFIG.STRIDES_FIRST_WEEK
    expect(isHillStrideWeek(first, 'beginner')).toBe(true)
    expect(isHillStrideWeek(first + n, 'beginner')).toBe(true)
    // Widened: `n` is a literal type in config, so a direct `n === 1` is a
    // compile error rather than a runtime check.
    expect(isHillStrideWeek(first + 1, 'beginner')).toBe((n as number) === 1)
    expect(isHillStrideWeek(first, 'intermediate')).toBe(false)
  })

  it('the hill note is not congratulatory and names the recovery', () => {
    const note = neuromuscularNote(GENERATION_CONFIG.STRIDES_FIRST_WEEK, 'beginner')
    expect(note).toMatch(/hill strides/i)
    expect(note, 'a beginner must not read this as a hard session').toMatch(/not a hard session/i)
    expect(note).not.toMatch(/—/)          // no em dash in runner-facing copy
    expect(note).not.toMatch(/!|crush|smash|beast/i)
  })
})

/**
 * §28 Amendment 4 (Coaching Board 2026-11-03, `STRIDE-ASSESSED-LEVEL-01`) — THE SHAPE
 * THE PRODUCT BUILDS.
 *
 * 🔴 EVERY ARM ABOVE SAMPLES `cohortGrid()` FILTERED ON `i.fitness_level === 'beginner'`,
 * AND THE WIZARD NEVER SENDS THAT FIELD. `GeneratePlanScreen` sends the runner's level
 * on `user_declared_level` (§79 — `fitness_level` is the API's structural declaration and
 * would bind peak km). So `isHillStrideWeek`'s `fitnessLevel !== 'beginner'` arm was
 * false for every real runner and the alternation collapsed permanently to flat
 * strides: measured, hill-stride plans **86 of 1,044 level-set → 0 of 1,060
 * production-shaped**, and **0 of 39 live plans against 23 live beginners**.
 *
 * ⚠️ §28 PROPER WAS NEVER AFFECTED — flat strides reach 100% of plans in both shapes,
 * so no runner was ever without neuromuscular stimulus. What was missing is the HILL
 * arm, which ⚕️ Sims noted at the sitting is the osteogenic one, withheld from exactly
 * the low-volume cohort with the most bone to gain.
 *
 * ⚠️ DO NOT PASS A LITERAL LEVEL TO `isHillStrideWeek` IN THIS BLOCK. That is the
 * defect as a test. `levelOf` resolves it the way `generateRulePlan` does.
 */
describe('§28 Am.4 — PRODUCTION SHAPE: hill strides reach a real beginner', () => {
  const START = '2026-11-02'
  /** What the wizard posts: no `fitness_level`, the level on the declaration. */
  const wizard = (over: Record<string, unknown> = {}) => ({
    athlete_name: 'A', age: 34, race_name: 'T', primary_metric: 'distance',
    race_distance_km: 42.2, race_date: '2027-04-18', plan_start: START,
    goal: 'finish', training_age: '6-18mo', user_declared_level: 'beginner',
    resting_hr: 55, max_hr: 185, current_weekly_km: 15, longest_recent_run_km: 8,
    days_available: 4, injury_history: [], hard_session_relationship: 'neutral',
    recent_quality_training: 'none',
    acknowledged_days_warning: true, acknowledged_prep_warning: true, ...over,
  }) as unknown as GeneratorInput
  const levelOf = (i: GeneratorInput) => resolveLevels(i).structural
  const planOf = (i: GeneratorInput) => generateRulePlan(i, 'paid', START, undefined, START)

  it('the premise: no fitness_level, and the level still resolves to beginner', () => {
    const i = wizard()
    expect((i as { fitness_level?: unknown }).fitness_level).toBeUndefined()
    expect(levelOf(i)).toBe('beginner')
  })

  it('🔴 a production-shaped beginner GETS hill strides', () => {
    const notes = notesOf(planOf(wizard()))
    expect(notes.some(n => HILL.test(n))).toBe(true)
    // And flat strides remain — the family alternates, it does not replace (Am.1).
    expect(notes.some(n => STRIDE.test(n) && !HILL.test(n))).toBe(true)
  })

  it('it ALTERNATES, never adds — at most ONE neuromuscular note per week', () => {
    // ⚠️ `hill && flat` WAS THE WEAKER TEST AND CODE REVIEW CAUGHT IT: `2 && 0` is falsy,
    // so two hill notes and no flat note passed. The level-set arm above counts
    // `hill + plain <= 1`; this is the only coverage for the shape the wizard posts, so
    // it must not be weaker than the arm it mirrors.
    for (const w of planOf(wizard()).weeks) {
      const notes = Object.values(w.sessions).flatMap(
        s => ((s as { coach_notes?: unknown[] } | null)?.coach_notes ?? []) as string[])
        .filter((n): n is string => typeof n === 'string')
      const hill = notes.filter(n => HILL.test(n)).length
      const plain = notes.filter(n => STRIDE.test(n) && !HILL.test(n)).length
      expect(hill + plain, `week ${w.n} carries ${hill + plain} neuromuscular notes`)
        .toBeLessThanOrEqual(1)
    }
  })

  it('🩹 §79 RE-ENTRY: a returning runner gets FLAT strides inside the window', () => {
    // §28 Am.4's re-sitting (2026-11-03). §79 withholds the highest tissue-stress quality
    // from a returner because "a returning runner FEELS ready for intervals and hills
    // before the tissue is" — it names hills. Measured when Am.4 first went live: **116 of
    // 4,395** production-shaped plans put a hill stride inside the window; now 0.
    //
    // ⚠️ `INV-PLAN-RETURNING-INTENSITY-REENTRY` CANNOT SEE THIS — it matches catalogue
    // category, and a coach note has none. So the arm lives here, on the plan.
    const returner = wizard({ current_weekly_km: 5, longest_recent_run_km: 3, training_age: '5yr+',
                              race_distance_km: 5, race_date: '2027-02-21', days_available: 3 })
    const p = planOf(returner)
    const m = p.meta as unknown as { intensity_reentry_active?: boolean; intensity_reentry_weeks?: number }
    expect(m.intensity_reentry_active, 'the fixture must actually open the window').toBe(true)
    const win = m.intensity_reentry_weeks ?? 0
    expect(win).toBeGreaterThan(0)
    let inWindow = 0, after = 0
    for (const w of p.weeks) {
      const notes = Object.values(w.sessions).flatMap(
        s => ((s as { coach_notes?: unknown[] } | null)?.coach_notes ?? []) as string[])
        .filter((n): n is string => typeof n === 'string')
      if (!notes.some(n => HILL.test(n))) continue
      if (w.n > 0 && w.n <= win) inWindow++; else after++
      void after
    }
    expect(inWindow, 'no eccentric hill load inside §79\'s re-entry window').toBe(0)
  })

  it('🩹 §21 STILL BARS A HILL-RESTRICTED RUNNER — it collapses to flat, not to nothing', () => {
    // Willy's bound from Am.2, and the half that must not move. The injury guard reads
    // `injury_history`, a field the wizard DOES send, so it was never blind — measured,
    // 0 of 133 newly-hilly plans were injury-barred.
    const knee = notesOf(planOf(wizard({ injury_history: ['knee pain'] })))
    expect(knee.some(n => HILL.test(n))).toBe(false)
    expect(knee.some(n => STRIDE.test(n))).toBe(true)
  })

  it('a runner who is NOT structurally a beginner gets no hills by this route', () => {
    const i = wizard({ current_weekly_km: 45, longest_recent_run_km: 20, training_age: '2-5yr',
                       user_declared_level: 'intermediate' })
    expect(levelOf(i)).not.toBe('beginner')
    expect(notesOf(planOf(i)).some(n => HILL.test(n))).toBe(false)
  })

  it("🔴 the WATCH is on duty: INV-PLAN-BEGINNER-NEUROMUSCULAR's gate opens", () => {
    // It gated on `input.fitness_level` too, so the whole block self-skipped on every
    // real plan. Proven by making it fire: strip the stride notes it looks for.
    const i = wizard()
    const p = planOf(i) as unknown as { weeks: { n: number; sessions: Record<string, unknown> }[] }
    for (const w of p.weeks) {
      for (const s of Object.values(w.sessions)) {
        const sess = s as { coach_notes?: unknown[] } | null
        if (sess?.coach_notes) sess.coach_notes = sess.coach_notes.filter(
          n => !(typeof n === 'string' && STRIDE.test(n)))
      }
    }
    expect(validatePlan(p as never, i).map(v => v.code))
      .toContain('INV-PLAN-BEGINNER-NEUROMUSCULAR')
  })
})
