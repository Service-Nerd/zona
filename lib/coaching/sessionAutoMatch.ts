// LOG-ONE-INTENTION-01 — the single owner of "which run is this session?"
// asked CLIENT-SIDE, before the runner is made to choose.
//
// 🔴 WHY THIS IS A MODULE AND NOT A SECOND `useMemo`.
// `DashboardClient` computed this inline for the SESSION screen only, keyed on
// `activeSessionData` — so Today, which already holds `stravaRuns` and today's
// session, could not answer the same question and offered the runner a choice
// instead: "Log this session" or "Log manually", two words for one intention.
//
// Copying the twelve lines into `TodayScreen` would have made a second
// classifier of the same thing, which is this repo's most expensive recorded
// duplication class — the tier order written three times, the deload cadence in
// five places, `sumWeeklyKm` by hand in six. A classifier that drifts from its
// twin is worse than either, because both look right in isolation.
//
// ⚠️ IT IS NOT THE SERVER'S MATCHER, AND MUST NOT BECOME IT. The ingest path
// (`autoMatchAndAnalyse`) auto-LINKS silently and is deliberately gated at HIGH
// confidence only — POST-RUN-01: "wrong link is worse than a picker tap". This
// one only decides what to SHOW a runner who is standing in front of the
// screen, so medium is allowed: the run's name, distance and time are all
// visible and tapping is consent (AUTO-MATCH-02). Same source data, different
// consequence, and the confidence gates differ for that reason.

import { parseLocalDate } from '@/lib/plan/weekResolution'
import { findMatchCandidates } from '@/lib/coaching/sessionMatch'

export interface AutoMatch {
  activity: unknown
  confidence: 'high' | 'medium'
}

const DAY_OFFSET: Record<string, number> = {
  mon: 0, tue: 1, wed: 2, thu: 3, fri: 4, sat: 5, sun: 6,
}

/**
 * The calendar date a session falls on. Exported because getting this wrong is
 * silent: a Sunday-night run read against the wrong week's date simply fails to
 * match, and the runner is shown a picker for a run we already had.
 */
export function sessionDateFor(weekStartDate: string, dayKey: string): Date | null {
  if (!weekStartDate) return null
  const d = parseLocalDate(weekStartDate)
  if (!d || Number.isNaN(d.getTime())) return null
  d.setDate(d.getDate() + (DAY_OFFSET[dayKey] ?? 0))
  return d
}

/**
 * The run this session most likely is, or null.
 *
 * Pure and synchronous — `findMatchCandidates` is pure, which is what makes it
 * safe to ask on render rather than behind a round trip. `null` means "we do
 * not know", never "there was no run": the caller opens manual entry, it does
 * not tell the runner we looked and found nothing.
 */
export function resolveAutoMatch(
  session: unknown,
  weekStartDate: string | undefined,
  dayKey: string | undefined,
  activities: readonly unknown[],
): AutoMatch | null {
  if (!session || !weekStartDate || !dayKey || !activities?.length) return null
  const when = sessionDateFor(weekStartDate, dayKey)
  if (!when) return null
  // 🔴 THIS WAS A LAZY `require('@/lib/coaching/sessionMatch')` INSIDE A try/catch, AND
  // IT MADE THIS OWNER UNPROVABLE (found 2026-10-08 while gating
  // LOG-UPDATE-SILENT-RELINK-01).
  //
  // Under `environment: 'node'` the aliased `require` throws, the catch swallowed it,
  // and the function returned `null` — which is indistinguishable from "no match".
  // So `findMatchCandidates` reported `confidence: 'high'` on the same inputs where
  // this returned null, and **all four existing arms in `logOneIntention.test.ts`
  // asserted only null-returning cases, so every one of them passed VACUOUSLY.** They
  // would pass against `() => null`. The single owner created to stop two classifiers
  // drifting had no arm proving it can match at all.
  //
  // ⚠️ THERE WAS NO CIRCULARITY TO JUSTIFY IT — `sessionMatch.ts` does not import this
  // module, verified. A static import changes WHEN the module loads, never WHETHER:
  // webpack resolved the aliased require in the Next build and resolves the import
  // the same way. The catch is gone with it, because a silent catch over a pure
  // function has nothing to fail on and was hiding a resolution error, not a data one.
  type Args = Parameters<typeof findMatchCandidates>
  const top = findMatchCandidates(session as Args[0], when, activities as Args[2])?.[0]
  if (!top) return null
  if (top.confidence === 'high' || top.confidence === 'medium') {
    return { activity: top.activity, confidence: top.confidence }
  }
  return null
}
