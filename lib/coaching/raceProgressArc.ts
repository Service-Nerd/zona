// Race progress arc — "where I was · where I am · what I'm aiming at".
//
// UX-COACH-01. The founder's ask, verbatim: "This is where I was, I am and what
// the potential is." Until 2026-09-12 the Coach screen had none of it: the card
// rendered ONE number (current) plus a compressed delta chip, while the API was
// already sending `baselineSeconds` — typed by the component and drawn by
// nothing — and the goal was never read off the plan at all.
//
// ⚠️ §109 BOUNDS THIS SURFACE: it may REMEMBER and COMPARE, it may not PREDICT.
// So every point here is a fact the runner already owns:
//   · was  — the plan-start estimate, derived from `meta.vdot` at generation
//   · now  — measured fitness today, carrying its own confidence label
//   · goal — the runner's OWN `meta.target_time`, a choice, not a forecast
// There is deliberately no fourth "projected race-day finish" point and no
// rising line toward the race date. That would be fabricated precision (§44.1).
//
// Pure and separately testable ON PURPOSE. The previous version of this logic
// lived inline in `app/api/race-times/route.ts`, where nothing could assert on
// it, and the "arc" shipped as a comment above an unchanged component.

/** Display significance floor. Below this, a delta is clock noise, not news. */
export const RACE_ARC = {
  /** Seconds of change required before the arc calls a direction at all. */
  SIGNIFICANT_DELTA_SEC: 30,
} as const

export type ArcPointKey = 'was' | 'now' | 'goal'

export interface ArcPoint {
  key: ArcPointKey
  seconds: number
}

export type ArcDirection = 'faster' | 'slower' | 'level'

export interface RaceProgressArc {
  /** Chronological: was → now → goal. Always contains `now`; 1–3 entries. */
  points: ArcPoint[]
  /** Signed seconds from baseline to now. Negative = faster. Null without a baseline. */
  deltaSeconds: number | null
  /** Direction of travel, significance-gated. Null without a baseline. */
  direction: ArcDirection | null
  /** Positive seconds still between `now` and `goal`. 0 when the goal is met or beaten. */
  secondsToGoal: number | null
  /** True when current fitness already projects at or inside the chosen goal. */
  goalReached: boolean | null
}

function isUsable(v: number | null | undefined): v is number {
  return typeof v === 'number' && Number.isFinite(v) && v > 0
}

/**
 * Assemble the arc from the three times the app already knows.
 *
 * Returns `null` when there is no `now` — without a measured present there is
 * no "where I am", and an arc of remembered points alone would be a museum.
 * A missing baseline or goal drops that point and keeps the rest: a week-one
 * runner with no history still sees today and what they're chasing.
 */
export function buildRaceProgressArc(input: {
  baselineSeconds: number | null | undefined
  currentSeconds:  number | null | undefined
  goalSeconds:     number | null | undefined
}): RaceProgressArc | null {
  const now = input.currentSeconds
  if (!isUsable(now)) return null

  const was  = isUsable(input.baselineSeconds) ? input.baselineSeconds : null
  const goal = isUsable(input.goalSeconds)     ? input.goalSeconds     : null

  const points: ArcPoint[] = []
  if (was !== null) points.push({ key: 'was', seconds: was })
  points.push({ key: 'now', seconds: now })
  if (goal !== null) points.push({ key: 'goal', seconds: goal })

  // Signed so callers cannot lose the direction the way Math.abs() does.
  const deltaSeconds = was !== null ? now - was : null
  const direction: ArcDirection | null =
    deltaSeconds === null                                          ? null
    : Math.abs(deltaSeconds) < RACE_ARC.SIGNIFICANT_DELTA_SEC      ? 'level'
    : deltaSeconds < 0                                             ? 'faster'
    :                                                                'slower'

  const secondsToGoal = goal !== null ? Math.max(0, now - goal) : null
  const goalReached   = goal !== null ? now <= goal : null

  return { points, deltaSeconds, direction, secondsToGoal, goalReached }
}
