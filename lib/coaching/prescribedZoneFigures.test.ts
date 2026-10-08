// §123 — the gate for prescription-relative HR figures.
//
// Behavioural, on the real histogram from the founder's own production row and the real
// `derived_set` shape from the live plans. ⚠️ The fixture values are MEASURED, not
// plausible: `z1=3.23 z2=25.81 z3=32.26 z4_5=38.71` is his 2026-10-07 week-3 Wednesday
// progressive tempo, and `ceiling / Z2-Z3 / target` is what that catalogue row's steps
// actually say across all 30 live plans.
import { describe, it, expect } from 'vitest'
import {
  prescribedZoneFigures, prescribedZonesFor, zoneKeysFromLabel,
} from './prescribedZoneFigures'

/** The founder's run, verbatim from `run_analysis`. */
const FOUNDERS_HISTOGRAM = { z1: 3.23, z2: 25.81, z3: 32.26, z4_5: 38.71 }

/** What `progressive_tempo` actually emits: three steps, three different targets. */
const PROGRESSIVE_TEMPO = {
  type: 'quality',
  zone: 'Zone 3',
  derived_set: {
    blocks: [{
      steps: [
        { pace_mode: 'ceiling' },   // opening third at the EASY ceiling
        { zone: 'Z2-Z3' },          // the transition third
        { pace_mode: 'target' },    // the threshold finish
      ],
    }],
  },
}

/** A v1 easy run: no `derived_set` at all. Must be untouched by all of this. */
const EASY_RUN = { type: 'easy', zone: 'Zone 2' }

const NO_HISTOGRAM = { z1: null, z2: null, z3: null, z4_5: null }
const LEGACY = { hrInZonePct: 11, hrAboveCeilingPct: 22, hrBelowFloorPct: 33 }

describe('zoneKeysFromLabel', () => {
  it('reads a single zone', () => {
    // Z1 explicitly: the character class /[1-5]/ must reach its lower bound.
    expect(zoneKeysFromLabel('Z1')).toEqual(['z1'])
    expect(zoneKeysFromLabel('Z2')).toEqual(['z2'])
    expect(zoneKeysFromLabel('Zone 3')).toEqual(['z3'])
  })

  // 🔴 The trap: "4-5" is ONE histogram bucket, not the range 4 to 5. Matched first, or
  // the range split consumes it and the bucket is lost.
  it('treats Z4-5 as one bucket, with either dash', () => {
    expect(zoneKeysFromLabel('Z4-5')).toEqual(['z4_5'])
    expect(zoneKeysFromLabel('Zone 4–5')).toEqual(['z4_5'])
  })

  it('expands a RANGE to every bucket it spans', () => {
    // The vocabulary already exists in live data: `mp_long_run` declares "Zone 2–3".
    expect(zoneKeysFromLabel('Z2-Z3')).toEqual(['z2', 'z3'])
    expect(zoneKeysFromLabel('Zone 2–3')).toEqual(['z2', 'z3'])
  })

  // 🔴 THE FOUR ARMS THE MUTATION HARNESS DEMANDED. `npx tsx scripts/test-liveness.ts`
  // killed only 3 of 8 mutations on this module first time: the suite looked thorough
  // and never distinguished `n >= 4` from `n > 4`, `=== 'string'` from `!==`, `i >= 0`
  // from `i > 0`, or the dedup `&&` from `||`. Each one below kills a specific survivor.
  it('Z4 alone is the top bucket — kills `n >= 4` vs `n > 4`', () => {
    expect(zoneKeysFromLabel('Z4')).toEqual(['z4_5'])
    expect(zoneKeysFromLabel('Zone 5')).toEqual(['z4_5'])
  })

  it('a repeated zone is deduplicated — kills the `&&` in the dedup guard', () => {
    expect(zoneKeysFromLabel('Z2-Z2')).toEqual(['z2'])
    expect(zoneKeysFromLabel('Zone 3 to Zone 3')).toEqual(['z3'])
  })

  it('returns nothing for a label naming no zone', () => {
    expect(zoneKeysFromLabel('Race effort')).toEqual([])
    expect(zoneKeysFromLabel(undefined)).toEqual([])
  })
})

describe('prescribedZonesFor — the structure, not the type', () => {
  it('🔴 a progressive tempo prescribes THREE bands, where its type names one', () => {
    const zones = prescribedZonesFor(PROGRESSIVE_TEMPO)!
    // CLAUDE.md § TypeScript: a Set spread fails this tsconfig target. Array.from.
    expect(Array.from(zones).sort()).toEqual(['z2', 'z3'])
    // Z3 from the type and the transition step; Z2 from BOTH the transition range and
    // the `ceiling` opening step. The opening third is in prescription, not below it.
    expect(zones.has('z2')).toBe(true)
  })

  it('an easy run is unchanged — one band, from its type', () => {
    expect(Array.from(prescribedZonesFor(EASY_RUN)!)).toEqual(['z2'])
  })

  it('a `ceiling` step alone adds the easy band — Sims and McMillan reduce to this line', () => {
    // An interval session's recovery jog is PRESCRIBED out of the work band.
    const intervals = {
      type: 'intervals', zone: 'Zone 4–5',
      derived_set: { blocks: [{ steps: [{ pace_mode: 'target' }, { pace_mode: 'ceiling' }] }] },
    }
    const zones = prescribedZonesFor(intervals)!
    expect(zones.has('z4_5')).toBe(true)
    expect(zones.has('z2')).toBe(true)
  })

  it('a step with NO zone is ignored rather than crashing — kills `=== \'string\'` vs `!==`', () => {
    // A `target`/`ceiling` step carries no `zone` at all, which is the common case.
    const s = {
      type: 'quality', zone: 'Zone 3',
      derived_set: { blocks: [{ steps: [{ pace_mode: 'target' }, { zone: undefined }, {}] }] },
    }
    // Only Z3, from the type. No step contributed a zone, and nothing threw.
    expect(Array.from(prescribedZonesFor(s)!)).toEqual(['z3'])
  })

  it('a step\u2019s STRING zone is the only source of its second band \u2014 kills `=== \'string\'`', () => {
    // 🔴 The previous arm could not kill this mutation: the progressive tempo gets z2
    // from its `ceiling` step as well, so skipping string zones changed nothing. Here
    // the step zone is the ONLY route to z2 — no ceiling step, and `session.zone`
    // names one band — so flipping the check drops a prescribed band outright.
    const s = {
      type: 'quality', zone: 'Zone 3',
      derived_set: { blocks: [{ steps: [{ zone: 'Z2' }, { pace_mode: 'target' }] }] },
    }
    expect(Array.from(prescribedZonesFor(s)!).sort()).toEqual(['z2', 'z3'])
  })

  it('prescribes NOTHING for sessions scored on other axes', () => {
    for (const type of ['rest', 'strength', 'cross']) {
      expect(prescribedZonesFor({ type })).toBeNull()
    }
    expect(prescribedZonesFor(null)).toBeNull()
  })
})

describe('prescribedZoneFigures — the founder’s real run', () => {
  // 🔴 THE DEFECT, AS ARITHMETIC. Scored against Z3 alone he got in=32.26,
  // below=29.04, above=38.71 → HR discipline 32, on half of §108's composite, for
  // running the session as its own catalogue row prescribes it.
  it('BEFORE the fix the numbers were thirds; AFTER, the opening third counts', () => {
    const f = prescribedZoneFigures(FOUNDERS_HISTOGRAM, PROGRESSIVE_TEMPO, LEGACY)
    // z2 + z3 are both prescribed, so in-zone is 25.81 + 32.26.
    expect(f.hrInZonePct).toBeCloseTo(58.07, 2)
    // z1 is still below every prescribed band.
    expect(f.hrBelowFloorPct).toBeCloseTo(3.23, 2)
    // And the threshold finish overshooting into Z4-5 IS still above prescription.
    expect(f.hrAboveCeilingPct).toBeCloseTo(38.71, 2)
    // The three still account for the whole run.
    expect(f.hrInZonePct! + f.hrBelowFloorPct! + f.hrAboveCeilingPct!).toBeCloseTo(100, 1)
  })

  it('and it is a real improvement, not a rounding change', () => {
    const before = 32.26   // what Z3-alone gave him
    const after = prescribedZoneFigures(FOUNDERS_HISTOGRAM, PROGRESSIVE_TEMPO, LEGACY).hrInZonePct!
    expect(after).toBeGreaterThan(before + 20)
  })

  // ⚠️ The arm that stops this becoming a free pass. He DID overshoot the finish, and
  // the measure must still say so. 38.71% above is not nothing.
  it('does NOT absolve a genuinely hot run', () => {
    const f = prescribedZoneFigures(FOUNDERS_HISTOGRAM, PROGRESSIVE_TEMPO, LEGACY)
    expect(f.hrAboveCeilingPct).toBeGreaterThan(30)
    expect(f.hrInZonePct).toBeLessThan(80)
  })
})

describe('an easy run is not changed by any of this', () => {
  it('scores exactly as before: in = z2, above = z3 + z4_5, below = z1', () => {
    const hist = { z1: 0.14, z2: 93.03, z3: 6.4, z4_5: 0.43 }
    const f = prescribedZoneFigures(hist, EASY_RUN, LEGACY)
    // Measured from a real production row (2026-09-29): in 93.03, above 6.83, below 0.14.
    expect(f.hrInZonePct).toBeCloseTo(93.03, 2)
    expect(f.hrAboveCeilingPct).toBeCloseTo(6.83, 2)
    expect(f.hrBelowFloorPct).toBeCloseTo(0.14, 2)
  })
})

describe('a prescribed set that includes the LOWEST bucket', () => {
  // 🔴 Kills `i >= 0` vs `i > 0`. Every other case prescribes z2 or above, so index 0
  // was never in the set and the filter's lower bound was never exercised. A recovery
  // session prescribes Z1, and under the mutation it would have been dropped from the
  // set entirely — scoring a correctly-held recovery run as 0% in zone.
  it('a Z1 session scores its Z1 time as in-zone, not below floor', () => {
    const recovery = { type: 'recovery', zone: 'Zone 1' }
    const zones = prescribedZonesFor(recovery)
    // `zoneForSessionType('recovery')` is Z2, so Z1 arrives from the session's own label.
    expect(zones!.has('z1')).toBe(true)
    const f = prescribedZoneFigures({ z1: 70, z2: 30, z3: 0, z4_5: 0 }, recovery, LEGACY)
    expect(f.hrBelowFloorPct).toBe(0)
    expect(f.hrInZonePct).toBeCloseTo(100, 1)
  })
})

describe('the legacy fallback', () => {
  // ⚠️ Measured 2026-10-08: only 5 of 77 live analyses (6.5%) carry the histogram, so
  // this path is doing almost all of the work today. It is Z2-anchored and that is
  // declared rather than hidden.
  it('is used verbatim when there is no histogram', () => {
    expect(prescribedZoneFigures(NO_HISTOGRAM, PROGRESSIVE_TEMPO, LEGACY)).toEqual(LEGACY)
  })

  it('is used even for a session that prescribes no zone, because it is all we have', () => {
    expect(prescribedZoneFigures(NO_HISTOGRAM, { type: 'strength' }, LEGACY)).toEqual(LEGACY)
  })

  it('but a session with a histogram and no prescribed zone returns nulls, never zeros', () => {
    // 🔴 `0` would mean "none of the run was in zone", which is a claim. Null is the
    // absence of one, and §108 Am. 1 already ruled that a defaulted axis invents points.
    const f = prescribedZoneFigures(FOUNDERS_HISTOGRAM, { type: 'strength' }, LEGACY)
    expect(f).toEqual({ hrInZonePct: null, hrAboveCeilingPct: null, hrBelowFloorPct: null })
  })
})
