// Extracted from DashboardClient.tsx — canonical location going forward.
// DashboardClient imports from here; do not duplicate.

export type CoachingFlag = 'ok' | 'watch' | 'flag'

/** Pure function — no side effects. Returns null for session types without effort targets. */
export function getCoachingFlag({
  sessionType,
  rpe,
  avgHr,
  zone2Ceiling,
}: {
  sessionType: string
  rpe: number | null
  avgHr: number | null
  zone2Ceiling: number | undefined
}): CoachingFlag | null {
  const isEasy  = ['easy', 'run', 'long', 'recovery'].includes(sessionType)
  const isHard  = ['quality', 'intervals', 'tempo', 'hard'].includes(sessionType)
  const isRace  = sessionType === 'race'

  if (!isEasy && !isHard && !isRace) return null
  if (rpe === null && avgHr === null) return null

  if (isEasy) {
    if (avgHr !== null && zone2Ceiling !== undefined && avgHr > zone2Ceiling) return 'flag'
    if (rpe !== null && rpe >= 7) return 'flag'
    if (rpe !== null && rpe >= 5) return 'watch'
    return 'ok'
  }

  if (isHard) {
    if (rpe !== null && rpe <= 3) return 'watch'
    return 'ok'
  }

  // race
  if (rpe !== null && rpe <= 4) return 'watch'
  return 'ok'
}
