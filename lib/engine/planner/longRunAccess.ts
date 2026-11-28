// FREE — infrastructure. ADR-027 B4e (ADR027-B4E-LONGRUN-ACCESS): L3's long-run accessor.
//
// "Which session is the long run of this week?" — one owner, where the engine had EIGHT.
//
// 🔴 EIGHT ANSWERERS, THREE SHAPES, AND MY FIRST COUNT SAID FOUR.
//   · two local `const longRunOf` → `Session | null`, identical to each other
//   · one local `const longRunOf` → `{ day, session } | null`
//   · a module-level `longRunOfWeek` → `{ day, session } | null`, identical to it
//   · a local `const findLong` → `{ day, session } | null`, **byte-identical to it again**
//   · a local `const lrOf` → `Session | undefined`
//   · three inline `.find(sn => sn && isLongRun(sn))` expressions
// 📐 **All eight behaviourally identical** — first `isLongRun` match in the session object's own key
// order. 29 call sites reach one owner now (comments stripped).
//
// 🔴 I PUBLISHED "FOUR" AND CODE REVIEW FOUND THE OTHER FOUR, FIVE OF WHICH HAD NO NAME AT ALL.
// Third count I got wrong in the same direction in one day: `sumWeeklyKm`'s docstring said its
// predicate "appears three times" and it appeared twelve; `weekdayCap.ts` called itself "the engine's
// only capacity reader" and was one of four. **A single-ownership claim has to be counted by SHAPE,
// not by name** — hence the gate pinning the `isLongRun` use count with every survivor categorised.
// ⚠️ And that pinned number was wrong on its first writing too: 18 from a raw `grep`, **17** after
// stripping comments, because one `isLongRun` sits inside a comment. `HOOK-RGBA-COMMENTS-01`, in the
// same breath as building a gate to stop exactly this.
//
// They agreed by accident of having been written the same way eight times. `DELOAD-OWNER-01` was
// five copies of one expression "agreeing only by accident of surrounding control flow";
// `SESSION-KM-01/02` was six by hand plus fourteen with an incompatible answer. This is that setup,
// before it bit.
//
// ⚠️ TWO LOOPS ARE A DIFFERENT QUESTION AND STAY WHERE THEY ARE. `:4251` takes a max across EVERY
// long run in the week, and `applyRacePaceSegmentDuration` processes each one. "Every long run" is
// not "the long run" — and that they exist at all is evidence a week CAN hold more than one, which is
// the hazard the divergence note on `computeLongRunHrs` records.
//
// ⚠️ WHY THIS CAME FIRST, AHEAD OF THE POST-PASSES IT WAS MEANT TO UNBLOCK. The long-run cap group
// (`applyTaperLongRunCap`, `applyLongRunStepBacks`, `applyLongRunProgressionCap`) was the intended
// brick; ARCH-ENG-001 forbids L3 importing `ruleEngine.ts`, so the accessors move or the passes
// cannot. 🔴 As first written that rationale was true of only ONE of the three — the other two held
// their OWN copies (`findLong`, an inline finder), which is the same finding from the other side.
// Folding those in made the sentence true: all three now reach the owner (2, 4 and 2 call sites).
//
// 🔻 INSERTION ORDER IS PRESERVED EXACTLY, AND IT IS A LATENT FRAGILITY RATHER THAN A CHOICE.
// All eight iterated `Object.entries(w.sessions)` / `Object.values(w.sessions)`, i.e. the order the
// keys were written. Iterating `DAY_ORDER` instead would be deterministic by construction and would
// change the answer for any week carrying two `isLongRun` sessions out of day order — so it is NOT
// done here: that is a prescription change, not a move, and `verify:parity` would show it.
// Recorded rather than silently "improved".
//
// ⚠️ `lib/scorecard/metrics.ts` HAS ITS OWN `longRunOf` AND IT MUST NOT BE MERGED INTO THIS.
// It reads `runsOf(w)`, which iterates `DAYS` in calendar order and excludes non-run types — a
// different population in a different order, for the measurement layer. Same §121 reasoning as
// `sumWeeklyKm`'s look-alikes: the same name over a different question is not a duplicate.
// Two scripts and one test hold their own too; those are throwaway and out of scope.

import { isLongRun } from '@/lib/plan/sessionRole'
import type { Day } from '@/lib/plan/days'
import type { PaceGuide } from '@/lib/plan/paceBands'
import type { Session, Week } from '@/types/plan'

/** The long run of this week, with the day it sits on. `null` when the week has none — which is a
 *  real answer for a race week, a maintenance week, or a week whose long run was dropped. */
export function longRunOf(week: Week): { day: Day; session: Session } | null {
  for (const [d, s] of Object.entries(week.sessions) as [Day, Session | undefined][]) {
    if (s && isLongRun(s)) return { day: d, session: s }
  }
  return null
}

/** The same question, for the callers that do not need the day. A wrapper, deliberately — two
 *  shapes over one answer is what the four copies had, and only one of them may do the finding. */
export function longRunSessionOf(week: Week): Session | null {
  return longRunOf(week)?.session ?? null
}

/**
 * The long run's duration in hours, to one decimal — the producer of `week.long_run_hrs`.
 *
 * ⚠️ It takes `sessions`, not a `Week`, because of its **10** call sites **exactly one** holds a
 * session map being built and has no week yet (`ruleEngine.ts:7309`). 📐 The first draft of this line
 * said "two of its eleven", wrong on both numbers; code review measured it.
 * ⚠️ A distance-anchored session is priced at the EASY pace, and a session with neither duration nor
 * distance returns `null`, never 0 — `SESSION-KM-01`'s rule: absence is not "covered no ground".
 *
 * 🔴 AND IT DOES NOT ALWAYS DESCRIBE THE SAME SESSION `longRunOf` RETURNS, which co-locating them
 * made visible. `longRunOf` takes the FIRST `isLongRun` session; this one SKIPS a session with
 * neither anchor and prices the next. So on a week holding two long runs where the first is
 * anchorless, `week.long_run_hrs` describes a different session from the one the cap passes operate
 * on. ⚠️ Pre-existing, not introduced here, and **no invariant forbids two long runs in a week** —
 * the two "every long run" loops named above exist precisely because they can. Filed as
 * `LONG-RUN-HRS-SECOND-SESSION-01`; not reconciled inside a move, because picking either reading
 * changes a rendered number.
 */
export function computeLongRunHrs(sessions: Partial<Record<Day, Session>>, pace: PaceGuide): number | null {
  for (const session of Object.values(sessions)) {
    if (session != null && isLongRun(session)) {
      const mins = session.duration_mins ?? (session.distance_km ? session.distance_km * pace.minPerKmEasy : null)
      if (mins) return Math.round((mins / 60) * 10) / 10
    }
  }
  return null
}
