// COACH-SEEN-MOMENTS-01 (§131): the earned sentences on Coach. Rule-based, measured against the runner's own weeks, shown
// only in the week they are earned and never as a badge, streak or reward (Coaching Board and Design Board, 2026-10-30).

import { COACH_MOMENT_EASIEST_MARGIN_PTS, COACH_MOMENT_MIN_PRIOR_WEEKS } from './constants'
import { paceContext } from './trendSentence'

/**
 * "Your easiest week in N weeks": `weeks` is the drawn record (oldest first, this week last, `null` = a thin week).
 * Returns N, the weeks drawn, so the claim is countable on screen; `null` on an ordinary week.
 */
export function easiestWeekSpan(weeks: (number | null)[]): number | null {
  const now = weeks[weeks.length - 1]
  if (now == null) return null
  const prior = weeks.slice(0, -1).filter((w): w is number => w != null)
  if (prior.length < COACH_MOMENT_MIN_PRIOR_WEEKS) return null
  return now - Math.max(...prior) >= COACH_MOMENT_EASIEST_MARGIN_PTS ? weeks.length : null
}

const NUMBER_WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten']

export function easiestWeekSentence(span: number): string {
  return `Your easiest week in ${NUMBER_WORDS[span] ?? span} weeks.`
}

type TrendEnds = { hrIsTrending: boolean; buckets: { avgHr: number | null; avgPaceSecPerKm: number | null }[] }

/** The easy-run heart rate has fallen past the noise floor and pace confirms it (not a slower pace explaining it). */
export function easyCostFell(trend: TrendEnds | null): boolean {
  if (!trend?.hrIsTrending || trend.buckets.length < 2) return false
  const first = trend.buckets[0], last = trend.buckets[trend.buckets.length - 1]
  if (first.avgHr == null || last.avgHr == null || last.avgHr >= first.avgHr) return false
  return paceContext({ earlierHr: first.avgHr, nowHr: last.avgHr, earlierMonth: '', earlierPace: first.avgPaceSecPerKm, nowPace: last.avgPaceSecPerKm }) === 'confirms'
}

/** "First time" without stored state: the series qualifies now and did not before the last 7 days of runs. */
export function easyCostFellThisWeek(now: TrendEnds | null, weekAgo: TrendEnds | null): boolean {
  return easyCostFell(now) && !easyCostFell(weekAgo)
}

export function easyCostSentence(earlierHr: number, nowHr: number, sinceMonth: string): string {
  return `Easy is costing you less: ${earlierHr} → ${nowHr} bpm since ${sinceMonth}.`
}
