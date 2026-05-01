import type { StravaActivity } from '@/types/plan'
import { EF_BASELINE_WINDOW } from './constants'

/**
 * Aerobic Efficiency (EF) = average speed (m/s) / average HR.
 * Higher = more efficient (faster at same HR).
 */
export function computeEF(activity: StravaActivity): number | null {
  if (!activity.average_heartrate || activity.average_heartrate === 0) return null
  if (!activity.average_speed) return null
  return activity.average_speed / activity.average_heartrate
}

/**
 * Rolling baseline EF for a given session type, from recent activities.
 * Uses last N qualifying runs (runs of same session type / effort character).
 */
export function computeEFBaseline(
  sessionType: string,
  recentActivities: StravaActivity[],
  excludeActivityId?: number | string,
): number | null {
  const qualifying = recentActivities
    .filter(a => {
      if (excludeActivityId && a.id === excludeActivityId) return false
      if (a.type !== 'Run' && a.sport_type !== 'Run') return false
      if (!a.average_heartrate || !a.average_speed) return false
      // For easy/long sessions, use runs where avg HR < 160 (aerobic)
      // For quality/intervals, use runs where avg HR >= 155
      const isAerobicRun = a.average_heartrate < 160
      const isEasyType   = ['easy', 'run', 'long', 'recovery'].includes(sessionType)
      return isEasyType ? isAerobicRun : !isAerobicRun
    })
    .slice(0, EF_BASELINE_WINDOW)

  if (qualifying.length < 2) return null

  const efValues = qualifying.map(a => a.average_speed! / a.average_heartrate!).filter(Boolean)
  return efValues.reduce((s, v) => s + v, 0) / efValues.length
}

export function efTrendPct(efValue: number, baseline: number): number {
  if (baseline === 0) return 0
  return ((efValue - baseline) / baseline) * 100
}
