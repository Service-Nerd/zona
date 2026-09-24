/**
 * PLAN-VO2MAX-BAND-01 — the band predicate must agree with the GENERATOR.
 *
 * 🔴 THE INCIDENT, ON LIVE DATA. `applyHrToPlan` shipped 2026-09-24 deciding the
 * HR band from `session.type === 'quality'`. The generator decides it from the
 * session's CATALOGUE CATEGORY (`isVo2max` = `category === 'vo2max'`,
 * `ruleEngine.ts:1497`, taking `intervalsZone`/`intervalsHR` at 1806–1813).
 * **Every VO2max session carries `type: 'quality'`** — the type is the slot, the
 * category is the stimulus — so the two classifiers disagreed on exactly that
 * set. Running the backfill rewrote plan `8a2858ab` weeks 5 and 9 from
 * **"Zone 4–5" 157–182 bpm to "Zone 3" 145–156 bpm**: a VO2max session
 * downgraded to threshold, header and coach note moved together so the card
 * looked consistent and wrong. 12 more live sessions were one run from the same.
 *
 * ⚠️ WHAT WAS GREEN THE WHOLE TIME: six unit tests, two mutation kills,
 * `verify:parity` IDENTICAL over 5,994 cases, and the full suite. The unit
 * fixture is a 5K beginner plan with **no VO2max session in it**, and the parity
 * grid never calls `applyHrToPlan` at all.
 *
 * 🥇 SO THIS TEST IS NOT ANOTHER UNIT TEST. It runs the predicate BESIDE the
 * producer across generated plans and asserts they never disagree. A classifier
 * can only be proven against the thing it is a copy of.
 */
import { describe, it, expect } from 'vitest'
import { generateRulePlan } from './ruleEngine'
import { computeZones } from './zones'
import { hrBandFor } from './hrBand'
import { cohortGrid, COHORT_PLAN_START } from './cohortGrid'
import type { GeneratorInput, Plan } from '@/types/plan'

/** A spread of the grid — coprime stride, so it is not just the head. */
const STRIDE = 7919
function sample(n: number): GeneratorInput[] {
  const xs = cohortGrid()
  return Array.from({ length: Math.min(n, xs.length) }, (_, i) => xs[(i * STRIDE) % xs.length])
}

interface Seen { plans: number; sessions: number; byBand: Record<string, number>; disagreements: string[] }

function walk(inputs: GeneratorInput[]): Seen {
  const out: Seen = { plans: 0, sessions: 0, byBand: {}, disagreements: [] }
  for (const input of inputs) {
    let plan: Plan
    try { plan = generateRulePlan(input, 'paid', COHORT_PLAN_START) } catch { continue }
    out.plans++
    const mhr = plan.meta?.max_hr
    if (typeof mhr !== 'number' || mhr <= 0) continue
    const z = computeZones(mhr, plan.meta?.resting_hr)
    // What the generator ACTUALLY wrote, keyed by the band it implies.
    const written: Record<string, { zone?: string; hr: string }> = {
      quality:   { zone: z.qualityZone,   hr: z.qualityHR },
      intervals: { zone: z.intervalsZone, hr: z.intervalsHR },
      shakeout:  { hr: z.shakeoutHR },
      easy:      { hr: z.easyHR },
    }
    for (const w of plan.weeks) {
      for (const [day, s] of Object.entries(w.sessions)) {
        if (!s || typeof s.hr_target !== 'string') continue
        out.sessions++
        const band = hrBandFor(s as never)
        if (band === null) continue          // "leave alone" — never an assertion
        out.byBand[band] = (out.byBand[band] ?? 0) + 1
        const expect_ = written[band]
        if (s.hr_target !== expect_.hr || (expect_.zone !== undefined && s.zone !== undefined && s.zone !== expect_.zone)) {
          out.disagreements.push(
            `${input.race_distance_km}km/${input.fitness_level} w${w.n} ${day} type=${s.type} `
            + `catalogue_id=${(s as { catalogue_id?: string }).catalogue_id ?? '(none)'} `
            + `predicted=${band} -> "${expect_.zone ?? '(no zone)'}" ${expect_.hr}   `
            + `generator wrote "${s.zone}" ${s.hr_target}`)
        }
      }
    }
  }
  return out
}

describe('PLAN-VO2MAX-BAND-01 — hrBandFor agrees with the generator', () => {
  const seen = walk(sample(400))

  it('the corpus actually REACHES the band that broke — a VO2max session', () => {
    // ⚠️ THE ASSERTION THAT MAKES THE REST MEAN ANYTHING. The unit suite passed
    // this bug because its one fixture had no VO2max session. If the corpus
    // stops producing intervals-band sessions, the agreement check below is
    // vacuously green and must fail loudly instead.
    expect(seen.plans).toBeGreaterThan(300)
    expect(seen.byBand.intervals ?? 0).toBeGreaterThan(0)
    expect(seen.byBand.quality ?? 0).toBeGreaterThan(0)
    expect(seen.byBand.easy ?? 0).toBeGreaterThan(0)
  })

  it('never disagrees with what the generator wrote', () => {
    expect(seen.disagreements.slice(0, 5)).toEqual([])
    expect(seen.disagreements).toHaveLength(0)
  })

  it('REPRODUCES THE BUG: a VO2max session is typed quality and takes the INTERVALS band', () => {
    // The exact confusion, pinned so nobody "simplifies" hrBandFor back to type.
    // ⚠️ REAL catalogue ids, read from the product, never invented. The first
    // cut of this test used `vo2max_intervals`, which does not exist, so it
    // asserted a null it had created itself.
    for (const id of ['intervals_classic', 'intervals_short', 'intervals_long', 'intervals_30_30']) {
      const vo2 = { type: 'quality', catalogue_id: id, hr_target: '164–189 bpm' }
      expect(vo2.type, `${id} is a quality-typed session`).toBe('quality')
      expect(hrBandFor(vo2), `${id} must take the intervals band`).toBe('intervals')
    }
    // …and a threshold row in the same shape does NOT.
    expect(hrBandFor({ type: 'quality', catalogue_id: 'tempo_continuous', hr_target: '150–163 bpm' }))
      .toBe('quality')
  })

  it('an unresolvable row returns null — a caller must leave it alone', () => {
    // Guessing "probably quality" here is what downgraded a live session.
    expect(hrBandFor({ type: 'quality', label: 'Some plan from April', hr_target: '150–163 bpm' })).toBeNull()
    expect(hrBandFor({ type: 'quality', hr_target: '150–163 bpm' })).toBeNull()
  })

  it('a session with no hr_target never acquires one', () => {
    expect(hrBandFor({ type: 'quality', catalogue_id: 'intervals_classic' })).toBeNull()
    expect(hrBandFor({ type: 'rest' })).toBeNull()
    expect(hrBandFor(null)).toBeNull()
    expect(hrBandFor(undefined)).toBeNull()
  })
})
