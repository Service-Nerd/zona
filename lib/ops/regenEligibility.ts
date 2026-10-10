/**
 * REGEN-LIVE-PLAN-GUARD-01 — is this stored plan SAFE to silently regenerate?
 *
 * 🔴 WHY THIS IS A MODULE AND NOT A CHAIN OF `continue`s IN A SCRIPT. On 2026-10-10
 * the fleet regen script rewrote `8333720c` — a real runner in **week 8 of 14 with a
 * race five and a half weeks away**. It passed every guard the script had, and the
 * founder had approved the run on my briefing that *"none of these plans has
 * started"*, which was true of the five I had measured and false of the seventh.
 * Restored from `plan_archive` byte-for-byte. **Two guards were missing, and neither
 * was a subtle call:**
 *
 *   1. **The activity check could not see Strava.** It tested `session_completions`
 *      and `run_analysis` only. That runner had **11 synced Strava runs and had
 *      opened the app the previous day** and still read as dormant, because they
 *      never use the in-app completion log. ADR-011 makes `strava_activities` the
 *      source-agnostic activity log — *"never filter queries by source without
 *      explicit justification"* — so checking two of its three signals is reading
 *      one column of three and calling it the row.
 *
 *   2. **There was no "has the plan STARTED" guard at all.** The script tested
 *      `race_date >= today`, and *"the race is in the future"* is not the same claim
 *      as *"the block has not begun"*. The gap between them is exactly this case.
 *
 * ⚠️ BOTH DEFAULT TO REFUSING. A missing `plan_start` is treated as started and a
 * missing `race_date` as past, because the cost of declining to repair a plan is a
 * line in a report and the cost of rewriting a live one is a runner's training block.
 */

export interface RegenCandidate {
  /** `meta.plan_start`, ISO date. Absent/blank → treated as STARTED (refuse). */
  planStart?: string | null
  /** `meta.race_date`, ISO date. Absent/blank → treated as PAST (refuse). */
  raceDate?: string | null
  /** Does `meta.generator_input` exist? Without it there is nothing to regenerate from. */
  hasGeneratorInput: boolean
  isAdmin: boolean
  /** Any row in `session_completions` for this user. */
  hasCompletions: boolean
  /** Any row in `run_analysis` for this user. */
  hasRunAnalysis: boolean
  /**
   * Any row in `strava_activities` for this user — the source-agnostic activity log
   * (ADR-011), which includes Apple Health. **This is the signal that was missing.**
   */
  hasActivities: boolean
}

export type RegenRefusal =
  | 'past-race'
  | 'plan-already-started'
  | 'no-generator-input'
  | 'is-admin'
  | 'has-completions'
  | 'has-run-analysis'
  | 'has-activities'

/**
 * `null` means eligible. Order is deliberate: the two CHEAPEST and most absolute
 * facts about the plan come first, so a report reads "this plan is in the past"
 * rather than "this user is busy".
 */
export function regenRefusalReason(c: RegenCandidate, today: string): RegenRefusal | null {
  const race = (c.raceDate ?? '').trim()
  if (!race || race < today) return 'past-race'
  const start = (c.planStart ?? '').trim()
  // 🔴 THE GUARD THAT DID NOT EXIST. `start <= today` is "the block is under way".
  // A missing start is treated as started: we cannot show it has not begun.
  if (!start || start <= today) return 'plan-already-started'
  if (!c.hasGeneratorInput) return 'no-generator-input'
  if (c.isAdmin) return 'is-admin'
  if (c.hasCompletions) return 'has-completions'
  if (c.hasRunAnalysis) return 'has-run-analysis'
  // ⚠️ THE SIGNAL THAT WAS MISSING. A runner who syncs from Strava and never taps
  // "done" is an ACTIVE runner, and the old filter read them as dormant.
  if (c.hasActivities) return 'has-activities'
  return null
}
