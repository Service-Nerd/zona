// What kind of hard work a week contains — the single owner of the two
// predicates `INV-PLAN-COPY-MATCHES-SESSIONS` (§27/§41) judges week copy against.
//
// WHY THIS EXISTS. The invariant asks two different questions, and the answer to
// the wrong one silently discards a week's enriched copy:
//
//   hasQuality   = a `quality` / `intervals` / `tempo` session
//   hasBenchmark = the §78 recalibration time trial, typed `hard`
//
// They are NOT interchangeable. "sharpen" requires hasQuality specifically,
// because §78's trial is "a measurement, not a training stimulus" — you cannot
// sharpen on it. "benchmark" / "time trial" requires hasBenchmark specifically.
// "quality"/"tempo"/"interval"/"feels hard" accept either.
//
// The enrich prompt was told a single conflated `has_intensity` that counted
// `hard` as intensity. On 2026-09-04 the model was therefore told a deload week
// containing only the 5K time trial "had intensity", wrote "Build — recovery and
// sharpening", and the invariant correctly rejected it — costing that week its
// voice. A prompt and a checker disagreeing about the same predicate is the
// `checker reads a different source from the producer` class, committed in the
// very fix meant to prevent it.
//
// So both callers derive the flags HERE. If the invariant's claim table changes,
// this file changes, and the prompt follows automatically.

import type { Week } from '@/types/plan'

export interface WeekIntensityFlags {
  /** True when this week's volume genuinely EXCEEDS the previous non-deload
   *  week's — the only condition under which copy may claim overload
   *  ("highest volume", "fitness is built"). §27's overload arm. */
  isOverloadWeek: boolean
  /** A quality/intervals/tempo session — real prescribed intensity. */
  hasQuality: boolean
  /** The §78 recalibration time trial (typed `hard`) — a measurement, not a stimulus. */
  hasBenchmark: boolean
}

export function weekIntensityFlags(
  week: Pick<Week, 'sessions' | 'weekly_km'>,
  /** Every week in the plan, in order — needed for the overload comparison.
   *  Omit when only the session flags are wanted (the invariant's per-week arm
   *  computes overload separately for its own message). */
  allWeeks?: ReadonlyArray<Pick<Week, 'type' | 'weekly_km'>>,
): WeekIntensityFlags {
  const types = Object.values(week.sessions ?? {}).map(s => s?.type)
  return {
    hasQuality: types.some(t => t === 'quality' || t === 'intervals' || t === 'tempo'),
    hasBenchmark: types.some(t => t === 'hard'),
    isOverloadWeek: isOverloadWeek(week, allWeeks),
  }
}

/**
 * Does this week's volume exceed the previous NON-DELOAD week's?
 *
 * Mirrors §27's overload arm exactly, including its permissive edge: with no
 * prior non-deload week there is nothing to overload against, so the claim is
 * allowed rather than forbidden — the invariant only fires when a prior week
 * exists AND the volume did not rise.
 *
 * Exists because the prompt used to state this as a RULE the model had to
 * evaluate ("unless weekly_km genuinely exceeds the previous non-deload week's"),
 * which asks it to do arithmetic across weeks it is not tracking. On 2026-09-04
 * it duly claimed overload on two TAPER weeks, where volume falls by definition.
 * A flag is not a smaller ask than a rule — it is a different one.
 */
export function isOverloadWeek(
  week: Pick<Week, 'weekly_km'>,
  allWeeks?: ReadonlyArray<Pick<Week, 'type' | 'weekly_km'>>,
): boolean {
  if (!allWeeks) return false
  const idx = allWeeks.indexOf(week as Pick<Week, 'type' | 'weekly_km'>)
  if (idx < 0) return false
  const prev = allWeeks.slice(0, idx).reverse().find(w => w.type !== 'deload')
  if (!prev) return true          // nothing to overload against — §27 permits it
  return week.weekly_km > prev.weekly_km
}
