import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { getUserFromRequest } from '@/lib/supabase/getUserFromRequest'
import { deriveManualVerdict, manualFeedbackText, manualMetricsFeedbackText } from '@/lib/coaching/manualSessionFeedback'
import { scoreSession, parseHRCeiling } from '@/lib/coaching/sessionScore'
import { getUserTier } from '@/lib/trial'
import { isFeatureAllowed } from '@/lib/plan/canUseFeature'
import { COACHING_RULE_ENGINE_VERSION } from '@/lib/coaching/constants'
import type { Plan, Session } from '@/types/plan'

// POST /api/analyse-run/manual
// Writes a rule-engine coaching row for a session completed without a linked
// device activity. Source = 'manual'.
//
// Auth: bearer token.
//  - FREE: RPE/fatigue → verdict + one-line note (no numeric scores).
//  - PAID/trial (DS-06): if the run's metrics were entered (distance/duration
//    + optional avg HR), additionally run scoreSession → distance/pace/coarse-HR
//    scores + a metric-anchored verdict. A single avg HR is not a stream, so
//    hr_in_zone_pct stays null; the coarse avg-HR-vs-band read is scoreSession's
//    existing hr_target-ceiling fallback.
//
// Body: { week_n, session_day, session_type, rpe?, fatigue_tag?,
//         distance_km?, duration_s?, avg_hr? }
//
// The route uses DELETE + INSERT (not upsert) to replace any existing manual
// row for this session. The partial unique index (run_analysis_manual_uniq)
// enforces one manual row per user/session but can't be targeted by Supabase's
// upsert helper (partial-index limitation), so we manage idempotency ourselves.

export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const {
    week_n,
    session_day,
    session_type,
    rpe          = null,
    fatigue_tag  = null,
    distance_km  = null,
    duration_s   = null,
    avg_hr       = null,
  } = body as {
    week_n:       number
    session_day:  string
    session_type: string
    rpe?:         number | null
    fatigue_tag?: string | null
    distance_km?: number | null
    duration_s?:  number | null
    avg_hr?:      number | null
  }

  if (week_n == null || !session_day || !session_type) {
    return NextResponse.json(
      { error: 'week_n, session_day, and session_type are required' },
      { status: 422 },
    )
  }

  // Must have something to work with — RPE, fatigue, or entered metrics.
  const hasMetrics = distance_km != null && duration_s != null && duration_s > 0
  if (rpe === null && fatigue_tag === null && !hasMetrics) {
    return NextResponse.json(
      { error: 'Provide at least one of: rpe, fatigue_tag, or distance_km + duration_s' },
      { status: 422 },
    )
  }

  const serviceSupabase = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  // Baseline (FREE) verdict + note from RPE/fatigue.
  let verdict      = deriveManualVerdict(session_type, rpe)
  let feedbackText = manualFeedbackText(session_type, rpe, fatigue_tag)

  // DS-06 — richer metric scoring, PAID/trial only, when the run's metrics were
  // entered. Reuses the pure scoreSession scorer; the critical Strava/HK
  // analyse-run route is untouched.
  let scores: {
    hr_discipline_score: number | null
    distance_score:      number | null
    pace_score:          number | null
    ef_score:            number | null
    total_score:         number | null
    planned_load_km:     number | null
    actual_load_km:      number | null
  } = {
    hr_discipline_score: null,
    distance_score:      null,
    pace_score:          null,
    ef_score:            null,
    total_score:         null,
    planned_load_km:     null,
    actual_load_km:      null,
  }

  if (hasMetrics) {
    const tier = await getUserTier(user.id)
    if (isFeatureAllowed('activity_intelligence', tier)) {
      const { data: planRow } = await serviceSupabase
        .from('plans')
        .select('plan_json')
        .eq('user_id', user.id)
        .single()
      const plan    = planRow?.plan_json as Plan | null
      const week    = plan?.weeks.find(w => w.n === week_n)
      const dayKey  = session_day.replace(`week_${week_n}_`, '')
      const session = week?.sessions?.[dayKey as keyof NonNullable<typeof week>['sessions']] as Session | undefined

      if (session) {
        const avgSpeedMs = (distance_km! * 1000) / duration_s!
        const result = scoreSession({
          session,
          actualDistKm:     distance_km!,
          actualAvgHr:      avg_hr ?? null,
          actualAvgSpeedMs: avgSpeedMs,
          hrInZonePct:      null,   // no stream — coarse avg-HR read only
          efValue:          null,
          efBaseline:       null,
        })
        const hrCeiling = session.hr_target ? parseHRCeiling(session.hr_target) : null
        verdict      = result.verdict
        feedbackText = manualMetricsFeedbackText(session.type, {
          distanceKm: distance_km!,
          plannedKm:  session.distance_km ?? null,
          avgHr:      avg_hr ?? null,
          hrCeiling,
        })
        scores = {
          hr_discipline_score: result.hrDisciplineScore,
          distance_score:      result.distanceScore,
          pace_score:          result.paceScore,
          ef_score:            result.efScore,
          total_score:         result.totalScore,
          planned_load_km:     session.distance_km ?? null,
          actual_load_km:      distance_km!,
        }
      }
    }
  }

  // Remove any existing manual row for this session (idempotent replace).
  await serviceSupabase
    .from('run_analysis')
    .delete()
    .eq('user_id', user.id)
    .eq('week_n', week_n)
    .eq('session_day', session_day)
    .eq('source', 'manual')

  const row = {
    user_id:             user.id,
    week_n,
    session_day,
    source:              'manual',
    // Activity IDs intentionally null — manual rows have no linked workout.
    strava_activity_id:  null,
    apple_health_uuid:   null,
    // Scores: null on the FREE (RPE-only) path; populated by scoreSession on the
    // PAID metric path (DS-06).
    hr_discipline_score: scores.hr_discipline_score,
    distance_score:      scores.distance_score,
    pace_score:          scores.pace_score,
    ef_score:            scores.ef_score,
    total_score:         scores.total_score,
    verdict,
    feedback_text:       feedbackText,
    // HR-stream fields stay null — a single avg HR is not a stream (no time-in-zone).
    hr_in_zone_pct:      null,
    hr_above_ceiling_pct: null,
    hr_below_floor_pct:  null,
    ef_value:            null,
    ef_baseline:         null,
    ef_trend_pct:        null,
    planned_load_km:     scores.planned_load_km,
    actual_load_km:      scores.actual_load_km,
    rule_engine_version: COACHING_RULE_ENGINE_VERSION,
  }

  const { error } = await serviceSupabase.from('run_analysis').insert(row)

  if (error) {
    console.error('[analyse-run/manual] insert failed', error.message)
    return NextResponse.json({ error: 'Failed to write manual analysis' }, { status: 500 })
  }

  return NextResponse.json({ analysis: row })
}
