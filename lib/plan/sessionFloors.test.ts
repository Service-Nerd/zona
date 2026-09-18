import { describe, it, expect } from 'vitest'
import { sessionFloorsFor } from './sessionFloors'
import { GENERATION_CONFIG } from './generationConfig'

// CB-SUBFLOOR-ADMIT-01 — the resolver, before it is wired to anything.
//
// The claim that makes this safe to ship is the no-op property: for every
// runner the engine already serves, the resolved floors are byte-identical to
// today's config. That claim is asserted here, not assumed.

const CFG = GENERATION_CONFIG.MIN_SESSION_DISTANCE_KM
const ABS = GENERATION_CONFIG.MIN_SESSION_DISTANCE_ABSOLUTE_KM

describe('sessionFloorsFor — the no-op property', () => {
  it('🔴 is EXACTLY today\'s config for anyone at or above the floor', () => {
    // The whole safety argument. If this ever fails, the change has stopped
    // being invisible to the runners the engine already serves.
    for (const longest of [5, 5.1, 6, 8, 10, 14, 20, 32, 42.2, 100]) {
      expect(sessionFloorsFor(longest), `longest=${longest}`).toEqual(CFG)
    }
  })

  it('an unknown longest run returns the configured floors, never a collapsed one', () => {
    // "We do not know" must not read as "this runner can only manage 2 km" —
    // the `?? 0` class this repo has four measured defects from.
    for (const v of [null, undefined, 0, -1, NaN, Infinity] as any[]) {
      expect(sessionFloorsFor(v), String(v)).toEqual(CFG)
    }
  })
})

describe('sessionFloorsFor — the sub-floor runner', () => {
  it('🔴 resolves the long floor to the runner\'s own longest run', () => {
    // This is what lets §45's +10% cap survive: the floor can no longer exceed
    // the distance the cap is expressed against.
    expect(sessionFloorsFor(3).long).toBe(3)
    expect(sessionFloorsFor(4).long).toBe(4)
    expect(sessionFloorsFor(4.5).long).toBe(4.5)
  })

  it('never collapses below the absolute minimum', () => {
    expect(sessionFloorsFor(1).long).toBe(ABS)
    expect(sessionFloorsFor(0.5).long).toBe(ABS)
    expect(ABS).toBeGreaterThan(0)
  })

  it('🔴 the long floor stays §9-longer than the easy floor', () => {
    // ⚠️ THIS TEST PINNED THE WRONG THING ON ITS FIRST WRITE. It asserted the
    // literals `easy === CFG.easy` and `easy === 3` for a 3 km anchor, which is
    // what a `Math.min(cfg.easy, anchor)` implementation produced — and that
    // implementation broke §9: at a 4 km anchor BOTH floors became 4, the long
    // run stopped being the longest run of the week, and
    // INV-PLAN-LONG-IS-LONGEST fired on every week of the T1 charity persona.
    // The RULE is the ratio, so the ratio is what gets asserted.
    const ratio = GENERATION_CONFIG.LONG_RUN_MIN_RATIO_VS_EASY
    for (let longest = ABS; longest <= 8; longest += 0.25) {
      const f = sessionFloorsFor(longest)
      expect(f.long, `longest=${longest}: long floor ${f.long} is not ${ratio}x the easy floor ${f.easy}`)
        .toBeGreaterThanOrEqual(f.easy * ratio - 1e-9)
    }
    // And the easy floor never RISES above the configured one.
    expect(sessionFloorsFor(4.5).easy).toBeLessThanOrEqual(CFG.easy)
  })

  it('quality floors never move — a beginner has no quality to floor (§110)', () => {
    // QUALITY_SESSIONS_PER_WEEK_MAX.beginner = 0, ratified. Lowering a quality
    // floor for a runner who gets no quality would be decorative config.
    const f = sessionFloorsFor(2.5)
    expect(f.quality).toBe(CFG.quality)
    expect(f.secondary_quality).toBe(CFG.secondary_quality)
  })

  it('🔴 the resolved floor always leaves §45\'s cap satisfiable', () => {
    // The defect in one assertion: a floor above `longest × 1.10` makes week one
    // a leap. Swept across the whole sub-floor range.
    const mult = GENERATION_CONFIG.WEEK_1_2_LONG_RUN_CAP_MULTIPLIER
    for (let longest = ABS; longest <= 6; longest += 0.25) {
      const floor = sessionFloorsFor(longest).long
      expect(floor, `longest=${longest}: floor ${floor} exceeds the §45 cap ${longest * mult}`)
        .toBeLessThanOrEqual(longest * mult + 1e-9)
    }
  })
})
