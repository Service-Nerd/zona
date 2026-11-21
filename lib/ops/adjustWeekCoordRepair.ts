/**
 * ADJUST-WEEK-COORD-01 — the predicate for "has a misplaced adjustment been repaired?".
 *
 * Pure, so the hand-over can be proven to give a DIFFERENT answer in the two states before it
 * is run against production (`/build` § 4b). Read by `scripts/measure-adjust-week-coord.ts`;
 * the procedure is `docs/runbooks/adjust-week-coord-repair.md`.
 *
 * A misplaced row has two defects, and a repair must clear both:
 *  1. its WRITE: `applyAdjustmentToPlan` replaced every non-null day of the week keyed
 *     `position + 1` with `sessions_after` (the runner's own week plus a note);
 *  2. its KEY: `week_n` names that later week, so it counts toward that week's
 *     `MAX_ADJUSTMENTS_PER_WEEK` and shows under that week in the change history.
 */
const DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const
const same = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null)

export interface RepairInput {
  /** The live sessions of the week the defect WROTE (keyed `position + 1` at creation). */
  writtenWeekSessions: Record<string, unknown> | undefined
  sessionsAfter: readonly unknown[]
  storedWeekN: number
  /** `week.n` of the week the runner was in when the row was created. */
  runnersWeekN: number
}

export interface RepairState {
  /** Days of the written week that still deep-equal what the defect wrote. */
  writeStillPresentDays: number
  writtenDays: number
  keyCorrected: boolean
  repaired: boolean
}

export function repairState(i: RepairInput): RepairState {
  const written = DAYS.filter((_, k) => i.sessionsAfter[k] != null)
  const still = written.filter(d => same(i.writtenWeekSessions?.[d], i.sessionsAfter[DAYS.indexOf(d)])).length
  const keyCorrected = i.storedWeekN === i.runnersWeekN
  return { writeStillPresentDays: still, writtenDays: written.length, keyCorrected, repaired: still === 0 && keyCorrected }
}
