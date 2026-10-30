// COACH-READ-BUTTON-01 (founder, Option A, 2026-10-30): Kit's weekly read has no button. It writes itself when the week
// has no read, and updates itself when a run has landed since it was written. The route caps a rewrite at once a day
// (`refresh_blocked`), so this costs at most one extra model call per runner per day, and only on a day they ran.

export type CoachReadAction = 'none' | 'write' | 'update'

export interface CoachReadState {
  /** The card's own gate: a source, at least one run, resting and max HR. Below it the card shows an empty state. */
  ready: boolean
  /** A read exists for this week. */
  reportIsCurrent: boolean
  /** When this week's read was written (ISO). */
  generatedAt: string | null | undefined
  /** Start times (ISO) of the runner's runs. */
  runStarts: readonly (string | null | undefined)[]
}

export function coachReadAction({ ready, reportIsCurrent, generatedAt, runStarts }: CoachReadState): CoachReadAction {
  if (!ready) return 'none'
  if (!reportIsCurrent) return 'write'
  if (!generatedAt) return 'none'
  const written = new Date(generatedAt).getTime()
  return runStarts.some(t => t != null && new Date(t).getTime() > written) ? 'update' : 'none'
}
