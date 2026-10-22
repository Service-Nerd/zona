// Hand-authored completion copy keyed by session type. Used on the
// post-log reflect view, on SessionCompleteCard (COMPLETE-01), and on
// the share-image OG route (SAVE-IMG-01).
//
// Rule-engine output — never marked with AIMark.
// Voice rules from CLAUDE.md / brand.md apply.

import { isLongRun } from '@/lib/plan/sessionRole'
import { ZONE_HELD_MAX_ABOVE_CEILING_PCT } from './constants'
import type { ClassifiableSession } from '@/lib/session-types'

// COMPLETION-COPY-CLAIM-01 (§12 Amendment 4, Coaching Board 2026-10-22). "Kept it easy." is the only line here that says
// how the run WENT, so it is praise, and §12 Am.2 makes praise need evidence: every source the app holds must agree
// (heart rate at or under the praise threshold above the ceiling; the runner's own RPE at or under the session's own
// `rpe_target`) and none may disagree. No evidence, or any disagreement, gets the neutral line: it was done, no effort
// claim, no cause (P-04). A body naming a zone needs heart rate. Every other line only says the session happened.
//
// The neutral words were approved by the founder on 2026-10-22.
export interface CompletionEvidence {
  /** `run_analysis.hr_above_ceiling_pct`, or the trace's own share. Null when the run has no heart rate. */
  abovePct?: number | null
  /** The runner's logged RPE. */
  rpe?: number | null
}

const EASY_PRAISE = { headline: 'Kept it easy.', body: "That's where the fitness is built. Zone 2 does its work quietly." }
const EASY_PRAISE_NO_HR = { headline: 'Kept it easy.', body: "That's where the fitness is built." }
const EASY_NEUTRAL = { headline: 'Easy run done.', body: "Next one when you're ready." }

function easyCopy(session: { rpe_target?: number | null } | null, ev: CompletionEvidence): { headline: string; body: string } {
  const hr = ev.abovePct != null && Number.isFinite(ev.abovePct) ? ev.abovePct <= ZONE_HELD_MAX_ABOVE_CEILING_PCT : null
  const target = session?.rpe_target
  const feel = ev.rpe != null && target != null ? ev.rpe <= target : null
  if (hr === false || feel === false || (hr == null && feel == null)) return EASY_NEUTRAL
  return hr ? EASY_PRAISE : EASY_PRAISE_NO_HR
}

export function getCompletionCopy(
  session: (ClassifiableSession & { rpe_target?: number | null }) | string,
  evidence: CompletionEvidence = {},
): { headline: string; body: string } {
  // A long run is `type: 'easy'` (§52/§9), so the long copy is chosen by role, never by type.
  if (typeof session !== 'string' && isLongRun(session)) return getCompletionCopy('long')
  const type = typeof session === 'string' ? session : (session.type ?? '')
  const s = typeof session === 'string' ? null : session
  switch (type) {
    case 'easy':
    case 'run':      return easyCopy(s, evidence)
    case 'long':     return { headline: 'Long one done.',          body: "Resist the urge to add miles tomorrow. The adaptation happens now." }
    case 'quality':
    case 'tempo':    return { headline: 'Hard session logged.',    body: "Earn that rest. Don't follow it with more effort." }
    case 'intervals':
    case 'hard':     return { headline: 'That was the hard part.', body: "The next 48 hours are when your body catches up. Let it." }
    case 'race':     return { headline: 'Race done.',              body: "Whatever happened, happened. You showed up and finished." }
    case 'recovery': return { headline: 'Recovery done.',          body: "More useful than it felt. That one counts." }
    case 'strength': return { headline: 'Strength session done.',  body: "The legs will thank you when it matters." }
    default:         return { headline: 'Session done.',           body: "Next one when you're ready." }
  }
}
