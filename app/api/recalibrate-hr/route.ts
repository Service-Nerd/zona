/**
 * POST /api/recalibrate-hr
 *
 * Called (fire-and-forget) after the user updates their resting HR / max HR
 * in Profile. Two jobs:
 *
 * 1. RE-BUCKET (Strava-sourced runs only)
 *    Re-fetches the raw HR stream from Strava for recent activities and
 *    recomputes hr_pct_z1/z2/z3/z4_5 against the user's current zone boundaries.
 *    HealthKit-sourced runs can't be re-bucketed server-side (raw samples aren't
 *    stored) — they're handled by job 2 only.
 *
 * 2. RECOMPUTE DERIVED COLUMNS
 *    For all recent strava_activities (both sources), recomputes
 *    hr_in_zone_pct and hr_above_ceiling_pct from the (now-fresh for Strava,
 *    approximated for HealthKit) hr_pct_z* columns using the current prescribed
 *    zone for each session type.
 *    Also updates the matching run_analysis rows so coaching verdicts reflect
 *    the corrected zone membership.
 *
 * Runs entirely server-side, no LLM calls. Max 90-day window of activities.
 * Auth: Bearer token (same pattern as link-activity).
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { getUserFromRequest } from '@/lib/supabase/getUserFromRequest'
import { getStravaToken, bucketHRSamples, getUserHRZones } from '@/lib/strava'
import { zoneForSessionType } from '@/lib/coaching/zoneRules'
import { fetchPlanForUser } from '@/lib/plan'

const LOOKBACK_DAYS = 90

// Re-implementation of derivePrescribedZoneHrFigures (private in analyse-run).
// Kept local so we don't need to export it from a heavy route file.
function derivePrescribed(
  z1: number | null, z2: number | null, z3: number | null, z4_5: number | null,
  prescribedZone: ReturnType<typeof zoneForSessionType>,
): { hrInZonePct: number | null; hrAboveCeilingPct: number | null } {
  if (!prescribedZone) return { hrInZonePct: null, hrAboveCeilingPct: null }
  const safe = (v: number | null): number => v ?? 0
  const sum  = (...vs: Array<number | null>): number =>
    Math.round(vs.reduce<number>((acc, v) => acc + safe(v), 0) * 100) / 100
  switch (prescribedZone.zone) {
    case 'Z2':  return { hrInZonePct: safe(z2),   hrAboveCeilingPct: sum(z3, z4_5) }
    case 'Z3':  return { hrInZonePct: safe(z3),   hrAboveCeilingPct: sum(z4_5)     }
    case 'Z4-5':return { hrInZonePct: safe(z4_5), hrAboveCeilingPct: 0              }
    default:    return { hrInZonePct: null,        hrAboveCeilingPct: null          }
  }
}

export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  // Read current zones — these are the NEW values after the HR update
  const zones = await getUserHRZones(supabase, user.id)
  if (!zones.zone2Ceiling) {
    // No HR data at all — nothing to recalibrate against
    return NextResponse.json({ ok: true, updated: 0, reason: 'no_zones' })
  }

  // Fetch the user's plan to resolve session types for each day
  let plan: any = null
  try { plan = await fetchPlanForUser(user.id, supabase) } catch {}

  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - LOOKBACK_DAYS)

  // Load recent activities — both sources
  const { data: activities } = await supabase
    .from('strava_activities')
    .select('id, source, strava_activity_id, apple_health_uuid, hr_pct_z1, hr_pct_z2, hr_pct_z3, hr_pct_z4_5, avg_hr, max_hr')
    .eq('user_id', user.id)
    .gte('start_date', cutoff.toISOString())
    .order('start_date', { ascending: false })

  if (!activities?.length) return NextResponse.json({ ok: true, updated: 0, reason: 'no_activities' })

  // Load Strava token if connected (needed for re-bucketing Strava runs)
  let stravaAccessToken: string | null = null
  try {
    const { data: settings } = await supabase
      .from('user_settings')
      .select('strava_refresh_token')
      .eq('id', user.id)
      .single()
    if (settings?.strava_refresh_token) {
      const tok = await getStravaToken(settings.strava_refresh_token)
      stravaAccessToken = tok.access_token
    }
  } catch {}

  // Load run_analysis rows for the same window so we can patch them
  const { data: analyses } = await supabase
    .from('run_analysis')
    .select('id, strava_activity_id, apple_health_uuid, session_day')
    .eq('user_id', user.id)
    .gte('created_at', cutoff.toISOString())

  const analysisMap = new Map<string, any>()
  ;(analyses ?? []).forEach((a: any) => {
    if (a.strava_activity_id) analysisMap.set(`strava_${a.strava_activity_id}`, a)
    if (a.apple_health_uuid)  analysisMap.set(`hk_${a.apple_health_uuid}`, a)
  })

  let updated = 0

  for (const activity of activities) {
    try {
      let z1    = activity.hr_pct_z1   as number | null
      let z2    = activity.hr_pct_z2   as number | null
      let z3    = activity.hr_pct_z3   as number | null
      let z4_5  = activity.hr_pct_z4_5 as number | null

      // ── Job 1: re-bucket Strava runs from raw HR stream ──────────────────
      if (activity.source === 'strava' && activity.strava_activity_id && stravaAccessToken) {
        const streamRes = await fetch(
          `https://www.strava.com/api/v3/activities/${activity.strava_activity_id}/streams?keys=heartrate&key_by_type=true`,
          { headers: { Authorization: `Bearer ${stravaAccessToken}` }, cache: 'no-store' },
        )
        if (streamRes.ok) {
          const streams = await streamRes.json()
          const hrData: number[] = streams?.heartrate?.data
          const summary = bucketHRSamples(hrData, zones)
          if (summary) {
            z1   = summary.histogram.pctZ1
            z2   = summary.histogram.pctZ2
            z3   = summary.histogram.pctZ3
            z4_5 = summary.histogram.pctZ4_5

            await supabase.from('strava_activities').update({
              hr_pct_z1:            z1,
              hr_pct_z2:            z2,
              hr_pct_z3:            z3,
              hr_pct_z4_5:          z4_5,
              hr_in_zone_pct:       summary.inZonePct,
              hr_above_ceiling_pct: summary.abovePct,
              hr_below_floor_pct:   summary.belowPct,
            }).eq('id', activity.id)
          }
        }
      }
      // HealthKit runs: hr_pct_z* stay as-is (raw samples unavailable server-side).
      // We can still recompute the derived columns in run_analysis using the
      // existing (stale) histogram against the new session-type prescription.

      // ── Job 2: recompute run_analysis zone columns ────────────────────────
      const analysisKey = activity.source === 'strava'
        ? `strava_${activity.strava_activity_id}`
        : `hk_${activity.apple_health_uuid}`
      const analysis = analysisMap.get(analysisKey)
      if (!analysis) continue

      // Resolve session type from plan to get the prescribed zone
      const sessionDay: string | null = analysis.session_day
      let sessionType: string | null = null
      if (plan?.weeks && sessionDay) {
        // session_day format: "week_N_dow" or just "dow"
        const parts    = sessionDay.split('_')
        const dow      = parts[parts.length - 1] as string
        const weekN    = parts.length >= 3 ? Number(parts[1]) : null
        const week     = weekN != null
          ? plan.weeks.find((w: any) => w.n === weekN)
          : plan.weeks[0]
        if (week?.sessions?.[dow]) sessionType = week.sessions[dow].type
      }

      if (!sessionType) continue
      const prescribedZone = zoneForSessionType(sessionType)
      const derived = derivePrescribed(z1, z2, z3, z4_5, prescribedZone)

      if (derived.hrInZonePct == null && derived.hrAboveCeilingPct == null) continue

      await supabase.from('run_analysis').update({
        hr_in_zone_pct:       derived.hrInZonePct,
        hr_above_ceiling_pct: derived.hrAboveCeilingPct,
      }).eq('id', analysis.id)

      updated++
    } catch (err) {
      console.warn('[recalibrate-hr] activity failed', activity.id, err)
    }
  }

  return NextResponse.json({ ok: true, updated })
}
