// STRENGTH-ENGINE-01 — what role a run plays for strength placement, from the run session. The single owner: placement
// (`runContext.ts`) and the session screen's no-legs reason (`hardRunBeside.ts`) both read it. Split out of
// `runContext.ts` (STRENGTH-SESSION-PARTS-01) because that file imports `node:crypto` and the screen runs in the browser.

import type { Session } from '@/types/plan'
import { isLongRun, isHardEffort } from '@/lib/plan/sessionRole'
import type { RunRole } from '@/packages/strength'

export function runRoleOf(s: Session | null | undefined): RunRole {
  if (!s || s.type === 'rest') return 'rest'
  if (s.type === 'race') return 'race'
  if (s.type === 'strength' || s.type === 'cross-train') return 'cross'
  if (isLongRun(s)) return 'long'
  if (isHardEffort(s)) return 'quality'
  if (s.type === 'recovery') return 'recovery'
  return 'easy'
}
