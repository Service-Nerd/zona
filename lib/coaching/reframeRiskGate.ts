/**
 * Reframe risk gate — decides whether the post-run reframe should be silenced.
 *
 * Doctrine: reframe-positive against a risk signal is harm. When the rule
 * engine surfaces overload, fatigue accumulation, or a severe back-third
 * fade, the runner needs the warning, not a hug. The reframe stays silent
 * and the coaching warning takes the surface.
 *
 * Pure function. The route assembles the inputs from session_completions +
 * stream summary + recent fatigue tags, then calls this. Order of checks
 * matters: highest-confidence signals win first.
 *
 * Canonical authority: docs/canonical/brand.md § Reframe Voice — Hard rules.
 */

import { REFRAME_RISK } from './constants'

export type CoachingFlag = 'ok' | 'watch' | 'flag'
export type FatigueTag = 'Fresh' | 'Fine' | 'Heavy' | 'Wrecked'

export interface ReframeRiskInput {
  /** This session's coaching_flag, computed at link time. */
  currentSessionFlag: CoachingFlag | null
  /** Recent coaching_flag values, NEWEST FIRST, including the current session.
   *  Pass at least REFRAME_RISK.REPEATED_OVERLOAD_WINDOW for full coverage.
   *  readonly — the gate only reads these, so `as const` fixtures/inputs fit. */
  recentCompletionFlags: readonly CoachingFlag[]
  /** Recent fatigue tags, NEWEST FIRST, including this session if logged.
   *  Pass at least REFRAME_RISK.FATIGUE_ACCUMULATION_SESSIONS for full coverage.
   *  readonly — the gate only reads these, so `as const` fixtures/inputs fit. */
  recentFatigueTags: readonly FatigueTag[]
  /** Back-third HR drift in bpm (signed — positive = drift up). */
  hrDriftBpm: number | null
  /** Back-third HR drift as a fraction (0–1, NOT percent). */
  hrDriftPct: number | null
}

/** Reasons that map 1:1 to session_reflections.reframe_silenced_reason values. */
export type ReframeRiskReason =
  | 'session_flagged'
  | 'repeated_overload'
  | 'fatigue_accumulation'
  | 'severe_hr_drift'

export interface ReframeRiskOutcome {
  silenced: boolean
  reason: ReframeRiskReason | null
  /** Short coaching-voice line shown to the user in place of the reframe.
   *  Brand voice rules apply — calm guidance, not alerts. */
  message: string | null
}

const NO_RISK: ReframeRiskOutcome = { silenced: false, reason: null, message: null }

/**
 * Coaching-voice line shown to the user when the reframe is silenced.
 * Single source of truth — both the route and the UI (on hydration of a
 * previously-silenced reflection) read from here.
 *
 * Brand voice: calm guidance, not alerts. Honest, dry, no cringe.
 */
export function messageForReframeRiskReason(reason: ReframeRiskReason): string {
  switch (reason) {
    case 'session_flagged':
      return 'This run flagged overload. Listen to the body before anything else.'
    case 'repeated_overload':
      return 'Multiple sessions flagging overload. Recovery is the answer here, not a reframe.'
    case 'fatigue_accumulation':
      return 'Three sessions of heavy fatigue running. Rest, not reframe.'
    case 'severe_hr_drift':
      return 'HR drifted hard in the back third. Worth checking before pushing on.'
  }
}

/**
 * Assesses whether risk signals should silence the reframe.
 *
 * Order of checks is deliberate — strongest signals win first. Once one
 * fires, further checks are skipped (single reason recorded).
 */
export function assessReframeRiskGate(input: ReframeRiskInput): ReframeRiskOutcome {
  // 1. Current session itself flagged overload — highest confidence
  if (input.currentSessionFlag === 'flag') {
    return {
      silenced: true,
      reason: 'session_flagged',
      message: messageForReframeRiskReason('session_flagged'),
    }
  }

  // 2. Repeated overload — multiple recent 'flag' rows in the window
  const recentFlagCount = input.recentCompletionFlags
    .slice(0, REFRAME_RISK.REPEATED_OVERLOAD_WINDOW)
    .filter(f => f === 'flag')
    .length
  if (recentFlagCount >= REFRAME_RISK.REPEATED_OVERLOAD_FLAG_COUNT) {
    return {
      silenced: true,
      reason: 'repeated_overload',
      message: messageForReframeRiskReason('repeated_overload'),
    }
  }

  // 3. Fatigue accumulation — N consecutive Heavy/Wrecked tags from the top
  let consecutiveHeavy = 0
  for (const tag of input.recentFatigueTags) {
    if (tag === 'Heavy' || tag === 'Wrecked') consecutiveHeavy++
    else break
  }
  if (consecutiveHeavy >= REFRAME_RISK.FATIGUE_ACCUMULATION_SESSIONS) {
    return {
      silenced: true,
      reason: 'fatigue_accumulation',
      message: messageForReframeRiskReason('fatigue_accumulation'),
    }
  }

  // 4. Severe HR drift on this session
  if (input.hrDriftBpm != null && Math.abs(input.hrDriftBpm) >= REFRAME_RISK.SEVERE_HR_DRIFT_BPM) {
    return {
      silenced: true,
      reason: 'severe_hr_drift',
      message: messageForReframeRiskReason('severe_hr_drift'),
    }
  }
  if (input.hrDriftPct != null && Math.abs(input.hrDriftPct) >= REFRAME_RISK.SEVERE_HR_DRIFT_PCT) {
    return {
      silenced: true,
      reason: 'severe_hr_drift',
      message: messageForReframeRiskReason('severe_hr_drift'),
    }
  }

  return NO_RISK
}
