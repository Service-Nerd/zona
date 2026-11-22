// DASHBOARD-RUNS-STALE-HR-01 — the one owner of "does a refreshed HealthKit run list replace the one on screen".
//
// `refreshHealthKitRuns` replaced the list only when a run uuid appeared that the screen did not already hold. Heart
// rate arrives AFTER the workout (Apple Watch samples land in batches, `hr_arrived_late_at`), so a run already on screen
// is patched in the database and never again on the screen: a warm app showed no HR for a run whose HR had landed
// minutes earlier, until it was reloaded. Measured 2026-11-22: a 15.7 km run stored avg_hr 153 and the screen held null.
//
// The fields below are every one the mapper produces. A new uuid still replaces, as before.

export interface HkRunLike {
  id: string
  source?: string
  average_heartrate?: number | null
  max_heartrate?: number | null
  moving_time?: number | null
  elapsed_time?: number | null
  distance?: number | null
  reported_distance?: number | null
  total_elevation_gain?: number | null
  average_speed?: number | null
  name?: string | null
}

// EVERY field `refreshHealthKitRuns` maps out of the row, so a late patch to any of them reaches a warm screen.
const PATCHABLE = ['average_heartrate', 'max_heartrate', 'moving_time', 'elapsed_time', 'distance', 'reported_distance', 'total_elevation_gain', 'average_speed', 'name'] as const

/** True when `next` holds a run the screen lacks, or a held run whose patchable fields now differ. */
export function healthKitRunsChanged(prev: HkRunLike[], next: HkRunLike[]): boolean {
  const held = new Map(prev.filter(r => r.source === 'apple_health').map(r => [r.id, r]))
  return next.some(n => {
    const p = held.get(n.id)
    if (!p) return true
    return PATCHABLE.some(k => (p[k] ?? null) !== (n[k] ?? null))
  })
}

/** The list to hold: HealthKit runs from `next`, every other run from `prev`; `prev` itself when nothing changed. */
export function mergeHealthKitRuns<T extends HkRunLike>(prev: T[] | null, next: T[]): T[] {
  if (!prev) return next
  if (!healthKitRunsChanged(prev, next)) return prev
  return [...next, ...prev.filter(r => r.source !== 'apple_health')]
}
