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
import { buildAthleteContext } from '@/lib/coaching/prompts/athleteContext'
import { computeHrStreamSummary } from '@/lib/coaching/streamAnalysis'
import { computePaceFadeSummary, type StravaSplitMetric } from '@/lib/coaching/paceAnalysis'
import { fetchRunHistory, findSimilarRuns, summariseCohort, pickWindowDays } from '@/lib/coaching/runHistory'
import { zoneForSessionType, sessionHRBand } from '@/lib/coaching/zoneRules'
import { inferLimiter } from '@/lib/coaching/limiter'
import { coachingSessionType } from '@/lib/plan/sessionRole'
import { raceInjuryFlagged } from '@/lib/coaching/raceNarrative'
import { FATIGUE_HIGH_TAGS } from '@/lib/coaching/constants'
import { ANTHROPIC_MODEL } from '@/lib/ai/models'
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

  // Fetch activity, plan, completions, settings, and prior analysis count in parallel.
  // user_settings.resting_hr + max_hr drive the live Karvonen band — must
  // match the session-card UI (which reads the same source) so feedback
  // doesn't quote a different ceiling than the user sees on screen.
  // priorAnalysisRes count: detects first-ever session so the prompt can frame it appropriately.
  const [activityRes, planRes, completionRes, recentActivitiesRes, settingsRes, priorAnalysisRes, recentAnalysesRes] = await Promise.all([
    activityFiltered.single(),
    serviceSupabase
      .from('plans')
      .select('plan_json')
      .eq('user_id', userId)
      .single(),
    // RESHAPE-FIX-WAVE2B-AUDIT: no bare-stub filter needed here — the handler
    // 422s unless a strava_activity_id or apple_health_uuid is supplied (see
    // top of POST), so this route only ever runs for a real linked activity.
    // This read just enriches that analysis with the user's RPE/fatigue.
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
    serviceSupabase
      .from('run_analysis')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId),
    // AI-DEPTH-10 — most recent analysed sessions, used to find the last
    // SAME-TYPE session for continuity ("Tuesday's easy 4 days ago: nailed").
    // Distinct from the R25 cohort (averaged across many similar runs) — this
    // is a single specific prior run the model can name. Excludes the row
    // being analysed right now (matched by week_n + session_day).
    serviceSupabase
      .from('run_analysis')
      .select('week_n, session_day, verdict, hr_in_zone_pct, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(20),
  ])

  const activity        = activityRes.data
  const plan            = planRes.data?.plan_json as Plan | null
  // isFirstAnalysis: true when the user has no prior run_analysis rows (count = 0).
  // The prompt uses this to soften the welcome without hype.
  const isFirstAnalysis = (priorAnalysisRes.count ?? 1) === 0
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

  // Derive prescribed-zone-anchored HR figures from the activity's full zone
  // histogram. Until 2026-05-22 the activity's hr_in_zone_pct was a Z2-only
  // figure regardless of session type — so a tempo run that perfectly hit Z3
  // scored 0 on HR discipline. The histogram (added by the 20260522 migration)
  // lets us pick whichever zone the session prescribed and treat that as "in
  // zone". Falls back to legacy Z2-anchored values when the histogram is
  // missing (rows ingested before the migration).
  const prescribedZoneForScoring = zoneForSessionType(session.type)
  const prescribedHrFigures = derivePrescribedZoneHrFigures(activity, prescribedZoneForScoring)

  // Score the session
  const scoreResult = scoreSession({
    session,
    actualDistKm:     (activity.distance_m ?? 0) / 1000,
    actualAvgHr:      activity.avg_hr ?? null,
    actualAvgSpeedMs: activity.avg_speed ?? 0,
    hrInZonePct:      prescribedHrFigures.hrInZonePct,
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

  // AI-DEPTH-10 — resolve the most recent prior session of the SAME type by
  // walking recent run_analysis rows, looking up each one's type from the plan,
  // and picking the first match that isn't the current row.
  const DAY_NAME: Record<string, string> = {
    mon: 'Monday',    tue: 'Tuesday', wed: 'Wednesday', thu: 'Thursday',
    fri: 'Friday',    sat: 'Saturday', sun: 'Sunday',
    monday: 'Monday', tuesday: 'Tuesday', wednesday: 'Wednesday', thursday: 'Thursday',
    friday: 'Friday', saturday: 'Saturday', sunday: 'Sunday',
  }
  let previousSimilarSession: {
    dayLabel:    string
    daysAgo:     number
    verdict:     string | null
    hrInZonePct: number | null
  } | null = null
  for (const row of recentAnalysesRes.data ?? []) {
    // Skip the row being analysed right now
    if (row.week_n === week_n && row.session_day === session_day) continue
    const priorWeek    = plan.weeks.find(w => w.n === row.week_n)
    const priorDayKey  = (row.session_day as string).replace(`week_${row.week_n}_`, '')
    const priorSession = priorWeek?.sessions?.[priorDayKey as keyof typeof priorWeek.sessions]
    if (!priorSession || priorSession.type !== session.type) continue
    const createdMs = new Date(row.created_at as string).getTime()
    const daysAgo   = Math.max(1, Math.round((Date.now() - createdMs) / 86_400_000))
    previousSimilarSession = {
      dayLabel:    DAY_NAME[priorDayKey] ?? priorDayKey,
      daysAgo,
      verdict:     (row.verdict as string | null) ?? null,
      hrInZonePct: row.hr_in_zone_pct != null ? Number(row.hr_in_zone_pct) : null,
    }
    break
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
    // Pace: avg_speed is in m/s → convert to sec/km for the prompt
    const avgSpeedMs = activity.avg_speed ?? 0
    const actualPaceSecPerKm = avgSpeedMs > 0 ? Math.round(1000 / avgSpeedMs) : null

    // Recent high-fatigue count for the limiter classifier — read the last
    // 5 logged sessions and count Heavy/Wrecked/Cooked tags. Best-effort:
    // failure leaves the count at 0 and the limiter simply skips the
    // recovery-accumulation branch.
    let recentHighFatigueCount = 0
    try {
      const { data: recentFatigueRows } = await serviceSupabase
        .from('session_completions')
        .select('fatigue_tag, updated_at')
        .eq('user_id', userId)
        .not('updated_at', 'is', null)
        .order('updated_at', { ascending: false })
        .limit(5)
      recentHighFatigueCount = (recentFatigueRows ?? [])
        .filter((r: any) => r.fatigue_tag && (FATIGUE_HIGH_TAGS as readonly string[]).includes(r.fatigue_tag))
        .length
    } catch (err) {
      console.warn('[analyse-run] recent fatigue fetch failed', err)
    }

    const streamSummaryForLimiter = computeHrStreamSummary(
      (activity.raw_payload as { hrSamples?: Array<{ valueBpm: number; timestamp: string }> } | null)?.hrSamples ?? null,
      activity.moving_time_s ?? 0,
    )
    const paceFadeSummaryForLimiter = computePaceFadeSummary(
      activity.splits_metric as StravaSplitMetric[] | null,
    )
    const tempCNum = activity.avg_temp_c != null ? Number(activity.avg_temp_c) : null

    // RACE-DEBRIEF-02 — the runner's own race account (race week only). Feeds
    // the debrief block and the limiter's injury silence guard (§71.3).
    const raceResult = (week as any)?.result_embedded ?? null

    const limiter = inferLimiter({
      sessionType:            coachingSessionType(session as any),
      actualAvgHr:            activity.avg_hr ?? null,
      prescribedHrCeiling:    liveBand?.hi ?? null,
      hrAboveCeilingPct:      prescribedHrFigures.hrAboveCeilingPct,
      hrBelowFloorPct:        prescribedHrFigures.hrBelowFloorPct,
      streamSummary:          streamSummaryForLimiter,
      paceFadeSummary:        paceFadeSummaryForLimiter,
      tempC:                  tempCNum,
      rpe:                    completionRes.data?.rpe ?? null,
      fatigueTag:             completionRes.data?.fatigue_tag ?? null,
      recentHighFatigueCount,
      actualDistKm:           (activity.distance_m ?? 0) / 1000,
      plannedDistKm:          (session as any).distance_km ?? null,
      injuryFlagged:          raceInjuryFlagged(raceResult),
    })

    const prompt = buildSessionFeedbackPrompt({
      session,
      weekN:               week_n,
      plan,
      verdict:             scoreResult.verdict,
      actualDistKm:        (activity.distance_m ?? 0) / 1000,
      actualPaceSecPerKm,
      actualAvgHr:         activity.avg_hr ?? null,
      hrInZonePct:         prescribedHrFigures.hrInZonePct,
      hrAboveCeilingPct:   prescribedHrFigures.hrAboveCeilingPct,
      efTrendPct,
      rpe:                 completionRes.data?.rpe ?? null,
      fatigueTag:          completionRes.data?.fatigue_tag ?? null,
      weekPhase:           (week as any).phase ?? null,
      prescribedZoneLabel: prescribedZone?.label ?? null,
      prescribedHrBand:    liveBand ? { lo: liveBand.lo, hi: liveBand.hi } : null,
      cohortContext:       cohortSummary,
      isFirstAnalysis,
      athleteContext:      buildAthleteContext({ plan }),
      previousSimilarSession,
      streamSummary:       streamSummaryForLimiter,
      paceFadeSummary:     paceFadeSummaryForLimiter,
      tempC:               tempCNum,
      limiter,
      raceResult,
    })

    const aiRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type':    'application/json',
        'x-api-key':       process.env.ANTHROPIC_API_KEY!,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model:      ANTHROPIC_MODEL,
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
    hr_in_zone_pct:        prescribedHrFigures.hrInZonePct,
    hr_above_ceiling_pct:  prescribedHrFigures.hrAboveCeilingPct,
    hr_below_floor_pct:    prescribedHrFigures.hrBelowFloorPct,
    // Mirror the four-bucket zone histogram from strava_activities onto
    // run_analysis so the Coach ZoneRings aggregation reads a single table.
    hr_pct_z1:             activity.hr_pct_z1   ?? null,
    hr_pct_z2:             activity.hr_pct_z2   ?? null,
    hr_pct_z3:             activity.hr_pct_z3   ?? null,
    hr_pct_z4_5:           activity.hr_pct_z4_5 ?? null,
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

  // POST-RUN-01: removed. The link-time push from autoMatchAndAnalyse already
  // pulled the user into the Post-Run screen, where the analysis morphs from
  // pending → RunFeedbackCard in place. A second push 15–30s later was noise.

  return NextResponse.json({
    analysis: {
      ...analysisRow,
      feedback_text: feedbackText,
    },
    score:   scoreResult,
  })
}

interface PrescribedHrFigures {
  hrInZonePct:       number | null
  hrAboveCeilingPct: number | null
  hrBelowFloorPct:   number | null
}

// Maps the activity's full zone histogram onto the session's prescribed zone:
// "in zone" = % in the prescribed zone band, "above ceiling" = % above that
// band, "below floor" = % below it. Falls back to the activity's legacy
// Z2-anchored figures when the histogram is missing (rows ingested before
// the 20260522 migration). Returns nulls when the session prescribes no zone
// (rest / strength / cross-train) — those sessions are scored on other axes.
function derivePrescribedZoneHrFigures(
  activity: Record<string, any>,
  prescribedZone: ReturnType<typeof zoneForSessionType>,
): PrescribedHrFigures {
  const z1   = activity.hr_pct_z1   as number | null | undefined
  const z2   = activity.hr_pct_z2   as number | null | undefined
  const z3   = activity.hr_pct_z3   as number | null | undefined
  const z4_5 = activity.hr_pct_z4_5 as number | null | undefined
  const hasHistogram = [z1, z2, z3, z4_5].some(v => v != null)

  // Legacy fallback: pre-migration rows have only the Z2-anchored fields.
  // They're correct for easy/long/recovery sessions and meaningless elsewhere
  // — but that's how scoring used to work, so the fallback preserves behaviour
  // rather than silently dropping data on old runs.
  if (!hasHistogram) {
    return {
      hrInZonePct:       activity.hr_in_zone_pct       ?? null,
      hrAboveCeilingPct: activity.hr_above_ceiling_pct ?? null,
      hrBelowFloorPct:   activity.hr_below_floor_pct   ?? null,
    }
  }

  if (!prescribedZone) {
    return { hrInZonePct: null, hrAboveCeilingPct: null, hrBelowFloorPct: null }
  }

  const safe = (v: number | null | undefined): number => v ?? 0
  const sum  = (...vs: Array<number | null | undefined>): number =>
    Math.round(vs.reduce<number>((acc, v) => acc + safe(v), 0) * 100) / 100

  switch (prescribedZone.zone) {
    case 'Z2':
      return {
        hrInZonePct:       safe(z2),
        hrAboveCeilingPct: sum(z3, z4_5),
        hrBelowFloorPct:   safe(z1),
      }
    case 'Z3':
      return {
        hrInZonePct:       safe(z3),
        hrAboveCeilingPct: safe(z4_5),
        hrBelowFloorPct:   sum(z1, z2),
      }
    case 'Z4-5':
      return {
        hrInZonePct:       safe(z4_5),
        hrAboveCeilingPct: 0,
        hrBelowFloorPct:   sum(z1, z2, z3),
      }
    case 'Z1':
      return {
        hrInZonePct:       safe(z1),
        hrAboveCeilingPct: sum(z2, z3, z4_5),
        hrBelowFloorPct:   0,
      }
    default:
      return { hrInZonePct: null, hrAboveCeilingPct: null, hrBelowFloorPct: null }
  }
}

