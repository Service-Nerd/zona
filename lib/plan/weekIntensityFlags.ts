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
  /** A quality/intervals/tempo session — real prescribed intensity. */
  hasQuality: boolean
  /** The §78 recalibration time trial (typed `hard`) — a measurement, not a stimulus. */
  hasBenchmark: boolean
}

export function weekIntensityFlags(week: Pick<Week, 'sessions'>): WeekIntensityFlags {
  const types = Object.values(week.sessions ?? {}).map(s => s?.type)
  return {
    hasQuality: types.some(t => t === 'quality' || t === 'intervals' || t === 'tempo'),
    hasBenchmark: types.some(t => t === 'hard'),
  }
}
