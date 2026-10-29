// STRENGTH-SESSION-PARTS-01 (S3 Am.3) — which hard run sits beside a strength day, so a session that lost its heavy
// legs can say why. Read from the run plan the runner will actually run (ADR-016's resolver, with move/swap
// overrides), and classified by `runRoleOf`, the same owner placement uses, on the day's first run as placement does.
//
// ⚠️ It answers only what the line claims: a quality or long run ONE day either side. S2 also blocks heavy legs on a
// long-run day, two days before a hard run, and inside the race cut-off; a hard run one day either side is always a
// blocker, and those others are said as "No heavy legs today." with no reason, rather than a reason that is wrong.
// Client-safe: no Node imports.

import type { Plan } from '@/types/plan'
import type { SessionOverride } from '@/lib/plan/effectiveSessions'
import { getSessionsForDate, parseLocalDate } from '@/lib/plan/weekResolution'
import { runRoleOf } from './runRole'

/** The hard run the day after, else the day before. Null when neither holds one. */
export function hardRunBeside(weeks: Plan['weeks'], overrides: ReadonlyArray<SessionOverride>, isoDate: string): 'quality' | 'long' | null {
  for (const offset of [1, -1]) {
    const d = parseLocalDate(isoDate); d.setDate(d.getDate() + offset)
    const role = runRoleOf(getSessionsForDate(weeks, d, overrides)[0]?.session)
    if (role === 'quality' || role === 'long') return role
  }
  return null
}
