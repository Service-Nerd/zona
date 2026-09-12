// "Where I was" — derived from runs, when no benchmark was ever taken.
//
// WHY THIS EXISTS. The race projections arc reads `meta.vdot` for its baseline,
// and that field is stamped at generation ONLY when the runner entered a
// benchmark. Measured against production 2026-09-12: **10 of 17 live plans have
// no `meta.vdot`**, so the "where I was" point could never render for them —
// including the founder, who has 69 runs across six months and a genuine
// improvement sitting in the database (easy pace 8:29/km in April, 6:32/km in
// September). The arc was built, shipped, and could fully draw on 2 of 17 plans.
//
// §109 PERMITS THIS. The rule is that this surface may REMEMBER and COMPARE but
// may not PREDICT. Working out what a runner's aerobic fitness WAS, from runs
// they actually did at the time, is remembering. It is the same method the
// "now" point already uses, applied to an earlier window — which makes the
// comparison MORE like-for-like than a benchmark-versus-aerobic-runs one, not
// less.
//
// The point is labelled with its MONTH, never "plan start": the earliest run
// data may begin long after the plan did, and claiming otherwise would date a
// measurement that is not from then.

const WEEK_MS = 7 * 24 * 60 * 60 * 1000

export const FITNESS_BASELINE = {
  /** Length of the baseline window, from the runner's earliest qualifying run. */
  WINDOW_WEEKS: 6,
  /** Below this the window is one good week and a rumour, not a baseline. */
  MIN_RUNS: 3,
  /**
   * Gap required between the END of the baseline window and the START of the
   * current one. Without it the two windows can touch, and the arc compares a
   * runner against themselves a fortnight ago — two points that are the same
   * measurement with noise between them. Measured 2026-09-12: the one other
   * production account with qualifying runs has a separation of −7.8 weeks
   * (overlapping windows) and is correctly excluded by this.
   */
  MIN_SEPARATION_WEEKS: 6,
} as const

export interface AerobicRun {
  startDate: Date
  avgSpeedMs: number
  distanceM: number
}

export interface FitnessBaseline {
  weightedSpeedMs: number
  runCount: number
  /** 'YYYY-MM' of the window's first run. */
  monthKey: string
  /** Short month label for display, e.g. 'Apr'. */
  label: string
}

const SHORT_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function isUsable(r: AerobicRun): boolean {
  return Number.isFinite(r.avgSpeedMs) && r.avgSpeedMs > 0
    && Number.isFinite(r.distanceM) && r.distanceM > 0
    && r.startDate instanceof Date && !Number.isNaN(r.startDate.getTime())
}

/**
 * Distance-weighted mean aerobic speed.
 *
 * THE SINGLE OWNER of this formula. It was written out by hand in
 * `app/api/race-times/route.ts` for the current window; deriving a baseline
 * needed the same arithmetic, and two copies of a weighting formula agree only
 * until one of them is edited.
 *
 * Weighted by distance rather than a plain mean because a 3 km shuffle and a
 * 25 km long run are not equal evidence of aerobic speed.
 */
export function weightedAerobicSpeed(runs: AerobicRun[]): number | null {
  const usable = runs.filter(isUsable)
  if (!usable.length) return null
  const totalM = usable.reduce((s, r) => s + r.distanceM, 0)
  if (totalM <= 0) return null
  return usable.reduce((s, r) => s + r.avgSpeedMs * r.distanceM, 0) / totalM
}

/**
 * The earliest window of qualifying runs that is far enough in the past to be
 * a genuine "before".
 *
 * Returns `null` rather than a weak answer: too few runs, or a window that
 * crowds the present, means the runner has no measurable past yet and the arc
 * correctly renders without its first point.
 */
export function deriveFitnessBaseline(
  runs: AerobicRun[],
  currentWindowStart: Date,
): FitnessBaseline | null {
  const usable = runs.filter(isUsable).sort((a, z) => a.startDate.getTime() - z.startDate.getTime())
  if (usable.length < FITNESS_BASELINE.MIN_RUNS) return null

  const first = usable[0].startDate
  const windowEnd = new Date(first.getTime() + FITNESS_BASELINE.WINDOW_WEEKS * WEEK_MS)

  // The baseline must be a PAST window, not a recent one that happens to be
  // first. Separation is measured end-of-baseline to start-of-current.
  const separationWeeks = (currentWindowStart.getTime() - windowEnd.getTime()) / WEEK_MS
  if (separationWeeks < FITNESS_BASELINE.MIN_SEPARATION_WEEKS) return null

  const inWindow = usable.filter(r => r.startDate < windowEnd)
  if (inWindow.length < FITNESS_BASELINE.MIN_RUNS) return null

  const speed = weightedAerobicSpeed(inWindow)
  if (speed === null) return null

  const y = first.getUTCFullYear()
  const m = first.getUTCMonth()
  return {
    weightedSpeedMs: speed,
    runCount: inWindow.length,
    monthKey: `${y}-${String(m + 1).padStart(2, '0')}`,
    label: SHORT_MONTHS[m],
  }
}
