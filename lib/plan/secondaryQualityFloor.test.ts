import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { makeQualitySession, buildPaceFromVDOT } from './ruleEngine'
import { computeZones } from './zones'
import { V1_SESSION_CATALOGUE } from './sessionCatalogueData'
import { GENERATION_CONFIG } from './generationConfig'
import { sessionFloorsFor } from './sessionFloors'
import { isSecondaryQuality } from './sessionRole'
import type { GeneratorPhase } from '@/types/plan'
import type { FitnessLevel } from './fitnessAssessment'

/**
 * S9-SECONDARY-FLOOR-PRECEDENCE-01 — the week's SECOND, softer quality session is held
 * to its own ratified floor (`MIN_SESSION_DISTANCE_KM.secondary_quality`, 4 km) and not
 * to the primary's (5 km).
 *
 * 🔴 WHY THIS GATE IS THE DELIVERABLE AND THE FIX IS ONE WORD. Both growth loops
 * (`pacedRepPlan`, `continuousThresholdPlan`) read `.quality` unconditionally, so a
 * secondary session was grown to the primary's floor — while the sizing BUDGET at the
 * same call site already used `.secondary_quality`. The two disagreed, in one function.
 *
 * 📐 MEASURED 2026-11-15, and the fix changes NOTHING TODAY:
 *   · 179,582 quality-sizing calls over 45,908 served plans (cohortGrid + targetedGrid)
 *   · 21,624 of them (12.0%) sit in the band where the two floors diverge
 *   · 1,556 of them are the SECONDARY slot, and **0 of those 1,556 are in the band** —
 *     the smallest secondary session enters sizing at 8.33 km / 45.6 min, far above
 *     either floor, because a second quality session needs `qualityCountInPeak > 1`
 *     and that cohort's threshold dose is already large.
 *   · A hand-built SLOW-EXPERIENCED cell (768 plans, the cell no grid covers: cohortGrid
 *     and targetedGrid pair experience with speed, and slowGoalGrid declares only
 *     beginner/intermediate) was generated with both precedences and came back
 *     byte-for-byte identical.
 *
 * ⚠️ THE ITEM'S OWN REASON FOR THE LATENCY WAS WRONG, and the correction matters for the
 * next person. It argued from the sizing BUDGET ("the smallest 80%-of-primary budget is
 * 6.0 km"). For a structured session `distKm` is DISCARDED — the delivered distance is
 * the segment-priced structure (`makeQualitySession`'s `effectiveDistKm`), so the budget
 * cannot gate the band. The real reason is the dose of the cohort that gets two sessions.
 *
 * ⚠️ AND THE ITEM NAMED ONE SITE OF TWO. It named `continuousThresholdPlan`;
 * `pacedRepPlan` read the primary floor the same way, and in the sizer it is the WIDER
 * of the two — `tempo_over_under` diverges at experienced as well as beginner, where
 * `tempo_continuous` diverges only at the beginner dose.
 *
 * So the gate asserts what the engine cannot reach: that a secondary session MAY land in
 * [secondary_quality, quality), through both sizers, and that the two call sites pass the
 * floor their slot is entitled to.
 */

const ZONES = computeZones(185, 55)
const CFG = GENERATION_CONFIG.MIN_SESSION_DISTANCE_KM
const PRIMARY = CFG.quality
const SECONDARY = CFG.secondary_quality

function size(rowId: string, vdot: number, fitness: FitnessLevel, phase: GeneratorPhase, floorKm: number) {
  const row = V1_SESSION_CATALOGUE.find(r => r.id === rowId)
  expect(row, `catalogue row ${rowId} must exist`).toBeTruthy()
  return makeQualitySession({
    weekN: 5, day: 'tue', distKm: 8, metric: 'distance',
    qualityFloorKm: floorKm,
    zones: ZONES, pace: buildPaceFromVDOT(vdot, vdot),
    catalogueRow: row!, phase, fitness, isDeload: false, goalPace: null,
    raceDistanceKm: 10,
  })
}

/** The two constructions where the floors diverge, one per sizer. Found by sweeping every
 *  catalogue row × VDOT 20–85 × every fitness × every phase: 30 divergent constructions,
 *  across exactly these two rows. */
const BAND_CASES = [
  // continuousThresholdPlan — the site the item named.
  { row: 'tempo_continuous', vdot: 32, fitness: 'beginner' as FitnessLevel, phase: 'build' as GeneratorPhase, sizer: 'continuousThresholdPlan' },
  // pacedRepPlan — the site it did not, and the one that reaches a non-beginner dose.
  { row: 'tempo_over_under', vdot: 24, fitness: 'experienced' as FitnessLevel, phase: 'base' as GeneratorPhase, sizer: 'pacedRepPlan' },
]

describe('S9-SECONDARY-FLOOR-PRECEDENCE-01 — the secondary slot keeps its own floor', () => {
  it('the two floors are different values, so the precedence has content', () => {
    // Guards the whole file: if these collapse to one number every assertion below
    // passes vacuously, which is how a gate becomes decoration.
    expect(SECONDARY).toBeLessThan(PRIMARY)
    expect(sessionFloorsFor(undefined).secondary_quality).toBe(SECONDARY)
    expect(sessionFloorsFor(undefined).quality).toBe(PRIMARY)
  })

  for (const c of BAND_CASES) {
    it(`a secondary session MAY land in [${SECONDARY}, ${PRIMARY}) — ${c.row} via ${c.sizer}`, () => {
      const secondary = size(c.row, c.vdot, c.fitness, c.phase, SECONDARY)
      const primary = size(c.row, c.vdot, c.fitness, c.phase, PRIMARY)

      // The item's literal ask. Bounds read from config, never typed as literals.
      expect(secondary.distance_km).toBeGreaterThanOrEqual(SECONDARY)
      expect(secondary.distance_km!).toBeLessThan(PRIMARY)

      // And the primary floor really does grow the same session past it, which is what
      // makes the first assertion a FINDING rather than a coincidence of this fixture.
      expect(primary.distance_km!).toBeGreaterThan(secondary.distance_km!)
    })
  }

  it('the floor is READ, not advisory — every band case responds to it', () => {
    // Falsification in-line: if either sizer went back to reading
    // MIN_SESSION_DISTANCE_KM.quality internally, both sides of each pair would be
    // identical and this fails naming the sizer.
    for (const c of BAND_CASES) {
      const a = size(c.row, c.vdot, c.fitness, c.phase, SECONDARY)
      const b = size(c.row, c.vdot, c.fitness, c.phase, PRIMARY)
      expect(a.distance_km, `${c.sizer} ignored the floor it was handed`).not.toBe(b.distance_km)
    }
  })

  /**
   * 🔴 THE ARM THAT CATCHES THE REGRESSION THE OTHERS CANNOT. Every arm above tests the
   * SIZER with a floor handed to it. None of them can see a CALL SITE handing it the
   * wrong one — re-hardcoding `.quality` at the secondary slot leaves them all green,
   * which is exactly the defect this item was filed for.
   *
   * ⚠️ Source-level by necessity, so it is bounded rather than grepped: it reads the two
   * `makeQualitySession` call sites inside `buildWeekSessions` and asserts which floor
   * each passes. The band is unreachable through `generateRulePlan` (measured above), so
   * there is no behavioural alternative — and "not mechanically checkable" would be false,
   * because this much IS checkable.
   */
  it('each call site passes the floor its slot is entitled to', () => {
    const src = readFileSync(new URL('./ruleEngine.ts', import.meta.url), 'utf8')
    // ⚠️ COMMENT LINES AND TYPE DECLARATIONS ARE STRIPPED FIRST, and the first cut of this
    // arm did neither: it matched `qualityFloorKm: number` in the two signatures AND a
    // sentence in this item's own explanatory comment. `HOOK-RGBA-COMMENTS-01` from the
    // other side — searching for the thing finds the prose ABOUT the thing.
    const code = src.split('\n')
      .filter(l => { const t = l.trim(); return !t.startsWith('//') && !t.startsWith('*') && !t.startsWith('/*') })
      .join('\n')
    // ⚠️ TO END OF LINE, NOT TO THE FIRST COMMA. `/code-review` made the V2 seam recover
    // its slot, and `isSecondaryQuality(session, …)` contains a comma — a comma-terminated
    // capture silently truncated to `isSecondaryQuality(session` and still passed.
    const floors = Array.from(code.matchAll(/qualityFloorKm:\s*([^\n]+)/g))
      .map(m => m[1].trim().replace(/,$/, ''))
      .filter(v => v !== 'number')
    expect(floors).toEqual([
      'minDist.quality',
      'minDist.secondary_quality',
      'isSecondaryQuality(session, Object.values(week.sessions))',
    ])

    // 🔴 READ FROM `code`, NOT `src` — this assertion used `src` on its first cut, so a
    // future comment quoting the old expression (a shape this file writes constantly)
    // would have failed the build on a correct tree. Same defect as above, one arm over.
    const sizerRegion = code.slice(code.indexOf('function pacedRepPlan('), code.indexOf('function buildWeekSessions('))
    expect(sizerRegion).not.toMatch(/minKm\s*[:=]\s*GENERATION_CONFIG\.MIN_SESSION_DISTANCE_KM\.quality/)
  })

  /**
   * `isSecondaryQuality` is the ONE owner of "is this the week's second quality session",
   * shared by `INV-PLAN-MIN-SESSION-SIZE` and the V2 resize seam. It was inline in the
   * validator; the seam needed the same answer, and a second hand-written copy of a
   * classifier is the shape `DELOAD-OWNER-01` and `TIER-OWNER-01` are named after.
   */
  describe('isSecondaryQuality — the slot, recovered structurally', () => {
    const q = (km: number | null) => ({ type: 'quality' as const, distance_km: km })

    it('the larger of two quality sessions is primary, the smaller secondary', () => {
      const big = q(9), small = q(7)
      const week = [big, small, { type: 'easy' as const, distance_km: 12 }]
      expect(isSecondaryQuality(small, week)).toBe(true)
      expect(isSecondaryQuality(big, week)).toBe(false)
    })

    it('a lone quality session is never secondary', () => {
      const only = q(7)
      expect(isSecondaryQuality(only, [only, { type: 'easy' as const, distance_km: 12 }])).toBe(false)
    })

    it('a non-quality session is never secondary, however small', () => {
      const easy = { type: 'easy' as const, distance_km: 4 }
      expect(isSecondaryQuality(easy, [easy, q(9), q(7)])).toBe(false)
    })

    it('a DURATION-ANCHORED quality session reads as primary, which is the safe direction', () => {
      // `distance_km` is null on §79/§80 beginners. `?? 0` would make every one of them the
      // smallest and therefore secondary — the wrong direction, since the secondary floor is
      // the LOWER and a misread would shrink the session. It reads primary instead.
      const durationAnchored = { type: 'quality' as const, distance_km: null }
      // ⚠️ THREE QUALITY SESSIONS, NOT TWO, AND THAT IS THE WHOLE CASE. With only one
      // SIZED sibling the `length < 2` guard returns before the null is ever compared, so
      // an earlier version of this case stayed GREEN against a mutation that restored the
      // `?? 0` bug. A case that cannot reach the line it is about is not a case.
      const week = [durationAnchored, q(9), q(7)]
      expect(isSecondaryQuality(durationAnchored, week)).toBe(false)
      // And it does not drag a sized session's ranking with it: 7 is still the smaller of
      // the two REAL distances, so it is still the secondary.
      expect(isSecondaryQuality(q(7), week)).toBe(true)
      expect(isSecondaryQuality(q(9), week)).toBe(false)
    })
  })
})
