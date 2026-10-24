// SESSION-SLOTS-01 Phase 2 (ADR-025) — the Coaching Board's doubles ruling, as code.
// Ruling: docs/decisions/same-day-doubles-coaching-2026-10-17.md (CORRECT WITH AMENDMENT). §126.
//
// A double is two runs on one day, made by the RUNNER moving a run onto a day that already has one.
// The engine never prescribes one. Allowed only when BOTH runs are easy or recovery runs; never the
// long run, a quality or structured session, a race or the 5K time trial; never in race week.
//
// One owner of the rule (`canDouble`), read by `resolveEffectiveDay`. The CHECK below re-derives the
// rule from the session fields on its own, because a checker that calls the producer's predicate
// cannot catch the producer being wrong (DELOAD-OWNER-01).

import type { Session, Week } from '@/types/plan'
import { GENERATION_CONFIG } from './generationConfig'
import { formatDuration } from '@/lib/format'
import { coachingSessionType, isLongRun, isStructuredSession, isTimeTrial, isHardDay } from './sessionRole'

type DoubleWeek = Pick<Week, 'sessions'> & { type?: string; badge?: string }

/** Race week is for shakeouts (§6): no doubles in it. */
export function isRaceWeek(week: DoubleWeek): boolean {
  return week.type === 'race' || week.badge === 'race'
}

/** A run that may share its day with another: an easy or recovery run, nothing that loads. */
function doublable(s: Session): boolean {
  if (isLongRun(s) || isStructuredSession(s) || isTimeTrial(s)) return false
  const t = coachingSessionType(s)
  return t === 'easy' || t === 'recovery'
}

/** May these two sessions share one day? (§126) */
export function canDouble(a: Session | undefined, b: Session | undefined, week: DoubleWeek): boolean {
  if (!a || !b || isRaceWeek(week)) return false
  return doublable(a) && doublable(b)
}

/**
 * The advice a double carries (§126). Advice only: the app has no time of day (ADR-011), so the gap
 * cannot be enforced, and Sims's condition is that eating between them is named. Never presented as
 * extra training (Hutchinson). Rendered by the Phase 3 move flow.
 */
export function doubleAdvice(): string {
  // ADR-015: the duration goes through the one formatter ("6h"), never a welded unit.
  return `Two easy runs today. Leave at least ${formatDuration(GENERATION_CONFIG.DOUBLE_RUN_MIN_GAP_HOURS * 60)} between them, and eat in between.`
}

export interface DoubleViolation { code: 'CHECK-EFFECTIVE-NO-HARD-DOUBLE'; day: string; detail: string }

/**
 * CHECK-EFFECTIVE-NO-HARD-DOUBLE — the EFFECTIVE week (moves applied) never holds a double the ruling
 * forbids, and never more than two sessions on a day. Reads the raw fields itself: it shares no
 * predicate with `canDouble`.
 */
export function effectiveDoubleViolations(
  week: DoubleWeek,
  effective: Partial<Record<string, { session: Session }[]>>,
): DoubleViolation[] {
  const out: DoubleViolation[] = []
  const raceWeek = week.type === 'race' || week.badge === 'race'
  const hard = (s: Session) =>
    s.type === 'race' || isHardDay(s) || !(s.type === 'easy' || s.type === 'recovery')
  for (const [day, list] of Object.entries(effective)) {
    if (!list || list.length < 2) continue
    if (list.length > 2) out.push({ code: 'CHECK-EFFECTIVE-NO-HARD-DOUBLE', day, detail: `${list.length} sessions on one day` })
    if (raceWeek) out.push({ code: 'CHECK-EFFECTIVE-NO-HARD-DOUBLE', day, detail: 'a double in race week' })
    for (const { session } of list) {
      if (hard(session)) out.push({ code: 'CHECK-EFFECTIVE-NO-HARD-DOUBLE', day, detail: `${session.type}${session.role ? `/${session.role}` : ''} in a double` })
    }
  }
  return out
}

/** The runner-facing slot label (Design Board, SESSION-SLOTS-01). Never colour alone: the label carries it. */
export const SLOT_LABEL: Record<'am' | 'pm', string> = { am: 'AM', pm: 'PM' }

/**
 * What the move-confirm row may offer (Design Board, Pattern 10b amended). `swap` keeps today's
 * meaning and stays the primary; `both` (a double, the mover takes PM) appears only when §126 allows
 * it and the target holds exactly one session; a day already holding two is not a target at all.
 */
export function moveChoices(
  source: Session | undefined, targetSessions: readonly Session[], week: DoubleWeek,
  /** The source is one half of a double. It may leave (move) or join another easy run (both), never
   *  swap: the swapped-in session would land beside the half left behind, unslotted, and become a
   *  third collision the resolver turns back into a swap. */
  sourceSharesDay = false,
): { target: boolean; swap: boolean; both: boolean } {
  if (targetSessions.length >= 2) return { target: false, swap: false, both: false }
  const occupant = targetSessions[0]
  const occupied = !!occupant && occupant.type !== 'rest'
  const swap = occupied && !sourceSharesDay
  const both = occupied && canDouble(occupant, source, week)
  return { target: !occupied || swap || both, swap, both }
}
