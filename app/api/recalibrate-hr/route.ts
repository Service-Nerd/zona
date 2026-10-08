/**
 * POST /api/recalibrate-hr
 *
 * Called (fire-and-forget) after the user updates their resting HR / max HR
 * in Profile. Two jobs:
 *
 * 1. RE-BUCKET (Strava-sourced runs only)
 *    Re-fetches the raw HR stream from Strava for recent activities and
 *    recomputes hr_pct_z1/z2/z3/z4_5 against the user's current zone boundaries.
 *    HealthKit-sourced runs are re-bucketed from the stored bpm histogram
 *    (`hr_bpm_histogram`, added 2026-08-06 / N7). Rows ingested before that
 *    column existed have no histogram and fall through to job 2 only.
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
import { getStravaToken, bucketHRSamples, bucketHRHistogram, getUserHRZones } from '@/lib/strava'
import { prescribedZoneFigures } from '@/lib/coaching/prescribedZoneFigures'
import { fetchPlanForUser } from '@/lib/plan'

const LOOKBACK_DAYS = 90

// 🔴 THE RE-IMPLEMENTATION THAT LIVED HERE IS GONE (§123, 2026-10-08).
//
// Its own comment said what it was: *"Re-implementation of
// derivePrescribedZoneHrFigures (private in analyse-run). Kept local so we don't need
// to export it from a heavy route file."* Two producers of one classification,
// acknowledged in writing and left in place.
//
// ⚠️ AND IT WAS NOT MERELY UNTIDY, BECAUSE THIS ROUTE *WRITES* `hr_in_zone_pct` AND
// `hr_above_ceiling_pct` BACK TO `run_analysis`. Left as a copy, it would have kept the
// TYPE-only logic while `analyse-run` moved to the structure-aware owner — so a single
// HR recalibration would have **silently reverted the §123 fix on every row it
// touched**, and the two numbers in one row would have been produced by two different
// rules. That is the drift the singularity doctrine exists to prevent, arriving by the
// shortest available route.

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
    .select('id, source, strava_activity_id, apple_health_uuid, hr_pct_z1, hr_pct_z2, hr_pct_z3, hr_pct_z4_5, avg_hr, max_hr, hr_bpm_histogram')
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
    .is('superseded_at', null)   // PLAN-WEEK-COLLISION-01: live plan only
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
      // ── Job 1b: re-bucket HealthKit runs from the stored bpm histogram ───
      // N7 (2026-08-06): previously HealthKit rows could not be re-bucketed at
      // all — the device's raw samples were bucketed at ingest and discarded, so
      // an HR correction left every HK run scored against the OLD zones,
      // permanently, for the source that IS the system of record (ADR-011).
      // `hr_bpm_histogram` is lossless for this: bucketing depends only on how
      // many samples fall in each band. Rows ingested before that column existed
      // have no histogram and are skipped — unchanged, not made worse.
      if (activity.source !== 'strava' && activity.hr_bpm_histogram) {
        const summary = bucketHRHistogram(activity.hr_bpm_histogram, zones)
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


      // ── Job 2: recompute run_analysis zone columns ────────────────────────
      const analysisKey = activity.source === 'strava'
        ? `strava_${activity.strava_activity_id}`
        : `hk_${activity.apple_health_uuid}`
      const analysis = analysisMap.get(analysisKey)
      if (!analysis) continue

      // Resolve session type from plan to get the prescribed zone
      const sessionDay: string | null = analysis.session_day
      let sessionType: string | null = null
      let sessionForDay: { type?: string } | null = null
      if (plan?.weeks && sessionDay) {
        // session_day format: "week_N_dow" or just "dow"
        const parts    = sessionDay.split('_')
        const dow      = parts[parts.length - 1] as string
        const weekN    = parts.length >= 3 ? Number(parts[1]) : null
        const week     = weekN != null
          ? plan.weeks.find((w: any) => w.n === weekN)
          : plan.weeks[0]
        if (week?.sessions?.[dow]) {
          sessionForDay = week.sessions[dow]
          sessionType   = sessionForDay?.type ?? null
        }
      }

      if (!sessionType) continue
      // §123 — the WHOLE session, not just its type: the band set comes from its
      // structure, and a type-only read is the defect this fix removes.
      const derived = prescribedZoneFigures(
        { z1, z2, z3, z4_5 },
        sessionForDay ?? { type: sessionType },
        { hrInZonePct: null, hrAboveCeilingPct: null, hrBelowFloorPct: null },
      )

      if (derived.hrInZonePct == null && derived.hrAboveCeilingPct == null) continue

      await supabase.from('run_analysis').update({
        hr_in_zone_pct:       derived.hrInZonePct,
        hr_above_ceiling_pct: derived.hrAboveCeilingPct,
        // Written too, so the three figures in one row cannot come from two rules.
        hr_below_floor_pct:   derived.hrBelowFloorPct,
      }).eq('id', analysis.id)

      updated++
    } catch (err) {
      console.warn('[recalibrate-hr] activity failed', activity.id, err)
    }
  }

  return NextResponse.json({ ok: true, updated })
}
