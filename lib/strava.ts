import type { StravaActivity } from '@/types/plan'

const CLIENT_ID     = process.env.NEXT_PUBLIC_STRAVA_CLIENT_ID!
const CLIENT_SECRET = process.env.STRAVA_CLIENT_SECRET!

export async function getStravaToken(refreshToken: string): Promise<{ access_token: string; expires_at: number }> {
  const res = await fetch('https://www.strava.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
    cache: 'no-store',
  })
  const data = await res.json()
  if (!data.access_token) throw new Error('Failed to get Strava token')
  // expires_at is a Unix timestamp (seconds) from Strava — typically now + 21600 (6 hours)
  return { access_token: data.access_token, expires_at: data.expires_at ?? Math.floor(Date.now() / 1000) + 21600 }
}

export async function fetchActivities(accessToken: string, afterDate = '2026-01-01'): Promise<StravaActivity[]> {
  const after = Math.floor(new Date(afterDate).getTime() / 1000)
  const res = await fetch(
    `https://www.strava.com/api/v3/athlete/activities?after=${after}&per_page=100`,
    { headers: { Authorization: `Bearer ${accessToken}` }, cache: 'no-store' }
  )
  const data = await res.json()
  if (!Array.isArray(data)) throw new Error('Bad Strava response')
  return data as StravaActivity[]
}

export interface HRStreamSummary {
  /** % of samples in Z2 (legacy Z2-anchored figure — kept for backward compat
   *  with cohort comparisons in runHistory that don't have session prescription). */
  inZonePct:  number
  /** % of samples above the Z2 ceiling. */
  abovePct:   number
  /** % of samples below the Z2 floor. */
  belowPct:   number
  /** Full per-zone histogram. The four pcts sum to 100. /api/analyse-run picks
   *  the right pct based on the matched session's prescribed zone, then writes
   *  run_analysis.hr_in_zone_pct as "% in prescribed zone". */
  histogram: ZoneHistogram
}

export interface ZoneHistogram {
  pctZ1:    number
  pctZ2:    number
  pctZ3:    number
  pctZ4_5:  number
}

export interface HRZones {
  /** Top of Zone 2 (per plan). If null, falls back to 76% of maxHR. */
  zone2Ceiling: number | null
  /** Max HR (per plan). Used to derive the Z2 floor (60%) and the Z3/Z4-5 boundaries.
   *  When null, the only band we can resolve is Z2 (no floor, no upper bands). */
  maxHR:        number | null
}

/**
 * Pure zone-bucketing kernel: given an array of HR samples and the user's plan zones,
 * returns the in/above/below percentages PLUS the full per-zone histogram.
 *
 * Source-agnostic — used by both Strava streams (1Hz) and HealthKit HR samples
 * (variable interval). Equal-weight bucketing per sample.
 *
 * Band boundaries (matches CoachingPrinciples / zoneRules.ts):
 *   Z1: below 60% maxHR (or below the Z2 floor)
 *   Z2: 60–76% maxHR    (or up to the configured zone2Ceiling)
 *   Z3: 76–86% maxHR
 *   Z4-5: 86%+ maxHR
 *
 * When maxHR is unknown, the histogram collapses to two buckets (Z2 vs above
 * ceiling) and we don't pretend to know the Z3/Z4-5 split — the missing pcts
 * land in Z4_5 as a single "above" bucket so the histogram still sums to 100.
 */
export function bucketHRSamples(hrData: number[], zones: HRZones): HRStreamSummary | null {
  if (!hrData?.length) return null
  const ceiling = zones.zone2Ceiling ?? (zones.maxHR ? Math.round(zones.maxHR * 0.76) : null)
  const floor   = zones.maxHR ? Math.round(zones.maxHR * 0.60) : null
  if (!ceiling) return null

  const total = hrData.length

  // Z2-anchored counts — legacy fields.
  const inZoneCount = hrData.filter(hr => (!floor || hr >= floor) && hr <= ceiling).length
  const aboveCount  = hrData.filter(hr => hr > ceiling).length
  const belowCount  = floor ? hrData.filter(hr => hr < floor).length : 0

  // Full histogram. When maxHR is unknown we can't split the "above ceiling"
  // bucket between Z3 and Z4-5 — lump it under Z4-5 so the sum stays at 100.
  const z3Boundary    = zones.maxHR ? Math.round(zones.maxHR * 0.86) : null
  let pctZ1Count = belowCount
  let pctZ2Count = inZoneCount
  let pctZ3Count = 0
  let pctZ4_5Count = 0
  if (z3Boundary != null) {
    pctZ3Count   = hrData.filter(hr => hr > ceiling && hr <= z3Boundary).length
    pctZ4_5Count = hrData.filter(hr => hr > z3Boundary).length
  } else {
    pctZ4_5Count = aboveCount
  }

  return {
    inZonePct:  Math.round((inZoneCount / total) * 100 * 100) / 100,
    abovePct:   Math.round((aboveCount  / total) * 100 * 100) / 100,
    belowPct:   Math.round((belowCount  / total) * 100 * 100) / 100,
    histogram: {
      pctZ1:   Math.round((pctZ1Count   / total) * 100 * 100) / 100,
      pctZ2:   Math.round((pctZ2Count   / total) * 100 * 100) / 100,
      pctZ3:   Math.round((pctZ3Count   / total) * 100 * 100) / 100,
      pctZ4_5: Math.round((pctZ4_5Count / total) * 100 * 100) / 100,
    },
  }
}

/** Reads the user's HR zones. Source of truth: live user_settings.resting_hr
 *  + user_settings.max_hr (Karvonen 70% ceiling). Falls back to the baked
 *  plan.meta.zone2_ceiling when user_settings HR is missing — that path
 *  exists for users who haven't set HR in profile yet. The plan-meta value
 *  can drift after a user updates their resting/max HR; reading live
 *  user_settings keeps the bucketing in lockstep with what the UI shows. */
export async function getUserHRZones(supabase: any, userId: string): Promise<HRZones> {
  const [settingsRes, planRes] = await Promise.all([
    supabase.from('user_settings').select('resting_hr, max_hr').eq('id', userId).single(),
    supabase.from('plans').select('plan_json').eq('user_id', userId).single(),
  ])
  const restingHR = settingsRes.data?.resting_hr ?? null
  const maxHR     = settingsRes.data?.max_hr     ?? planRes.data?.plan_json?.meta?.max_hr ?? null
  if (restingHR && maxHR) {
    return {
      zone2Ceiling: Math.round(restingHR + 0.70 * (maxHR - restingHR)),
      maxHR,
    }
  }
  return {
    zone2Ceiling: planRes.data?.plan_json?.meta?.zone2_ceiling ?? null,
    maxHR,
  }
}

/** Fetches Strava HR stream and computes zone breakdown against the user's plan zones. */
export async function fetchHRStreamSummary(
  supabase: any,
  accessToken: string,
  activityId: number,
  userId: string,
): Promise<HRStreamSummary | null> {
  try {
    const zones = await getUserHRZones(supabase, userId)

    const streamRes = await fetch(
      `https://www.strava.com/api/v3/activities/${activityId}/streams?keys=heartrate,time&key_by_type=true`,
      { headers: { Authorization: `Bearer ${accessToken}` }, cache: 'no-store' }
    )
    if (!streamRes.ok) return null

    const streams = await streamRes.json()
    const hrData: number[] = streams?.heartrate?.data
    return bucketHRSamples(hrData, zones)
  } catch {
    return null
  }
}

export function getRuns(activities: StravaActivity[]) {
  return activities
    .filter(a => a.type === 'Run' || a.sport_type === 'Run')
    .sort((a, b) => new Date(b.start_date).getTime() - new Date(a.start_date).getTime())
}

export function formatDuration(seconds: number) {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  return h > 0 ? `${h}h${String(m).padStart(2, '0')}` : `${m}min`
}

export function formatPace(movingTime: number, distanceM: number) {
  if (!distanceM) return '—'
  const secPerKm = movingTime / (distanceM / 1000)
  const min = Math.floor(secPerKm / 60)
  const sec = Math.round(secPerKm % 60)
  return `${min}:${String(sec).padStart(2, '0')}/km`
}

export function hrColour(hr: number | undefined) {
  if (!hr) return 'var(--text-dim)'
  if (hr <= 145) return 'var(--green)'
  if (hr <= 158) return 'var(--yellow)'
  return 'var(--coral)'
}

// Pace at a given HR band — aerobic efficiency metric
export function paceAtHR(runs: StravaActivity[], lowHR = 135, highHR = 155) {
  const sample = runs
    .filter(r => r.average_heartrate && r.average_heartrate >= lowHR && r.average_heartrate <= highHR && r.moving_time > 0 && r.distance > 2000)
    .slice(0, 6)
  if (!sample.length) return null
  const avgSecPerKm = sample.reduce((s, r) => s + r.moving_time / (r.distance / 1000), 0) / sample.length
  const min = Math.floor(avgSecPerKm / 60)
  const sec = Math.round(avgSecPerKm % 60)
  return `${min}:${String(sec).padStart(2, '0')}`
}
