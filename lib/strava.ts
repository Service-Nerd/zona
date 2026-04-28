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
  inZonePct:  number
  abovePct:   number
  belowPct:   number
}

/** Fetches Strava HR stream and computes zone breakdown against the user's plan zones. */
export async function fetchHRStreamSummary(
  supabase: any,
  accessToken: string,
  activityId: number,
  userId: string,
): Promise<HRStreamSummary | null> {
  try {
    const { data: planRow } = await supabase
      .from('plans')
      .select('plan_json')
      .eq('user_id', userId)
      .single()

    const zone2Ceiling: number | null = planRow?.plan_json?.meta?.zone2_ceiling ?? null
    const maxHR: number | null        = planRow?.plan_json?.meta?.max_hr ?? null

    const streamRes = await fetch(
      `https://www.strava.com/api/v3/activities/${activityId}/streams?keys=heartrate,time&key_by_type=true`,
      { headers: { Authorization: `Bearer ${accessToken}` }, cache: 'no-store' }
    )
    if (!streamRes.ok) return null

    const streams = await streamRes.json()
    const hrData: number[] = streams?.heartrate?.data
    if (!hrData || !hrData.length) return null

    const ceiling = zone2Ceiling ?? (maxHR ? Math.round(maxHR * 0.76) : null)
    const floor   = maxHR ? Math.round(maxHR * 0.60) : null
    if (!ceiling) return null

    const total  = hrData.length
    const inZone = hrData.filter(hr => (!floor || hr >= floor) && hr <= ceiling).length
    const above  = hrData.filter(hr => hr > ceiling).length
    const below  = floor ? hrData.filter(hr => hr < floor).length : 0

    return {
      inZonePct: Math.round((inZone / total) * 100 * 100) / 100,
      abovePct:  Math.round((above  / total) * 100 * 100) / 100,
      belowPct:  Math.round((below  / total) * 100 * 100) / 100,
    }
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
