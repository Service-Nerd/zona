/**
 * §4/§5 — BASE PHASE IS ALL-EASY, and it is the premise a deletion rests on.
 *
 * 🔴 WHY THIS EXISTS (RULEENGINE-HIP-COMMENT-01, 2026-09-25). `CB-HSR-AVOID-01`
 * deleted a hip-flexor rule — "no quality in base" — partly on the argument that
 * it "is unreachable BY DESIGN: base phase carries no quality for anyone
 * (§4/§5)". That argument is correct, and **it was believed rather than
 * measured**, in a commit message, which is not evidence. If it ever stops being
 * true, a deleted safety rule quietly becomes relevant again and nothing would
 * say so.
 *
 * ⚠️ THE FIRST MEASUREMENT SAID 47% AND WAS WRONG — recorded because the error
 * is the interesting part. Counting `type === 'quality' || type === 'hard'`
 * reported 21,532 of 45,776 plans carrying "quality" in a base week, which
 * contradicts §1's flat statement that "base phase is deliberately all-easy" and
 * looked like a large live breach. Split by type, **every one of the 28,084 hits
 * is the 5K time trial** (`type: 'hard'`) — the §-sanctioned deload-week
 * recalibration benchmark, not prescribed quality. **`hard` is not `quality`
 * here, and conflating them manufactures a defect that does not exist.**
 *
 * So the assertion is deliberately narrow: no PRESCRIBED QUALITY session in a
 * base week. The time trial is named and exempted rather than silently excluded,
 * because an exemption nobody can see is how the next person re-derives the same
 * wrong number.
 *
 * Not a `validatePlan` invariant on purpose: an `error` there throws in dev and
 * test, and this premise is measured over the cohort + targeted grids rather
 * than every corpus. A test carries the same guarantee with no production path.
 *
 * ⚠️ SAMPLED BY A COPRIME STRIDE, NOT A SLICE. The full 45,776-plan run takes 78
 * seconds against this project's 30-second `testTimeout`, and raising the
 * timeout for one test is how a suite stops being a gate. A `.slice(0, n)` would
 * be worse than slow: this repo has already recorded three occasions where the
 * debt was the SAMPLE rather than the rules, because a round-robin over a corpus
 * only ever consumes its HEAD. A stride coprime with the array length visits
 * every region of the grid.
 */
import { describe, it, expect } from 'vitest'
import { cohortGrid, targetedGrid, COHORT_PLAN_START, isDesignedRefusal } from './cohortGrid'
import { generateRulePlan } from './ruleEngine'
import type { Session } from '@/types/plan'

/** The only intensity the deload week is allowed to place in base (§ recalibration). */
const BASE_EXEMPT_HARD = new Set(['5K time trial'])

/**
 * Every `stride`-th element, wrapping — so the walk spreads across the whole
 * array instead of taking a prefix. `stride` must be coprime with `length` or
 * the walk revisits a subset; the next prime above the naive ratio always is,
 * except where it divides the length, which the loop's `seen` guard catches.
 */
function coprimeSample<T>(all: readonly T[], target: number): T[] {
  if (all.length <= target) return [...all]
  let stride = Math.max(2, Math.floor(all.length / target))
  const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b))
  while (gcd(stride, all.length) !== 1) stride++
  const out: T[] = []
  for (let i = 0, k = 0; i < target; i++, k = (k + stride) % all.length) out.push(all[k])
  return out
}

/** Tuned against the suite's duration gate: 5,000 plans measured 17.6 s under
 *  contention, over its budget. The premise is structural, so coverage matters
 *  more than volume — hence the stride above and the early-onset floor below. */
const SAMPLE = 1_200

describe('§4/§5 — a base week prescribes no quality session', () => {
  it('holds across the cohort and targeted grids', () => {
    let plans = 0
    let qualityInBase = 0
    let earlyOnset = 0
    const offenders: string[] = []
    const unexpectedHard = new Map<string, number>()

    const corpus = coprimeSample([...cohortGrid(), ...targetedGrid()], SAMPLE)
    for (const input of corpus) {
      let plan
      try { plan = generateRulePlan(input, 'paid', COHORT_PLAN_START) }
      catch (e) { if (isDesignedRefusal(e)) continue; throw e }
      plans++
      if (plan.meta?.early_quality_onset) earlyOnset++

      for (const w of plan.weeks) {
        if (w.phase !== 'base') continue
        // ⚠️ TYPED AS `Session`, NOT CAST TO A RECORD. The first cut used
        // `as Array<Record<string, unknown>>`, which vitest ran happily and `tsc`
        // rejected (TS2352) — the suite was green and the build was not, which is
        // the failure `sendToUser.test.ts` already carries a warning about.
        for (const s of Object.values(w.sessions ?? {}) as Array<Session | undefined>) {
          if (!s) continue
          if (s.type === 'quality') {
            qualityInBase++                                  // counted in full
            if (offenders.length < 5) offenders.push(        // sampled for the message
              `${input.race_distance_km}km ${input.fitness_level} days=${input.days_available} `
              + `cwk=${input.current_weekly_km} w${w.n} -> ${String(s.catalogue_id ?? s.label)}`)
          }
          if (s.type === 'hard') {
            const id = String(s.catalogue_id ?? s.label ?? '?')
            if (!BASE_EXEMPT_HARD.has(id)) unexpectedHard.set(id, (unexpectedHard.get(id) ?? 0) + 1)
          }
        }
      }
    }

    // The corpus must be real — a zero-plan run would pass this vacuously, which
    // is the "comparing nothing" trap verify-parity.ts was built to avoid.
    expect(plans, 'no plans generated — the assertion below would be vacuous').toBeGreaterThan(900)

    // ⚠️ THE COHORT MOST LIKELY TO BREAK THIS MUST BE IN THE SAMPLE. §89/§97's
    // experience-gated onset is what shortens base so quality starts sooner, so
    // it is the mechanism that would put quality in a base week if anything did.
    // It is 6.7% of the grid; a sample that happened to miss it would pass while
    // testing nothing that matters — the "debt was the SAMPLE, not the rules"
    // failure, recorded three times in this repo.
    expect(earlyOnset, 'sample contains no early-onset plans — the riskiest cohort is untested').toBeGreaterThan(20)

    expect(qualityInBase,
      `§4/§5 says base is all-easy, but ${qualityInBase} base week(s) prescribe QUALITY:\n${offenders.join('\n')}\n`
      + 'If this is intended, CB-HSR-AVOID-01 deleted a hip-flexor rule on the premise that it never could be '
      + '— that deletion is now a Coaching Board question.',
    ).toBe(0)

    expect(Object.fromEntries(unexpectedHard),
      'a `hard` session other than the recalibration time trial appeared in a base week — '
      + 'either a new benchmark needs adding to BASE_EXEMPT_HARD, or §4/§5 is breached',
    ).toEqual({})
  })
})
