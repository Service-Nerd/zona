// One owner for the week's zone numbers — and the properties that matter.
//
// Three load-weighted aggregations over the same run_analysis rows lived in
// DashboardClient, two of them identical, held in agreement by a comment. This
// repo has watched that exact shape fail four times (deload cadence in five
// places, tier resolution in three, `distance_km ?? 0` in twenty, the display
// zone derived two ways). Each was correct until one copy moved.
//
// It matters more here than usual: the redesigned Coach screen uses this number
// TWICE AT ONCE — Kit's read says "nine per cent of your week sat in Zone 3" and
// the ZoneRings draw that same nine per cent directly beneath it. Two formulas
// could contradict each other on the flagship paid screen.
import { describe, it, expect } from 'vitest'
import { zoneDiscipline, zoneTimeSplit, weightOf } from './weeklyZoneAggregate'

const d = (inZone: number, weight = 1) => ({ inZone, weight })

describe('weightOf — the shared fallback', () => {
  it('uses actual_load_km when present', () => {
    expect(weightOf(12.4)).toBe(12.4)
  })

  it('falls back to 1, NOT 0, when a run recorded no distance', () => {
    // 0 would drop the run from the week silently. 1 says "one kilometre's
    // worth of evidence", which is what all three original sites did.
    expect(weightOf(null)).toBe(1)
    expect(weightOf(undefined)).toBe(1)
  })
})

describe('zoneDiscipline', () => {
  it('weights by load — a long run counts more than a shakeout', () => {
    // 100% over 20km and 0% over 1km is not 50%.
    const { pct } = zoneDiscipline([d(100, 20), d(0, 1)])
    expect(pct).toBe(95)
  })

  it('is the plain mean when every run weighs the same', () => {
    expect(zoneDiscipline([d(80), d(60)]).pct).toBe(70)
  })

  it('returns NULL for an empty week, never 0', () => {
    // 0 reads as "perfectly out of zone"; null reads as "nothing to say yet".
    // On the redesigned screen those produce completely different copy.
    expect(zoneDiscipline([]).pct).toBeNull()
  })

  it('reports how many runs it is speaking for', () => {
    expect(zoneDiscipline([d(80), d(60)]).hits).toBe(2)
    expect(zoneDiscipline([]).hits).toBe(0)
  })

  it('rounds, because every consumer is a display', () => {
    expect(zoneDiscipline([d(70), d(71)]).pct).toBe(71)  // 70.5 -> 71
  })

  it('survives a week where every weight is zero rather than dividing by it', () => {
    expect(zoneDiscipline([{ inZone: 80, weight: 0 }]).pct).toBeNull()
  })
})

describe('zoneTimeSplit', () => {
  const z = (z1: number, z2: number, z3: number, z45: number, weight = 1) => ({ z1, z2, z3, z45, weight })

  it('weights each zone by load, like the discipline figure', () => {
    const { split } = zoneTimeSplit([z(0, 100, 0, 0, 9), z(0, 0, 100, 0, 1)])
    expect(split!.z2).toBe(90)
    expect(split!.z3).toBe(10)
  })

  it('does NOT round — four independently rounded shares can sum to 99 or 101', () => {
    const { split } = zoneTimeSplit([z(1, 97.5, 1, 0.5)])
    expect(split!.z2).toBeCloseTo(97.5, 6)
  })

  it('returns null for an empty week', () => {
    expect(zoneTimeSplit([]).split).toBeNull()
    expect(zoneTimeSplit([]).hits).toBe(0)
  })

  it('agrees with zoneDiscipline about what weighed what — the whole point', () => {
    // Same rows, same weighting: the sentence and the rings cannot disagree.
    const rows = [{ inZone: 100, z1: 0, z2: 100, z3: 0, z45: 0, weight: 20 },
                  { inZone: 0,   z1: 0, z2: 0,   z3: 100, z45: 0, weight: 1 }]
    const disc = zoneDiscipline(rows)
    const split = zoneTimeSplit(rows)
    // 95% of the week's load was in zone, and 95% of it was Z2. Same number.
    expect(disc.pct).toBe(95)
    expect(split.split!.z2).toBeCloseTo(95.238, 2)
  })
})
