import { getUserFromRequest } from '@/lib/supabase/getUserFromRequest'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { getUserTier } from '@/lib/trial'
import { isFeatureAllowed } from '@/lib/plan/canUseFeature'
import { scoreSession } from '@/lib/coaching/sessionScore'
import { computeEF, computeEFBaseline } from '@/lib/coaching/efTrend'
import { COACHING_RULE_ENGINE_VERSION, COHORT_SIMILARITY } from '@/lib/coaching/constants'
import { buildSessionFeedbackPrompt } from '@/lib/coaching/prompts/sessionFeedback'
import { fetchRunHistory, findSimilarRuns, summariseCohort, pickWindowDays } from '@/lib/coaching/runHistory'
import { zoneForSessionType, sessionHRBand } from '@/lib/coaching/zoneRules'
import { notifyUser } from '@/lib/webpush'
import { BRAND } from '@/lib/brand'
import type { Plan, Session } from '@/types/plan'

// POST /api/analyse-run
// Auth-gated (paid/trial). Called after a Strava activity is linked to a planned session.
// Returns run_analysis row + AI feedback text.

export async function POST(req: NextRequest) {
  // Internal webhook bypass: service key + explicit user_id header
  const serviceKey = req.headers.get('x-service-key')
  const headerUserId = req.headers.get('x-user-id')
  const isInternalCall = serviceKey === process.env.SUPABASE_SERVICE_ROLE_KEY && !!headerUserId

  let userId: string
  let tier: 'free' | 'trial' | 'paid'

  if (isInternalCall) {
    userId = headerUserId!
    tier   = 'trial'   // internal calls are always enriched
  } else {
    const supabase = createClient()
    const user = await getUserFromRequest(req)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    userId = user.id
    tier   = await getUserTier(user.id)
    if (!isFeatureAllowed('activity_intelligence', tier)) {
      return NextResponse.json({ error: 'Subscription required' }, { status: 403 })
    }
  }

  const body = await req.json()
  const { strava_activity_id, apple_health_uuid, week_n, session_day } = body as {
    strava_activity_id?: number
    apple_health_uuid?:  string
    week_n: number
    session_day: string
  }

  // Source ref: exactly one of strava_activity_id / apple_health_uuid must be set
  if (week_n == null || !session_day) {
    return NextResponse.json({ error: 'week_n, session_day required' }, { status: 422 })
  }
  if (!strava_activity_id && !apple_health_uuid) {
    return NextResponse.json({ error: 'strava_activity_id or apple_health_uuid required' }, { status: 422 })
  }

  const serviceSupabase = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // Activity lookup uses whichever ID was provided
  const activityQuery = serviceSupabase
    .from('strava_activities')
    .select('*')
    .eq('user_id', userId)
  const activityFiltered = strava_activity_id
    ? activityQuery.eq('strava_activity_id', strava_activity_id)
    : activityQuery.eq('apple_health_uuid', apple_health_uuid!)

  // Fetch activity, plan, completions, settings in parallel.
  // user_settings.resting_hr + max_hr drive the live Karvonen band — must
  // match the session-card UI (which reads the same source) so feedback
  // doesn't quote a different ceiling than the user sees on screen.
  const [activityRes, planRes, completionRes, recentActivitiesRes, settingsRes] = await Promise.all([
    activityFiltered.single(),
    serviceSupabase
      .from('plans')
      .select('plan_json')
      .eq('user_id', userId)
      .single(),
    serviceSupabase
      .from('session_completions')
      .select('rpe, fatigue_tag, avg_hr')
      .eq('user_id', userId)
      .eq('week_n', week_n)
      .eq('session_day', session_day)
      .maybeSingle(),
    serviceSupabase
      .from('strava_activities')
      .select('id, strava_activity_id, apple_health_uuid, avg_speed, avg_hr, activity_type, sport_type, start_date')
      .eq('user_id', userId)
      .order('start_date', { ascending: false })
      .limit(20),
    serviceSupabase
      .from('user_settings')
      .select('resting_hr, max_hr')
      .eq('id', userId)
      .single(),
  ])

  const activity = activityRes.data
  const plan     = planRes.data?.plan_json as Plan | null
  if (!activity || !plan) {
    return NextResponse.json({ error: 'Activity or plan not found' }, { status: 404 })
  }

  // Find the planned session in the plan
  const week    = plan.weeks.find(w => w.n === week_n)
  const dayKey  = session_day.replace(`week_${week_n}_`, '') as 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun'
  const session = week?.sessions?.[dayKey] as Session | undefined
  if (!session) {
    return NextResponse.json({ error: 'Planned session not found' }, { status: 404 })
  }

  // Compute EF baseline from recent activities of same session type.
  // Use the strava_activities row UUID as the EF activity ID — source-agnostic
  // and stable across both Strava and HealthKit rows.
  const recentActivities = (recentActivitiesRes.data ?? []).map((a: any) => ({
    id: a.id,
    name: '',
    type: a.activity_type ?? 'Run',
    sport_type: a.sport_type ?? 'Run',
    start_date: a.start_date,
    distance: 0,
    moving_time: 0,
    elapsed_time: 0,
    total_elevation_gain: 0,
    average_heartrate: a.avg_hr ?? undefined,
    average_speed: a.avg_speed ?? 0,
  }))

  const activityForEF = {
    id: activity.id,
    name: activity.name ?? '',
    type: activity.activity_type ?? 'Run',
    sport_type: activity.sport_type ?? 'Run',
    start_date: activity.start_date,
    distance: activity.distance_m ?? 0,
    moving_time: activity.moving_time_s ?? 0,
    elapsed_time: activity.elapsed_time_s ?? 0,
    total_elevation_gain: activity.elevation_gain ?? 0,
    average_heartrate: activity.avg_hr ?? undefined,
    average_speed: activity.avg_speed ?? 0,
  }

  const efValue    = computeEF(activityForEF)
  const efBaseline = computeEFBaseline(session.type, recentActivities, activity.id)
  const efTrendPct = efValue !== null && efBaseline !== null
    ? ((efValue - efBaseline) / efBaseline) * 100
    : null

  // Score the session
  const scoreResult = scoreSession({
    session,
    actualDistKm:     (activity.distance_m ?? 0) / 1000,
    actualAvgHr:      activity.avg_hr ?? null,
    actualAvgSpeedMs: activity.avg_speed ?? 0,
    hrInZonePct:      activity.hr_in_zone_pct ?? null,
    efValue,
    efBaseline,
  })

  // Past-self cohort comparison (R25 cut #1, CoachingPrinciples §58).
  // Deterministic — fetch history, filter by similarity, summarise.
  // AI prompt receives the summary; failure here is silent (cohortSummary stays null).
  let cohortSummary = null
  try {
    const fullHistory = await fetchRunHistory(serviceSupabase, userId, COHORT_SIMILARITY.WINDOW_DAYS_DEFAULT)
    const sixMonthsAgo = new Date()
    sixMonthsAgo.setDate(sixMonthsAgo.getDate() - COHORT_SIMILARITY.WINDOW_DAYS_DENSE)
    const recentCount = fullHistory.filter(r => r.startDate >= sixMonthsAgo).length
    const window = pickWindowDays(recentCount)
    const cohort = window === COHORT_SIMILARITY.WINDOW_DAYS_DENSE
      ? fullHistory.filter(r => r.startDate >= sixMonthsAgo)
      : fullHistory
    const similar = findSimilarRuns(cohort, {
      distanceKm: (activity.distance_m ?? 0) / 1000,
      avgHr:      activity.avg_hr ?? null,
    }, new Date(activity.start_date))
    if (similar.length >= COHORT_SIMILARITY.MIN_COHORT_SIZE) {
      cohortSummary = summariseCohort(similar)
    }
  } catch (err) {
    console.warn('[analyse-run] cohort similarity failed', err)
  }

  // AI feedback — generated before upsert so feedback_text lands in the same row.
  // Failure is silent; scoring row is written regardless.
  let feedbackText: string | null = null
  try {
    const prescribedZone = zoneForSessionType((session as any).type)
    // Live Karvonen band from user_settings — single source of truth shared
    // with the UI. Falls back to plan.meta.zone2_ceiling inside the prompt
    // when restingHR/maxHR are missing.
    const restingHR = settingsRes.data?.resting_hr ?? null
    const maxHR     = settingsRes.data?.max_hr     ?? null
    const liveBand  = sessionHRBand((session as any).type, restingHR, maxHR)
    const prompt = buildSessionFeedbackPrompt({
      session,
      weekN: week_n,
      plan,
      verdict:             scoreResult.verdict,
      totalScore:          scoreResult.totalScore,
      hrDisciplineScore:   scoreResult.hrDisciplineScore,
      distanceScore:       scoreResult.distanceScore,
      actualDistKm:        (activity.distance_m ?? 0) / 1000,
      actualAvgHr:         activity.avg_hr ?? null,
      hrInZonePct:         activity.hr_in_zone_pct ?? null,
      hrAboveCeilingPct:   activity.hr_above_ceiling_pct ?? null,
      efTrendPct,
      rpe:                 completionRes.data?.rpe ?? null,
      fatigueTag:          completionRes.data?.fatigue_tag ?? null,
      prescribedZoneLabel: prescribedZone?.label ?? null,
      prescribedHrBand:    liveBand ? { lo: liveBand.lo, hi: liveBand.hi } : null,
      cohortContext:       cohortSummary,
    })

    const aiRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type':    'application/json',
        'x-api-key':       process.env.ANTHROPIC_API_KEY!,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model:      'claude-haiku-4-5-20251001',
        max_tokens: 200,
        messages:   [{ role: 'user', content: prompt }],
      }),
    })

    if (aiRes.ok) {
      const aiData = await aiRes.json()
      feedbackText = aiData.content?.[0]?.text?.trim() ?? null
    }
  } catch {
    // silent fallback — scoring row still written below
  }

  // Persist complete row (scores + feedback_text) in one upsert.
  // Must await — fire-and-forget on serverless means the row never lands.
  // Source-aware ID: write the column matching the source, leave the other null.
  const analysisRow: Record<string, unknown> = {
    user_id:               userId,
    week_n,
    session_day,
    strava_activity_id:    strava_activity_id ?? null,
    apple_health_uuid:     apple_health_uuid  ?? null,
    hr_discipline_score:   scoreResult.hrDisciplineScore,
    distance_score:        scoreResult.distanceScore,
    pace_score:            scoreResult.paceScore,
    ef_score:              scoreResult.efScore,
    total_score:           scoreResult.totalScore,
    verdict:               scoreResult.verdict,
    feedback_text:         feedbackText,
    hr_in_zone_pct:        activity.hr_in_zone_pct ?? null,
    hr_above_ceiling_pct:  activity.hr_above_ceiling_pct ?? null,
    hr_below_floor_pct:    activity.hr_below_floor_pct ?? null,
    ef_value:              efValue,
    ef_baseline:           efBaseline,
    ef_trend_pct:          efTrendPct,
    planned_load_km:       session.distance_km ?? null,
    actual_load_km:        (activity.distance_m ?? 0) / 1000,
    rule_engine_version:   COACHING_RULE_ENGINE_VERSION,
  }

  const conflictTarget = strava_activity_id
    ? 'user_id,strava_activity_id'
    : 'user_id,apple_health_uuid'
  const upsertRes = await serviceSupabase
    .from('run_analysis')
    .upsert(analysisRow, { onConflict: conflictTarget })
  if (upsertRes.error) {
    console.error('[analyse-run] run_analysis upsert failed', upsertRes.error.message)
  }

  // Push notification — only on webhook path (user isn't in the app)
  if (isInternalCall) {
    const pushBody = feedbackText
      ?? verdictPushBody(scoreResult.verdict, (activity.distance_m ?? 0) / 1000)
    void notifyUser(userId, {
      title: BRAND.push.runAnalysis,
      body:  pushBody,
      tag:   'run-analysis',
      data:  { url: '/dashboard?screen=coach' },
    })
  }

  return NextResponse.json({
    analysis: {
      ...analysisRow,
      feedback_text: feedbackText,
    },
    score:   scoreResult,
  })
}

/** Fallback push body when AI feedback is unavailable. */
function verdictPushBody(verdict: string, distKm: number): string {
  const dist = distKm > 0 ? ` ${distKm.toFixed(1)}km` : ''
  switch (verdict) {
    case 'strong':    return `${dist} in. Looked controlled.`
    case 'good':      return `${dist} done. Solid work.`
    case 'ok':        return `${dist} logged. Hold the zone next time.`
    case 'drifted':   return `${dist} — HR went high. Worth checking.`
    case 'hard':      return `${dist} — that was a tough one.`
    default:          return `${dist} logged.`
  }
}
