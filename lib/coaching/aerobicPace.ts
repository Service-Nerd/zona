// Extracted from DashboardClient.tsx — canonical location going forward.

import type { StravaActivity } from '@/types/plan'

/** Returns aerobic pace bracket derived from Strava runs in the user's Z2 HR band. */
export function computeAerobicPace(
  runs: StravaActivity[] | null,
  restingHR: number | null,
  maxHR: number | null,
  preferredUnits: 'km' | 'mi' = 'km',
): string | null {
  if (!runs || !runs.length || !restingHR || !maxHR) return null
  const hrr = maxHR - restingHR
  const lo  = Math.round(restingHR + 0.60 * hrr)
  const hi  = Math.round(restingHR + 0.70 * hrr)
  const sample = runs
    .filter(r => r.average_heartrate && r.average_heartrate >= lo && r.average_heartrate <= hi
      && r.moving_time > 0 && r.distance > 2000)
    .slice(0, 6)
  if (!sample.length) return null
  const avgSecPerKm = sample.reduce((s, r) => s + r.moving_time / (r.distance / 1000), 0) / sample.length
  const sec  = preferredUnits === 'mi' ? avgSecPerKm * 1.60934 : avgSecPerKm
  const unit = preferredUnits === 'mi' ? '/mi' : '/km'
  return `${Math.floor(sec / 60)}:${String(Math.round(sec % 60)).padStart(2, '0')}${unit}`
}
