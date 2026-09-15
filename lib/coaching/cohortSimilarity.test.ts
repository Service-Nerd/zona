import { describe, it, expect } from 'vitest'
import { findSimilarRuns, summariseCohort, pickWindowDays, classifyHrBand, isPlausibleRunHr, type RunRecord } from './runHistory'
import { COHORT_SIMILARITY as C, RUN_HR_PLAUSIBLE } from './constants'

/**
 * §58 — past-self comparison, the two-axis cohort match.
 *
 * "Your usual easy 10ks sit at HR 145, today was 156" is the coaching this
 * product is for. Generic feedback ("HR was high, ease back") is replaceable by
 * any LLM; self-referenced feedback is the defensible layer. Both claims rest
 * entirely on the cohort being MATCHED CORRECTLY — a cohort that quietly
 * includes a tempo run makes "your usual easy 10k" a lie with a number attached.
 *
 * Not an invariant: this reads run HISTORY, which no generated plan contains.
 * `trendCopyHonesty.test.ts` covers what the COPY may claim from a series;
 * nothing tested the match itself.
 *
 * ⚠️ The measured noise floor matters here. Easy-pace within-month SD is about
 * 40 s/km, so a cohort of two is not a baseline — which is what MIN_COHORT_SIZE
 * is for, and why the size assertions below are not decoration.
 */
const run = (over: Partial<RunRecord> = {}): RunRecord => ({
  source: 'strava', startDate: new Date('2026-05-01T08:00:00Z'),
  distanceKm: 10, movingTimeSec: 3300, avgHr: 140, avgSpeedMs: 3.03,
  hrInZonePct: 80, hrAboveCeilingPct: 10, hrBelowFloorPct: 10, ...over,
} as RunRecord)

const EXCLUDE = new Date('2026-06-01T08:00:00Z')
const B = C.HR_BAND_BREAKPOINTS

describe('§58 — the distance axis', () => {
  it('keeps runs inside the ±tolerance band', () => {
    const tol = C.DISTANCE_TOLERANCE_PCT / 100
    const cohort = [run({ distanceKm: 10 * (1 - tol) }), run({ distanceKm: 10 }), run({ distanceKm: 10 * (1 + tol) })]
    expect(findSimilarRuns(cohort, { distanceKm: 10, avgHr: 140 }, EXCLUDE)).toHaveLength(3)
  })

  it('drops runs outside it — a 5k is not a slow 10k', () => {
    const cohort = [run({ distanceKm: 5 }), run({ distanceKm: 21.1 }), run({ distanceKm: 10 })]
    expect(findSimilarRuns(cohort, { distanceKm: 10, avgHr: 140 }, EXCLUDE)).toHaveLength(1)
  })
})

describe('§58 — the effort axis, which is what preserves type purity', () => {
  it('buckets HR into three bands at the configured breakpoints', () => {
    expect(classifyHrBand(B.low - 1)).toBe('low')
    expect(classifyHrBand(B.low)).toBe('mid')
    expect(classifyHrBand(B.mid - 1)).toBe('mid')
    expect(classifyHrBand(B.mid)).toBe('high')
    expect(classifyHrBand(null)).toBeNull()
  })

  it('excludes a same-distance run at a different effort', () => {
    // The defect this prevents: comparing today's easy 10k against a tempo 10k
    // and reporting the runner has "lost fitness".
    const cohort = [run({ avgHr: B.low - 10 }), run({ avgHr: B.mid + 10 })]
    const matched = findSimilarRuns(cohort, { distanceKm: 10, avgHr: B.low - 5 }, EXCLUDE)
    expect(matched).toHaveLength(1)
    expect(matched[0].avgHr).toBe(B.low - 10)
  })

  it('falls back to distance alone when the target has no HR', () => {
    // An iPhone-only runner has no HR stream at all (ADR-011 §5). Matching on
    // distance only is weaker, not broken — refusing to match would abandon them.
    const cohort = [run({ avgHr: B.low - 10 }), run({ avgHr: B.mid + 10 }), run({ avgHr: null })]
    expect(findSimilarRuns(cohort, { distanceKm: 10, avgHr: null }, EXCLUDE)).toHaveLength(3)
  })
})

describe('§58 — the run being analysed is never in its own cohort', () => {
  it('excludes by start-date timestamp', () => {
    const today = run({ startDate: EXCLUDE })
    const matched = findSimilarRuns([today, run()], { distanceKm: 10, avgHr: 140 }, EXCLUDE)
    expect(matched).toHaveLength(1)
    expect(matched[0].startDate.getTime()).not.toBe(EXCLUDE.getTime())
  })
})

describe('§58 — the summary, and what it refuses to summarise', () => {
  it('returns null on an empty cohort rather than a zeroed one', () => {
    // A CohortSummary of zeros would render as "your usual easy 10k: HR 0".
    expect(summariseCohort([])).toBeNull()
  })

  it('averages HR, pace and in-zone, and takes the MEDIAN distance', () => {
    const s = summariseCohort([
      run({ distanceKm: 9,  avgHr: 140, movingTimeSec: 2700, hrInZonePct: 70 }),
      run({ distanceKm: 10, avgHr: 150, movingTimeSec: 3000, hrInZonePct: 80 }),
      run({ distanceKm: 11, avgHr: 160, movingTimeSec: 3300, hrInZonePct: 90 }),
    ])!
    expect(s.cohortSize).toBe(3)
    expect(s.avgHr).toBe(150)
    expect(s.avgInZonePct).toBe(80)
    expect(s.medianDistanceKm).toBe(10)
    expect(s.avgPaceSecPerKm).toBe(300)
  })

  it('takes the MIDDLE of the sorted distances, not some other index', () => {
    // `npm run test:liveness` perturbed the `2` in `dists[Math.floor(length / 2)]`
    // and this file stayed green: the only median fixture had THREE runs, and
    // floor(3/2) and floor(3/3) are both 1, so the middle and the mutated index
    // are the same element. A fixture of five separates them — floor(5/2) is 2,
    // floor(5/3) is 1 — and the values are deliberately far apart so an
    // off-by-one cannot hide inside rounding.
    const s = summariseCohort([9, 10, 20, 30, 31].map(d => run({ distanceKm: d })))!
    expect(s.medianDistanceKm).toBe(20)
    // Sorted first, so input order cannot decide the answer.
    const shuffled = summariseCohort([31, 9, 30, 20, 10].map(d => run({ distanceKm: d })))!
    expect(shuffled.medianDistanceKm).toBe(20)
  })

  it('accepts BOTH plausibility bounds, and rejects one beat outside either', () => {
    // Added 2026-09-15 by `npm run test:liveness`, which flipped `>=` to `>` and
    // `<=` to `<` inside `isPlausibleRunHr` and this file did not notice. The
    // test asserted 0 was rejected and 150 accepted — either side of the band,
    // never the edges, so an off-by-one at either bound was invisible. That is
    // the whole class the mutation harness exists to find.
    expect(isPlausibleRunHr(RUN_HR_PLAUSIBLE.MIN_BPM)).toBe(true)
    expect(isPlausibleRunHr(RUN_HR_PLAUSIBLE.MAX_BPM)).toBe(true)
    expect(isPlausibleRunHr(RUN_HR_PLAUSIBLE.MIN_BPM - 1)).toBe(false)
    expect(isPlausibleRunHr(RUN_HR_PLAUSIBLE.MAX_BPM + 1)).toBe(false)
  })

  it('ignores implausible HR rather than letting it drag the mean', () => {
    const s = summariseCohort([run({ avgHr: 150 }), run({ avgHr: 0 }), run({ avgHr: 150 })])!
    expect(isPlausibleRunHr(0)).toBe(false)
    expect(s.avgHr, 'a sentinel zero halved the baseline').toBe(150)
  })
})

describe('§58 — the window shrinks for dense users', () => {
  it('uses the six-month window at or above the dense threshold', () => {
    expect(pickWindowDays(C.DENSE_THRESHOLD)).toBe(C.WINDOW_DAYS_DENSE)
    expect(pickWindowDays(C.DENSE_THRESHOLD + 50)).toBe(C.WINDOW_DAYS_DENSE)
  })
  it('uses the full year below it, so an occasional runner still has a cohort', () => {
    expect(pickWindowDays(C.DENSE_THRESHOLD - 1)).toBe(C.WINDOW_DAYS_DEFAULT)
    expect(pickWindowDays(0)).toBe(C.WINDOW_DAYS_DEFAULT)
  })
  it('the dense window is the SHORTER of the two — it captures recency, not less data', () => {
    expect(C.WINDOW_DAYS_DENSE).toBeLessThan(C.WINDOW_DAYS_DEFAULT)
  })
})
