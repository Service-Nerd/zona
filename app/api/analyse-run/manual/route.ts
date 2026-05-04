import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { getUserFromRequest } from '@/lib/supabase/getUserFromRequest'
import { deriveManualVerdict, manualFeedbackText } from '@/lib/coaching/manualSessionFeedback'
import { COACHING_RULE_ENGINE_VERSION } from '@/lib/coaching/constants'

// POST /api/analyse-run/manual
// Writes a rule-engine coaching row for a session completed without a linked
// activity. Source = 'manual'; no HR/distance/EF scoring is possible.
//
// Auth: bearer token. FREE tier — no subscription gate.
// Body: { week_n: number, session_day: string, session_type: string,
//         rpe?: number | null, fatigue_tag?: string | null }
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
    rpe        = null,
    fatigue_tag = null,
  } = body as {
    week_n:       number
    session_day:  string
    session_type: string
    rpe?:         number | null
    fatigue_tag?: string | null
  }

  if (week_n == null || !session_day || !session_type) {
    return NextResponse.json(
      { error: 'week_n, session_day, and session_type are required' },
      { status: 422 },
    )
  }

  // Must have something to work with
  if (rpe === null && fatigue_tag === null) {
    return NextResponse.json(
      { error: 'At least one of rpe or fatigue_tag must be provided' },
      { status: 422 },
    )
  }

  const serviceSupabase = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  const verdict      = deriveManualVerdict(session_type, rpe)
  const feedbackText = manualFeedbackText(session_type, rpe, fatigue_tag)

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
    // No scoring possible without activity data.
    hr_discipline_score: null,
    distance_score:      null,
    pace_score:          null,
    ef_score:            null,
    total_score:         null,
    verdict,
    feedback_text:       feedbackText,
    // HR / EF fields all null.
    hr_in_zone_pct:      null,
    hr_above_ceiling_pct: null,
    hr_below_floor_pct:  null,
    ef_value:            null,
    ef_baseline:         null,
    ef_trend_pct:        null,
    planned_load_km:     null,
    actual_load_km:      null,
    rule_engine_version: COACHING_RULE_ENGINE_VERSION,
  }

  const { error } = await serviceSupabase.from('run_analysis').insert(row)

  if (error) {
    console.error('[analyse-run/manual] insert failed', error.message)
    return NextResponse.json({ error: 'Failed to write manual analysis' }, { status: 500 })
  }

  return NextResponse.json({ analysis: row })
}
