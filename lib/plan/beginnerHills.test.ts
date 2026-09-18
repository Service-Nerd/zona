import { describe, it, expect } from 'vitest'
import { cohortGrid, COHORT_PLAN_START } from './cohortGrid'
import { generateRulePlan } from './ruleEngine'
import { GENERATION_CONFIG } from './generationConfig'
import { isHillStrideWeek, neuromuscularNote } from './neuromuscular'

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

  it('🔴 every beginner plan carries hill strides', () => {
    for (const input of beginners) {
      const plan = generateRulePlan(input, 'trial', COHORT_PLAN_START, undefined, COHORT_PLAN_START)
      expect(notesOf(plan).some(n => HILL.test(n)), `${input.race_distance_km}km`).toBe(true)
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
