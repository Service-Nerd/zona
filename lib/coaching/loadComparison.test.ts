// POSTRUN-METRIC-PREF-01 — behavioural, because the rule is new and a source
// assertion passes on a comment.
import { describe, it, expect } from 'vitest'
import { compareLoad, DISTANCE_TOLERANCE_KM, DURATION_TOLERANCE_MINS } from './loadComparison'

/** The founder's real row, verbatim from production (week 3 / wed, 2026-10-07). */
const FOUNDERS_RUN = { plannedKm: 8.5, actualKm: 9.88, plannedMins: 48, actualMins: 61.12 }

describe('compareLoad — which axis, and did they fall short', () => {
  it('🔴 THE DEFECT: distance won even when the runner chose duration', () => {
    // This is the assertion that would have failed before the fix.
    expect(compareLoad(FOUNDERS_RUN, 'duration').axis).toBe('duration')
    expect(compareLoad(FOUNDERS_RUN, 'distance').axis).toBe('distance')
  })

  it('defaults to distance, which is every pre-existing caller’s behaviour', () => {
    expect(compareLoad(FOUNDERS_RUN).axis).toBe('distance')
  })

  it('the preference only chooses an axis that EXISTS', () => {
    // A duration reader on a session carrying no duration still gets the distance.
    // The preference is about encoding, never about withholding information.
    const kmOnly = { plannedKm: 8, actualKm: 8, plannedMins: null, actualMins: null }
    expect(compareLoad(kmOnly, 'duration').axis).toBe('distance')

    // And the §80 beginner case: duration only, distance reader. Still duration.
    const minsOnly = { plannedKm: null, actualKm: null, plannedMins: 45, actualMins: 45 }
    expect(compareLoad(minsOnly, 'distance').axis).toBe('duration')
  })

  it('reports no axis when nothing is comparable', () => {
    const none = { plannedKm: null, actualKm: null, plannedMins: null, actualMins: null }
    expect(compareLoad(none, 'duration')).toEqual({ axis: 'none', onTarget: false, short: null })
  })
})

describe('the verdict stays on §66’s axis', () => {
  it('short on BOTH axes: the verdict holds whichever axis is displayed', () => {
    const both = { plannedKm: 10, actualKm: 8, plannedMins: 60, actualMins: 48 }
    expect(compareLoad(both, 'distance').short).toBe(true)
    expect(compareLoad(both, 'duration').short).toBe(true)
  })

  it('short on NEITHER axis: no verdict either way', () => {
    expect(compareLoad(FOUNDERS_RUN, 'distance').short).toBe(false)
    expect(compareLoad(FOUNDERS_RUN, 'duration').short).toBe(false)
  })

  // 🔴 THE CASE THAT DECIDED THE DESIGN, and it is 22% of the live both-axes rows.
  it('axes DISAGREE: the verdict is WITHHELD, never asserted on one of them', () => {
    // §66 Am. 1's own example: "a fast runner covering 95% of the distance in 60%
    // of the time is not short". Distance fine, duration short.
    const fast = { plannedKm: 10, actualKm: 9.9, plannedMins: 60, actualMins: 40 }
    expect(compareLoad(fast, 'distance').short).toBeNull()
    expect(compareLoad(fast, 'duration').short).toBeNull()

    // And the mirror: full time on feet, short on ground covered. §80's walk-break
    // cohort, where reporting "short" would name a failure the runner did not have.
    const walker = { plannedKm: 10, actualKm: 8, plannedMins: 60, actualMins: 61 }
    expect(compareLoad(walker, 'distance').short).toBeNull()
    expect(compareLoad(walker, 'duration').short).toBeNull()
  })

  it('withholding is the THIRD state, distinct from "not short"', () => {
    // A boolean cannot carry this, which is why `short` is nullable. If this ever
    // collapses to false the card would say "not short" about a contested run.
    const fast = { plannedKm: 10, actualKm: 9.9, plannedMins: 60, actualMins: 40 }
    expect(compareLoad(fast, 'duration').short).not.toBe(false)
    expect(compareLoad(fast, 'duration').short).toBeNull()
  })

  it('a single comparable axis carries its own verdict with no contradiction possible', () => {
    const kmOnly = { plannedKm: 10, actualKm: 8, plannedMins: null, actualMins: null }
    expect(compareLoad(kmOnly, 'distance').short).toBe(true)
    const minsOnly = { plannedKm: null, actualKm: null, plannedMins: 60, actualMins: 50 }
    expect(compareLoad(minsOnly, 'duration').short).toBe(true)
  })
})

describe('the two tolerances forgive the same amount of session', () => {
  it('0.3 km and 2 minutes are siblings, not two opinions', () => {
    // At the engine's easy pace (~6.3 min/km) 0.3 km is about 1.9 minutes.
    expect(DISTANCE_TOLERANCE_KM * 6.3).toBeCloseTo(DURATION_TOLERANCE_MINS, 0)
  })

  it('exactly at tolerance is NOT short, on either axis', () => {
    const atKm = { plannedKm: 10, actualKm: 10 - DISTANCE_TOLERANCE_KM + 0.001, plannedMins: null, actualMins: null }
    expect(compareLoad(atKm, 'distance').short).toBe(false)
    const atMins = { plannedKm: null, actualKm: null, plannedMins: 60, actualMins: 60 - DURATION_TOLERANCE_MINS + 0.001 }
    expect(compareLoad(atMins, 'duration').short).toBe(false)
  })

  it('onTarget is the within-tolerance band on the DISPLAYED axis', () => {
    // Same row read two ways: on target for distance, off target for time.
    const row = { plannedKm: 10, actualKm: 10.1, plannedMins: 60, actualMins: 71 }
    expect(compareLoad(row, 'distance').onTarget).toBe(true)
    expect(compareLoad(row, 'duration').onTarget).toBe(false)
  })
})
