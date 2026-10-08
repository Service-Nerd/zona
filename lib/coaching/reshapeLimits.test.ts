// §124 + §2 Am.5 + §109 Am.1 — the reshape engine's own limits, mechanically.
//
// Coaching Board, 2026-10-08, `RESHAPE-PRINCIPLE-DEBT-01` — CORRECT WITH AMENDMENT (3).
// Six live numerics decided whether a real runner's plan is rewritten and **none of them
// had a written reason**, because they live in `lib/coaching/constants.ts` and the
// principle gate reached that file through two hand-named exports.
//
// ⚠️ WHAT THIS CAN AND CANNOT CHECK. A threshold's VALUE is a coaching judgement and no
// test can validate it — that is what the board is for. What a test can hold is the
// RELATIONSHIPS the board reasoned from, and those are real claims that can break:
// -8 must stay the most conservative trigger, the cap must stay small, the display floors
// must stay floors. Declared rather than implied, per the completion-claim rule.
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  EF_DECLINE_THRESHOLD_PCT, EF_BASELINE_WINDOW, MAX_ADJUSTMENTS_PER_WEEK,
  SHADOW_LOAD_THRESHOLD_PCT, ZONE_BLOCK_VERDICT_MIN_RUNS,
  TREND_PACE_CONFOUND_SEC_PER_KM, SCORE_WEIGHTS, LOAD_RATIO,
} from './constants'
import { GENERATION_CONFIG } from '@/lib/plan/generationConfig'

const PRINCIPLES = readFileSync(join(process.cwd(), 'docs/canonical/CoachingPrinciples.md'), 'utf8')

describe('§124 — a reshape must be rare', () => {
  it('🎯 the per-week cap stays small, because a plan that moves often is not a plan', () => {
    // McMillan: "a coaching limit, not a politeness limit, and a coach would set it lower
    // if anything." The third change means the runner is no longer following a plan, they
    // are receiving instructions.
    expect(MAX_ADJUSTMENTS_PER_WEEK).toBeGreaterThanOrEqual(1)
    expect(MAX_ADJUSTMENTS_PER_WEEK).toBeLessThanOrEqual(2)
  })

  it('…and the production record that argued for it is on the page', () => {
    // 18 adjustments all time; the only real detection fired 3 times and was reverted 3
    // times. If that paragraph goes, the number loses the evidence it was set against.
    expect(PRINCIPLES).toMatch(/reverted all three/i)
  })
})

describe('§124 — EF is the most conservative trigger, and that ORDER is the claim', () => {
  it('🔴 the EF trigger is a DECLINE, not a rise', () => {
    // A positive value here would make improving efficiency trim the plan.
    expect(EF_DECLINE_THRESHOLD_PCT).toBeLessThan(0)
  })

  it('🥇 it sits outside the noise, which is why -5 was refused', () => {
    // Seiler, on the record: -5% "would fire on measurement drift". The board set a floor,
    // not a physiological boundary, and this arm is that floor.
    expect(Math.abs(EF_DECLINE_THRESHOLD_PCT)).toBeGreaterThanOrEqual(8)
  })

  it('🥇 §108 ranks EF the NOISIEST axis, and the trigger must stay consistent with that', () => {
    // The board's whole argument: a noisy score axis is diluted by three others; a noisy
    // TRIGGER acts alone. So EF carrying the smallest score weight is the premise, and if
    // that ever stops being true this reasoning needs re-opening.
    const weights = Object.values(SCORE_WEIGHTS) as number[]
    expect(SCORE_WEIGHTS.ef).toBe(Math.min(...weights))
  })

  it('⚠️ the baseline is an ACTIVITY COUNT and the asymmetry is DECLARED, not hidden', () => {
    // The comment used to say "4-week rolling avg" while the code took 6 activities.
    // Hutchinson refused to ratify a number whose window he could not name.
    expect(EF_BASELINE_WINDOW).toBeGreaterThanOrEqual(3)
    expect(PRINCIPLES).toMatch(/6 ACTIVITIES/)
    expect(PRINCIPLES).toMatch(/the same threshold means two different things to\s+two/i)
    // 🔴 And the false comment must not come back.
    const SRC = readFileSync(join(process.cwd(), 'lib/coaching/constants.ts'), 'utf8')
    expect(SRC).not.toMatch(/EF_DECLINE_THRESHOLD_PCT = -8\s*\/\/.*4-week/)
  })

  it('…and it can never hold a single activity, which is why it is a count', () => {
    // A time-boxed window on a sparse week could compare a runner against one day.
    expect(EF_BASELINE_WINDOW).toBeGreaterThan(1)
  })
})

describe('§2 Am.5 — shadow load is a THIRD 15, and is not required to track the others', () => {
  it('the threshold is above measurement noise and below a whole extra session', () => {
    expect(SHADOW_LOAD_THRESHOLD_PCT).toBeGreaterThan(5)
    expect(SHADOW_LOAD_THRESHOLD_PCT).toBeLessThanOrEqual(20)
  })

  it('🔴 ADR-012’s 15 is tied to LOAD_RATIO, and the independence is the ruling', () => {
    // ADR-012's own note: its thresholds "mirror the existing LOAD_RATIO.watch trim so the
    // engine's two magnitudes agree". That is a DECLARED coupling. Shadow load's 15 has a
    // different reason and the board ruled they need not move together — so this arm
    // asserts the reasons exist, NOT that the numbers match. If a later change makes them
    // equal by coincidence again, the principle still says which one you are changing.
    expect(GENERATION_CONFIG.RESHAPE_AUTOAPPLY_THRESHOLDS.WEEK_VOLUME_PCT_THRESHOLD).toBeDefined()
    expect(LOAD_RATIO.watch).toBeGreaterThan(1)
    expect(PRINCIPLES).toMatch(/NOT ADR-012's 15/)
    expect(PRINCIPLES).toMatch(/not required to move\s+together/i)
  })

  it('🩹 Willy’s clause is on the record: this flag must not trim the week', () => {
    // §2 Am.4 clause 2 already forbids it. The standing temptation is to "fix" that.
    expect(PRINCIPLES).toMatch(/must not silently shrink the\s+next week/i)
  })
})

describe('§109 Am.1 — the two display floors stay floors', () => {
  it('a block verdict needs a PATTERN, not two points', () => {
    expect(ZONE_BLOCK_VERDICT_MIN_RUNS).toBeGreaterThanOrEqual(3)
  })

  it('a pace change inside the confound is not reported', () => {
    // No GPS route, no per-segment elevation, no cadence, no temperature (ADR-011).
    expect(TREND_PACE_CONFOUND_SEC_PER_KM).toBeGreaterThanOrEqual(10)
  })

  it('⚠️ and they are DISPLAY floors — neither may become a prescription', () => {
    // They decide whether a sentence may be written, which is why they sit under §109.
    expect(PRINCIPLES).toMatch(/display floors, not\s+prescription/i)
  })
})

describe('⚕️ Sims’ clause is mandatory and must stay written', () => {
  it('🔴 a decline we cannot explain is not a decline we have diagnosed', () => {
    // Every trigger here is a decline detector, and the pattern is also how low energy
    // availability presents. The engine reduces load, which is right by accident. It must
    // never state a cause.
    expect(PRINCIPLES).toMatch(/A decline we cannot explain is not a decline we have\s+diagnosed/)
    // ⚠️ `\s+` not a space: the constitution is hard-wrapped at ~90 chars, so this
    // sentence spans two lines and a literal-space regex found nothing. Asserting on
    // prose means assuming nothing about where the line breaks fall.
    expect(PRINCIPLES).toMatch(/may not tell the runner why their\s+efficiency\s+fell/i)
  })
})

describe('the confidence is STATED, because the field evidence is near zero', () => {
  it('🔴 every new section records LOW confidence rather than implying certainty', () => {
    // The engine was dead 104 days; `shadow_load` and `ef_decline` have NEVER fired. A
    // principle that reads as settled science would be the overclaim Hutchinson guards
    // against — so the words have to be there, and this arm keeps them there.
    const matches = PRINCIPLES.match(/Confidence: LOW/g) ?? []
    expect(matches.length).toBeGreaterThanOrEqual(2)
    expect(PRINCIPLES).toMatch(/reasoned, not observed|awaiting their first evidence/i)
  })
})
