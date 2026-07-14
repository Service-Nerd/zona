/**
 * POST /api/post-run-reframe
 *
 * The post-run reframe surface (POST-RUN-REFRAME-01).
 *
 * Body: { week_n: number, session_day: string, user_note: string }
 * Auth: paid/trial only (post_run_reframe gate).
 * Model: ANTHROPIC_MODEL_DEEP (Sonnet) — reframe-with-cohort-and-trend reasoning.
 *
 * Flow:
 *   1. Auth + tier check
 *   2. Validate body, sanitise user_note
 *   3. Load plan, settings, session_completion, run_analysis in parallel
 *   4. Detect reframe tier (A/B/C) via detectReframeTier
 *   5. Branch on tier → fetch the appropriate evidence
 *   6. Build prompt via buildSessionReframePrompt
 *   7. Call Sonnet
 *   8. Reject cheerleader outputs (matching daily-coach-note pattern)
 *   9. Persist to session_reflections + return
 *
 * Risk-gate wiring (Step 4) will sit between steps 4 and 5 — if overload
 * flags fire, the route returns a silenced response without calling the LLM.
 */

import { getUserFromRequest } from '@/lib/supabase/getUserFromRequest'
import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { getUserTier } from '@/lib/trial'
import { isFeatureAllowed } from '@/lib/plan/canUseFeature'
import { buildSessionReframePrompt, REFRAME_PROMPT_VERSION } from '@/lib/coaching/prompts/sessionReframe'
import { buildAthleteContext } from '@/lib/coaching/prompts/athleteContext'
import { detectReframeTier } from '@/lib/coaching/reframeTier'
import { assessReframeRiskGate, type CoachingFlag, type FatigueTag } from '@/lib/coaching/reframeRiskGate'
import { COHORT_SIMILARITY, REFRAME_RISK, REFRAME_TIER, FATIGUE_HIGH_TAGS } from '@/lib/coaching/constants'
import { inferLimiter } from '@/lib/coaching/limiter'
import { raceInjuryFlagged } from '@/lib/coaching/raceNarrative'
import { sessionHRBand } from '@/lib/coaching/zoneRules'
import {
  fetchRunHistory,
  findSimilarRuns,
  summariseCohort,
  pickWindowDays,
  buildHrTrendSeries,
} from '@/lib/coaching/runHistory'
import { TREND_SERIES } from '@/lib/coaching/constants'
import { computeHrStreamSummary } from '@/lib/coaching/streamAnalysis'
import { computePaceFadeSummary, type StravaSplitMetric } from '@/lib/coaching/paceAnalysis'
import { ANTHROPIC_MODEL_DEEP } from '@/lib/ai/models'
import type { Plan, Session } from '@/types/plan'

const DAY_NAME: Record<string, string> = {
  mon: 'Monday',    tue: 'Tuesday', wed: 'Wednesday', thu: 'Thursday',
  fri: 'Friday',    sat: 'Saturday', sun: 'Sunday',
  monday: 'Monday', tuesday: 'Tuesday', wednesday: 'Wednesday', thursday: 'Thursday',
  friday: 'Friday', saturday: 'Saturday', sunday: 'Sunday',
}

// Cheerleader words — silent rejection. Mirrors daily-coach-note pattern.
const BAD_OUTPUT_RE = /\b(amazing|crushing|smash|beast mode|you['']ve got this|crushed|don['']t give up)\b/i

export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const tier = await getUserTier(user.id)
  if (!isFeatureAllowed('post_run_reframe', tier)) {
    return NextResponse.json({ error: 'Subscription required' }, { status: 403 })
  }

  const body = await req.json().catch(() => null) as
    | { week_n?: number; session_day?: string; user_note?: string }
    | null
  if (!body || typeof body.week_n !== 'number' || !body.session_day || !body.user_note) {
    return NextResponse.json({ error: 'week_n, session_day, user_note required' }, { status: 422 })
  }

  const userNote = body.user_note.trim().slice(0, REFRAME_TIER.USER_NOTE_MAX_CHARS)
  if (!userNote) {
    return NextResponse.json({ error: 'user_note empty after trim' }, { status: 422 })
  }

  const userId = user.id
  const weekN = body.week_n
  const sessionDay = body.session_day

  const service = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  // Parallel: plan, settings, completion, analysis (if linked), tier
  const [planRes, settingsRes, completionRes, analysisRes, tierResult] = await Promise.all([
    service.from('plans').select('plan_json').eq('user_id', userId).single(),
    service.from('user_settings').select('first_name, resting_hr, max_hr').eq('id', userId).maybeSingle(),
    service
      .from('session_completions')
      .select('rpe, fatigue_tag, avg_hr, coaching_flag, strava_activity_id, apple_health_uuid, strava_activity_km, updated_at')
      .eq('user_id', userId)
      .eq('week_n', weekN)
      .eq('session_day', sessionDay)
      .maybeSingle(),
    service
      .from('run_analysis')
      .select('hr_in_zone_pct, hr_above_ceiling_pct, hr_below_floor_pct, verdict')
      .eq('user_id', userId)
      .eq('week_n', weekN)
      .eq('session_day', sessionDay)
      .maybeSingle(),
    detectReframeTier(service, userId),
  ])

  const plan = planRes.data?.plan_json as Plan | null
  if (!plan || !plan.weeks.length) {
    return NextResponse.json({ error: 'No plan found' }, { status: 404 })
  }
  const week = plan.weeks[weekN - 1] as { sessions?: Record<string, Session>; phase?: string } | undefined
  const session = (week?.sessions?.[sessionDay] ?? null) as Session | null
  if (!session) {
    return NextResponse.json({ error: 'Session not found in plan' }, { status: 404 })
  }

  const completion = completionRes.data
  const analysis = analysisRes.data
  const dataTier = tierResult.tier

  // Build session execution snapshot — what just happened
  const rpe = completion?.rpe ?? null
  const fatigueTag = completion?.fatigue_tag ?? null
  const actualDistKm = completion?.strava_activity_km ?? null
  const actualAvgHr = completion?.avg_hr ?? null
  const hrInZonePct = analysis?.hr_in_zone_pct != null ? Number(analysis.hr_in_zone_pct) : null
  const hrAboveCeilingPct = analysis?.hr_above_ceiling_pct != null ? Number(analysis.hr_above_ceiling_pct) : null
  const hrBelowFloorPct = analysis?.hr_below_floor_pct != null ? Number(analysis.hr_below_floor_pct) : null

  // ── Environmental context — temperature + per-km splits from the matched activity ──
  // Available on Strava-sourced rows. Null on HealthKit, manual, and
  // pre-migration Strava activities. Fetched unconditionally — these
  // signals aren't gated by Tier A.
  let tempC: number | null = null
  let paceFadeSummary = null
  if (completion?.strava_activity_id || completion?.apple_health_uuid) {
    try {
      const filterCol = completion.strava_activity_id ? 'strava_activity_id' : 'apple_health_uuid'
      const filterVal = completion.strava_activity_id ?? completion.apple_health_uuid
      const { data: actRow } = await service
        .from('strava_activities')
        .select('avg_temp_c, splits_metric')
        .eq('user_id', userId)
        .eq(filterCol, filterVal)
        .maybeSingle()
      tempC = actRow?.avg_temp_c != null ? Number(actRow.avg_temp_c) : null
      paceFadeSummary = computePaceFadeSummary(
        actRow?.splits_metric as StravaSplitMetric[] | null,
      )
    } catch (err) {
      console.warn('[post-run-reframe] temp/splits fetch failed', err)
    }
  }

  // ── Tier A evidence: cohort + stream + previousSimilar ─────────────────
  let cohortContext = null
  let streamSummary = null
  let trendSeries = null
  let previousSimilarSession = null

  if (dataTier === 'A') {
    try {
      const fullHistory = await fetchRunHistory(service, userId, COHORT_SIMILARITY.WINDOW_DAYS_DEFAULT)
      const sixMonthsAgo = new Date()
      sixMonthsAgo.setDate(sixMonthsAgo.getDate() - COHORT_SIMILARITY.WINDOW_DAYS_DENSE)
      const recentCount = fullHistory.filter(r => r.startDate >= sixMonthsAgo).length
      const window = pickWindowDays(recentCount)
      const cohort = window === COHORT_SIMILARITY.WINDOW_DAYS_DENSE
        ? fullHistory.filter(r => r.startDate >= sixMonthsAgo)
        : fullHistory
      if (actualDistKm != null && actualAvgHr != null) {
        // Exclude the matched activity by start_date when known
        const excludeDate = completion?.updated_at ? new Date(completion.updated_at) : new Date(0)
        const similar = findSimilarRuns(cohort, { distanceKm: actualDistKm, avgHr: actualAvgHr }, excludeDate)
        if (similar.length >= COHORT_SIMILARITY.MIN_COHORT_SIZE) {
          cohortContext = summariseCohort(similar)
        }
      }

      // Multi-month trend (AI-DEPTH-03) — same-effort runs at this distance
      // bucketed by month. Returns null when below the threshold gates.
      if (actualDistKm != null) {
        trendSeries = buildHrTrendSeries(
          fullHistory,
          { sessionType: session.type, distanceKm: actualDistKm },
          TREND_SERIES.DEFAULT_WINDOW_MONTHS,
        )
      }
    } catch (err) {
      console.warn('[post-run-reframe] cohort/trend lookup failed', err)
    }

    // Stream summary — only available on HealthKit-sourced activities
    if (completion?.apple_health_uuid) {
      try {
        const { data: act } = await service
          .from('strava_activities')
          .select('raw_payload, moving_time_s')
          .eq('user_id', userId)
          .eq('apple_health_uuid', completion.apple_health_uuid)
          .maybeSingle()
        const samples = (act?.raw_payload as { hrSamples?: Array<{ valueBpm: number; timestamp: string }> } | null)?.hrSamples
        streamSummary = computeHrStreamSummary(samples ?? null, act?.moving_time_s ?? 0)
      } catch (err) {
        console.warn('[post-run-reframe] stream summary failed', err)
      }
    }

    // Previous similar session — walk recent run_analysis for the same session type
    try {
      const { data: priorRows } = await service
        .from('run_analysis')
        .select('week_n, session_day, verdict, hr_in_zone_pct, created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(20)
      for (const row of priorRows ?? []) {
        if (row.week_n === weekN && row.session_day === sessionDay) continue
        const priorWeek = plan.weeks[(row.week_n as number) - 1] as { sessions?: Record<string, Session> } | undefined
        const priorSession = priorWeek?.sessions?.[row.session_day as string]
        if (!priorSession || priorSession.type !== session.type) continue
        const createdMs = new Date(row.created_at as string).getTime()
        const daysAgo = Math.max(1, Math.round((Date.now() - createdMs) / 86_400_000))
        previousSimilarSession = {
          dayLabel: DAY_NAME[row.session_day as string] ?? (row.session_day as string),
          daysAgo,
          verdict: (row.verdict as string | null) ?? null,
          hrInZonePct: row.hr_in_zone_pct != null ? Number(row.hr_in_zone_pct) : null,
        }
        break
      }
    } catch (err) {
      console.warn('[post-run-reframe] previousSimilar lookup failed', err)
    }
  }

  // ── Tier B evidence: plan completion + RPE pattern + previousSimilar ───
  let planCompletion = null
  let recentRpePattern = null

  if (dataTier === 'B' || dataTier === 'A') {
    // Pull last 4 weeks of completions to compute both completion rate + RPE trend
    const windowStart = new Date()
    windowStart.setDate(windowStart.getDate() - REFRAME_TIER.TIER_B_WINDOW_DAYS)
    try {
      const { data: recent } = await service
        .from('session_completions')
        .select('week_n, session_day, status, rpe, updated_at')
        .eq('user_id', userId)
        .gte('updated_at', windowStart.toISOString())
      const completionsList = recent ?? []
      const completedCount = completionsList.filter(c => c.status === 'complete').length

      // Scheduled count = sessions in the last 4 plan weeks (approx — counts non-rest days)
      const currentWeekIdx = weekN - 1
      const startIdx = Math.max(0, currentWeekIdx - 3)
      let scheduledCount = 0
      for (let i = startIdx; i <= currentWeekIdx; i++) {
        const w = plan.weeks[i] as { sessions?: Record<string, Session> } | undefined
        if (!w?.sessions) continue
        for (const s of Object.values(w.sessions)) {
          if (s && s.type !== 'rest') scheduledCount++
        }
      }
      if (scheduledCount > 0) {
        planCompletion = {
          completed: completedCount,
          scheduled: scheduledCount,
          windowWeeks: 4,
        }
      }

      // RPE pattern for same session type — last 4 weeks split into recent half vs earlier half
      const sameTypeRpes: Array<{ rpe: number; ms: number }> = []
      for (const c of completionsList) {
        if (c.rpe == null) continue
        const w = plan.weeks[(c.week_n as number) - 1] as { sessions?: Record<string, Session> } | undefined
        const s = w?.sessions?.[c.session_day as string]
        if (!s || s.type !== session.type) continue
        sameTypeRpes.push({
          rpe: Number(c.rpe),
          ms: new Date(c.updated_at as string).getTime(),
        })
      }
      if (sameTypeRpes.length >= 4) {
        sameTypeRpes.sort((a, b) => a.ms - b.ms)
        const half = Math.floor(sameTypeRpes.length / 2)
        const earlier = sameTypeRpes.slice(0, half)
        const recent2 = sameTypeRpes.slice(-half)
        const earlierAvg = earlier.reduce((s, x) => s + x.rpe, 0) / earlier.length
        const recentAvg = recent2.reduce((s, x) => s + x.rpe, 0) / recent2.length
        recentRpePattern = {
          sessionType: session.type,
          recentAvg,
          earlierAvg,
          windowWeeks: 4,
        }
      }
    } catch (err) {
      console.warn('[post-run-reframe] tier-B evidence failed', err)
    }
  }

  // ── Tier C evidence: phase + sessions logged ───────────────────────────
  const phasePosition = week?.phase
    ? {
        phase: week.phase,
        weekInPhase: 1, // approximation — full phase math is in CoachingPrinciples §phases
        totalWeeksInPhase: plan.weeks.filter(w => (w as { phase?: string }).phase === week.phase).length,
      }
    : null

  let totalSessionsLogged: number | null = null
  try {
    const { count } = await service
      .from('session_completions')
      .select('week_n', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('status', 'complete')
    totalSessionsLogged = count ?? null
  } catch {
    // best-effort
  }

  // ── Risk gate — silence the reframe if overload signals fire ──────────
  // Reframe-positive against a risk signal is harm. brand.md § Reframe Voice.
  let recentFatigueTags: FatigueTag[] = []
  let recentCompletionFlags: CoachingFlag[] = []
  try {
    const { data: recentRows } = await service
      .from('session_completions')
      .select('fatigue_tag, coaching_flag, updated_at')
      .eq('user_id', userId)
      .not('updated_at', 'is', null)
      .order('updated_at', { ascending: false })
      .limit(REFRAME_RISK.REPEATED_OVERLOAD_WINDOW)
    recentFatigueTags = (recentRows ?? [])
      .map(r => r.fatigue_tag as FatigueTag | null)
      .filter((t): t is FatigueTag => t === 'Fresh' || t === 'Fine' || t === 'Heavy' || t === 'Wrecked')
    recentCompletionFlags = (recentRows ?? [])
      .map(r => r.coaching_flag as CoachingFlag | null)
      .filter((f): f is CoachingFlag => f === 'ok' || f === 'watch' || f === 'flag')
  } catch (err) {
    console.warn('[post-run-reframe] risk-gate context fetch failed', err)
  }

  const riskOutcome = assessReframeRiskGate({
    currentSessionFlag: (completion?.coaching_flag as CoachingFlag | null) ?? null,
    recentCompletionFlags,
    recentFatigueTags,
    hrDriftBpm: streamSummary?.hrDriftBpm ?? null,
    hrDriftPct: streamSummary?.hrDriftPct ?? null,
  })

  if (riskOutcome.silenced) {
    // Persist a silenced row — the runner's note is sacred even when we
    // don't reframe. The warning message is what the UI shows.
    const { error: silencedErr } = await service
      .from('session_reflections')
      .upsert({
        user_id: userId,
        week_n: weekN,
        session_day: sessionDay,
        note_text: userNote,
        note_source: 'text',
        reframe_text: null,
        reframe_data_tier: dataTier,
        reframe_model: ANTHROPIC_MODEL_DEEP,
        reframe_prompt_version: REFRAME_PROMPT_VERSION,
        reframe_silenced: true,
        reframe_silenced_reason: riskOutcome.reason,
        reframe_generated_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id,week_n,session_day' })
    if (silencedErr) console.warn('[post-run-reframe] silenced persist failed', silencedErr)

    return NextResponse.json({
      reframe: null,
      tier: dataTier,
      silenced: true,
      silencedReason: riskOutcome.reason,
      silencedMessage: riskOutcome.message,
      fallback: false,
    }, { status: 200 })
  }

  // ── Limiter hypothesis (deterministic) ────────────────────────────────
  // Reuse risk-gate fatigue array — same window (last 5), same definition
  // of "high fatigue". Avoids a redundant query.
  const recentHighFatigueCount = recentFatigueTags
    .filter((t) => (FATIGUE_HIGH_TAGS as readonly string[]).includes(t))
    .length
  const liveBand = sessionHRBand(
    session.type,
    settingsRes.data?.resting_hr ?? null,
    settingsRes.data?.max_hr ?? null,
  )
  // RACE-DEBRIEF-02 — the runner's own race account (race week only). Feeds the
  // reframe's race override and the limiter's injury silence guard (§71.3).
  const raceResult = (week as any)?.result_embedded ?? null

  const limiter = inferLimiter({
    sessionType:            session.type,
    actualAvgHr,
    prescribedHrCeiling:    liveBand?.hi ?? null,
    hrAboveCeilingPct,
    hrBelowFloorPct,
    streamSummary,
    paceFadeSummary,
    tempC,
    rpe,
    fatigueTag,
    recentHighFatigueCount,
    actualDistKm,
    plannedDistKm:          (session as any).distance_km ?? null,
    injuryFlagged:          raceInjuryFlagged(raceResult),
  })

  // ── Build prompt + call Sonnet ────────────────────────────────────────
  const prompt = buildSessionReframePrompt({
    userNote,
    tier: dataTier,
    session,
    weekN,
    plan,
    rpe,
    fatigueTag,
    actualDistKm,
    actualAvgHr,
    hrInZonePct,
    hrAboveCeilingPct,
    hrBelowFloorPct,
    cohortContext,
    streamSummary,
    trendSeries,
    planCompletion,
    recentRpePattern,
    previousSimilarSession,
    phasePosition,
    totalSessionsLogged,
    athleteContext: buildAthleteContext({ plan }),
    firstName: settingsRes.data?.first_name ?? null,
    tempC,
    limiter,
    paceFadeSummary,
    raceResult,
  })

  let reframeText: string | null = null
  try {
    const aiRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY!,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: ANTHROPIC_MODEL_DEEP,
        max_tokens: 300,
        messages: [{ role: 'user', content: prompt }],
      }),
    })
    if (aiRes.ok) {
      const aiData = await aiRes.json()
      const raw = (aiData.content?.[0]?.text ?? '').trim()
      const cleaned = raw.replace(/^["']|["']$/g, '').trim()
      if (cleaned && !BAD_OUTPUT_RE.test(cleaned)) {
        reframeText = cleaned
      }
    }
  } catch (err) {
    console.warn('[post-run-reframe] AI call failed', err)
  }

  if (!reframeText) {
    return NextResponse.json({ reframe: null, tier: dataTier, fallback: true }, { status: 200 })
  }

  // Persist
  const { error: upsertErr } = await service
    .from('session_reflections')
    .upsert({
      user_id: userId,
      week_n: weekN,
      session_day: sessionDay,
      note_text: userNote,
      note_source: 'text',
      reframe_text: reframeText,
      reframe_data_tier: dataTier,
      reframe_model: ANTHROPIC_MODEL_DEEP,
      reframe_prompt_version: REFRAME_PROMPT_VERSION,
      reframe_silenced: false,
      reframe_generated_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,week_n,session_day' })

  if (upsertErr) {
    console.warn('[post-run-reframe] persist failed', upsertErr)
  }

  return NextResponse.json({ reframe: reframeText, tier: dataTier, fallback: false }, { status: 200 })
}
