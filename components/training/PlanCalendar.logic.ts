// PlanCalendar move-mode day roles — the ONE decision about what a day row is to a staged move.
//
// 🔴 WHY THIS IS A MODULE AND NOT TWO BOOLEANS IN THE JSX (REORDER-BLOCKED-DAY-01, 2026-11-16).
//
// `isMoveTarget` and `isSwapTarget` were derived inline in `WeekCard`'s row loop, from
// `choicesFor()`. A third role was needed — a day the runner declared they cannot train (§18
// `days_cannot_train`) — and a third inline boolean beside two others is how the day row ends up
// with four states nobody can enumerate. There is one verdict now and the component renders it.
//
// 📐 THE MEASUREMENT THAT MADE IT A DEFECT, taken on live data 2026-11-16, not from the item:
// across 563 live plan-weeks belonging to runners who declared blocked days, **1,688 of 3,941 day
// rows (42.8%) are days the runner said they cannot train, and 1,679 of those (99.5%) are EMPTY —
// *because* §18 honoured the constraint.** An empty day is a `move` target, so the engine's own
// compliance was rendered as the most inviting affordance on the screen: a dashed moss outline
// reading "Move here". **7 of 14 live non-superseded overrides took the invitation**, across four
// runners, the most recent 2026-11-14.
//
// ⚠️ THE ITEM SAID THE SAVE WAS REFUSED. IT IS NOT. `handleMove` writes `session_overrides`
// directly and posts `/api/adjust-plan` as `void` (fire-and-forget), so nothing anywhere refuses
// a move onto a blocked day; `INV-PLAN-NO-SESSIONS-ON-BLOCKED-DAYS` runs on GENERATED plans and
// never sees an override. The runner's own constraint is broken silently and persists.
//
// ⚠️ AND THE 9 OCCUPIED BLOCKED DAYS ARE ALL RACES, SO `blocked` IS SCOPED TO AN EMPTY DAY.
// §77 exempts race day from `days_cannot_train` deliberately — a runner who cannot train on
// Wednesdays can still race on one — and every one of the 9 measured occupants is a race. Marking
// an occupied blocked day "blocked" would deny a swap with a session that is legitimately there.
//
// Pure, so it is testable under `environment: 'node'` (there is no jsdom here). The alternative
// was a source assertion, and **a source assertion passes on a comment** (SHEET-RAF-FALLBACK-01).

import { DAY_FULL_NAME, type Day } from '@/lib/plan/days'

/** What a day row is to the staged move. Exactly one of these, always. */
export type MoveDayRole =
  /** An empty day the source may move to: dashed outline, "Move here". */
  | 'move'
  /** An occupied day the source may swap or double with: solid outline, hint on the label. */
  | 'swap'
  /** A day the runner declared they cannot train, and which holds nothing. Says so; inert. */
  | 'blocked'
  /** Not a destination, and nothing to explain: the source's own day, or a day already holding two. */
  | 'none'

export function moveDayRole({ targetDay, blocked, choices, occupied, rowHasSession }: {
  targetDay: string
  /** Normalised through `normaliseDays` by the caller — the free-form wire format never reaches here. */
  blocked: ReadonlySet<Day>
  /** `moveChoices()`'s verdict for this day, or null when the day is not offerable at all. */
  choices: { target: boolean; swap: boolean; both: boolean } | null
  /** Does this DAY hold a non-rest session (any row of a double)? */
  occupied: boolean
  /** Does THIS ROW hold a non-rest session? A day's second row is `undefined` on a single day. */
  rowHasSession: boolean
}): MoveDayRole {
  // 🔴 `choices` IS NULL WHENEVER NO MOVE IS STAGED, SO THIS GUARD COMES FIRST AND THE WHOLE
  // FUNCTION IS ABOUT A STAGED MOVE. My first cut tested `blocked` above it, which made an empty
  // blocked day read 'blocked' on an ordinary render, and the caller then patched that with its own
  // `!!movingDay &&`. **Two places deciding one thing, inside the owner written to stop exactly
  // that** — found reviewing my own diff, not by a failing test, because the rendering was right.
  // ⚠️ In move mode an EMPTY day always has choices (`moveChoices().target` is true when a day is
  // unoccupied), so putting this first costs the blocked arm nothing real.
  if (!choices) return 'none'
  // An empty blocked day is never a destination, whatever `moveChoices` says.
  if (!occupied && blocked.has(targetDay as Day)) return 'blocked'
  if (!occupied) return 'move'
  // `choicesFor` only returns non-null when `moveChoices().target` is true, and on an OCCUPIED day
  // that is true only when swap or both is allowed — so reaching here already means the day accepts
  // the source. Re-testing `choices.swap || choices.both` here would be a second copy of that rule.
  return rowHasSession ? 'swap' : 'none'
}

/**
 * The one spelling of the blocked-day sentence. Second person, present tense, the runner's own
 * setting stated as a fact: it is their rule, not the app's refusal. No link to change it — move
 * mode places a session, and `days_cannot_train` belongs to the Adjust plan door (one job).
 *
 * 🔴 IT SAYS "RUN", NOT "TRAIN", AND THE FIRST DRAFT SAID "TRAIN" AND WAS WRONG ON SCREEN.
 * Strength carries its OWN `unavailable_days` on the strength profile (`packages/strength`), which
 * is a different field from the run plan's `days_cannot_train`, so **a lift can legitimately sit on
 * a run-blocked day** — and `You don't train Thursdays` would then be printed on a row the runner
 * can see has a session on it. ⚠️ It is also what they actually answered: the wizard's `WeekGrid`
 * cycles each day **Rest → Run → Long**, so `days_cannot_train` is "not a run day", nothing wider.
 */
export function blockedDayLine(day: string): string {
  const name = DAY_FULL_NAME[day as Day]
  return name ? `You don't run ${name}s` : "You don't run this day"
}
