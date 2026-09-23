// REFUSAL-COHERENCE-01 — a refusal may never tell a runner to reach a number
// they have already reached.
//
// 🔴 THE DEFECT. §117 Am.2's adequacy throw reused `baseVolumeRefusal`, whose
// sentence is computed from the §111 RATIO. At the adequacy site that ratio has
// NOT been exceeded, so `minBaseKm = ceil(peak / 4)` is derived from a peak
// nothing objected to, and lands BELOW the runner's own volume:
//
//     "8 km a week is too low ... Get to about 7 km a week first."   ratio 3.13, cap 4.0
//
// Measured before the fix: 208 refusals, 11.1% of every BaseVolumeError in the
// marathon envelope, and all 208 were the same runner — 8 km/week, 4 km longest
// run, at every runway from 12 to 30 weeks and every day count.
//
// ⚠️ THIS ASSERTS THE PROPERTY, NOT THE MECHANISM. It does not check which
// builder ran or what the sentence says. It checks the only thing a runner
// experiences: that the target named is above where they already are. A test
// that asserted `cause === 'runwalk-inadequate'` would pass just as well on a
// message that still contained the impossible number.

import { describe, it, expect } from 'vitest'
import { distanceEnvelope } from './useCaseEnvelope'
import { generateRulePlan } from './ruleEngine'
import { isDesignedRefusal } from './designedRefusal'
import { REFUSAL_NAMES_NEXT_STEP } from './envelopeMeasure'

interface Bad { cwk: number; min: number; msg: string }

/** Every designed refusal the marathon + ultra envelopes produce. Sampled with
 *  a coprime stride so the walk spreads across the grid rather than consuming
 *  its head — the corpus-reach failure recorded three times in this repo. */
function sweepRefusals(distanceKm: number, stride: number) {
  const incoherent: Bad[] = []
  const noNextStep: string[] = []
  let refusals = 0
  const cases = distanceEnvelope(distanceKm).filter((_, i) => i % stride === 0)
  for (const c of cases) {
    try { generateRulePlan(c.input, 'paid'); continue } catch (e) {
      if (!isDesignedRefusal(e)) continue
      const err = e as Error & { base?: { current_weekly_km: number; min_base_km: number } }
      refusals++
      if (!REFUSAL_NAMES_NEXT_STEP.test(err.message)) noNextStep.push(err.message)
      const b = err.base
      if (!b) continue
      // The sentence a BaseVolumeError renders names `min_base_km` as the
      // target. If the runner already meets it, the sentence is impossible.
      if (b.min_base_km <= b.current_weekly_km && /get to about/i.test(err.message)) {
        incoherent.push({ cwk: b.current_weekly_km, min: b.min_base_km, msg: err.message })
      }
    }
  }
  return { refusals, incoherent, noNextStep, examined: cases.length }
}

describe('REFUSAL-COHERENCE-01 — no refusal names a target the runner already meets', () => {
  it('marathon: every refusal names a reachable next step', () => {
    const r = sweepRefusals(42.2, 13)
    expect(r.refusals, `no refusal was reached in ${r.examined} cases; this proves nothing`)
      .toBeGreaterThan(0)
    expect(
      r.incoherent.map(b => `at ${b.cwk} km/wk told to reach ${b.min} km — "${b.msg}"`),
      `${r.incoherent.length} of ${r.refusals} marathon refusals name a base the runner already exceeds`,
    ).toEqual([])
  })

  it('marathon: §44 — every refusal still names a next step', () => {
    const r = sweepRefusals(42.2, 13)
    expect(r.noNextStep, 'refusal(s) with no route back').toEqual([])
  })

  // ⚠️ THE ULTRAS ARE ASSERTED EMPTY, NOT SKIPPED.
  // A first draft swept 50K for coherence and the reach assertion failed: it
  // refuses NOBODY, so the arm proved nothing. Dropping it would lose the
  // signal entirely. Asserting the measured state instead means that if an
  // ultra ever starts refusing, THIS test says so — and coherence there becomes
  // a question someone has to answer rather than one nobody asked.
  for (const [dist, name] of [[50, '50K'], [100, '100K']] as const) {
    it(`${name}: refuses nobody today, so there is no refusal to be incoherent`, () => {
      const r = sweepRefusals(dist, 13)
      expect(r.examined, 'the envelope returned no cases').toBeGreaterThan(0)
      expect(r.refusals,
        `${name} now refuses ${r.refusals} case(s). That is a change worth knowing about, ` +
        `and those refusals need the coherence check the marathon arm applies.`).toBe(0)
    })
  }
})

// ── Falsification. A guard that cannot go red is decoration. ────────────────
describe('the guard can fail', () => {
  it('catches the exact sentence the defect produced', () => {
    // The real pre-fix string, reconstructed. If the classifier stops flagging
    // this, the guard has gone blind and the defect can return unnoticed.
    const msg = '8 km a week is too low to build safely to a marathon yet. Get to about 7 km a week first.'
    const b = { current_weekly_km: 8, min_base_km: 7 }
    const flagged = b.min_base_km <= b.current_weekly_km && /get to about/i.test(msg)
    expect(flagged).toBe(true)
  })

  it('does NOT flag a coherent refusal', () => {
    const msg = '4 km a week is too low to build safely to a marathon yet. Get to about 12 km a week first.'
    const b = { current_weekly_km: 4, min_base_km: 12 }
    const flagged = b.min_base_km <= b.current_weekly_km && /get to about/i.test(msg)
    expect(flagged).toBe(false)
  })
})
