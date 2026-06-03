import { getUserFromRequest } from '@/lib/supabase/getUserFromRequest'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { getUserTier } from '@/lib/trial'
import { isFeatureAllowed } from '@/lib/plan/canUseFeature'
import { checkAdjustmentTriggers } from '@/lib/coaching/planAdjustment'
import { COACHING_RULE_ENGINE_VERSION } from '@/lib/coaching/constants'
import { buildAdjustmentExplanationPrompt } from '@/lib/coaching/prompts/planAdjustment'
import { buildAthleteContext } from '@/lib/coaching/prompts/athleteContext'
import { getCurrentWeekIndex } from '@/lib/plan'
import { savePlanForUser } from '@/lib/plan'
import type { Plan } from '@/types/plan'
import { ANTHROPIC_MODEL_DEEP } from '@/lib/ai/models'
import { BRAND } from '@/lib/brand'
import { notifyUser } from '@/lib/webpush'
import { recordNotification } from '@/lib/notifications'

// POST /api/adjust-plan
// Auth-gated (paid/trial). Checks adjustment triggers for the current week.
// If a trigger fires: saves to plan_adjustments (status: pending).
// Auto-applies low-risk adjustments; requires confirmation for significant ones.
//
// Every successful engine evaluation also stamps user_settings with the check
// time and outcome — powers the "Last checked …" line in the Me screen so the
// feature is visible even when it has nothing to suggest. Early-exit paths
// (subscription required / user_disabled / no plan) intentionally do NOT
// stamp, since the engine never ran.

// Typed loosely on purpose: SupabaseClient generics are awkward to thread
// through, and this helper is internal to this route.
async function recordAdjustmentCheck(
  serviceSupabase: any, // eslint-disable-line @typescript-eslint/no-explicit-any
  userId: string,
  foundChange: boolean,
): Promise<void> {
  await serviceSupabase
    .from('user_settings')
    .update({
      last_adjustment_check_at:           new Date().toISOString(),
      last_adjustment_check_found_change: foundChange,
    })
    .eq('id', userId)
}

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const tier = await getUserTier(user.id)
  if (!isFeatureAllowed('dynamic_reshape_r20', tier)) {
    return NextResponse.json({ error: 'Subscription required' }, { status: 403 })
  }

  // Parse body signals
  const body        = await req.json().catch(() => ({}))
  const isManual    = body?.manual === true
  // Trigger 5: RPE disconnect
  const rpeSignal: { rpe: number; sessionType: string } | undefined =
    body?.rpe != null && body?.sessionType ? { rpe: body.rpe, sessionType: body.sessionType } : undefined
  // Trigger 2: Skip with reason
  const skipSignalRaw: { reason: string; sessionType: string; sessionDay: string } | undefined =
    body?.skipReason ? { reason: body.skipReason, sessionType: body.sessionType ?? 'easy', sessionDay: body.sessionDay ?? 'mon' } : undefined
  // Trigger 1: Session reorder
  const reorderSignal: { fromDay: string; toDay: string } | undefined =
    body?.fromDay && body?.toDay ? { fromDay: body.fromDay, toDay: body.toDay } : undefined

  // Explicit user signals bypass the opt-out toggle
  const isExplicitSignal = !!(skipSignalRaw || reorderSignal)

  // Respect the user's dynamic adjustments opt-out for automatic triggers only
  if (!isManual && !isExplicitSignal) {
    const { data: settings } = await supabase
      .from('user_settings')
      .select('dynamic_adjustments_enabled')
      .eq('id', user.id)
      .single()
    if (settings?.dynamic_adjustments_enabled === false) {
      return NextResponse.json({ skipped: true, reason: 'user_disabled' })
    }
  }

  const serviceSupabase = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // Fetch plan first — weekN is needed to scope the adjustment count query.
  const planRes = await serviceSupabase.from('plans').select('plan_json').eq('user_id', user.id).single()

  const plan = planRes.data?.plan_json as Plan | null
  if (!plan || plan.weeks.length === 0) {
    return NextResponse.json({ error: 'No plan found' }, { status: 404 })
  }

  const weekIndex = getCurrentWeekIndex(plan.weeks)
  const weekN     = weekIndex + 1
  const week      = plan.weeks[weekIndex]

  // Resolve current training phase from plan.phases (R23+ plans only)
  const currentPhase = plan.phases
    ? plan.phases.find(p => p.start_week <= weekN && weekN <= p.end_week)?.name
    : undefined

  const DAY_ORDER: Record<string, number> = { mon: 0, tue: 1, wed: 2, thu: 3, fri: 4, sat: 5, sun: 6 }

  const [analysisRes, prevWeeksRes, adjustmentsThisWeekRes, existingPendingRes, completionsRes, lastResolvedAdjustmentRes] = await Promise.all([
    serviceSupabase
      .from('run_analysis')
      // ENGINE-01/02: week_n, pace_score, hr_above_ceiling_pct, distance_score added
      // for fitness-signal and long-run-shortfall triggers.
      .select('week_n, session_day, hr_in_zone_pct, actual_load_km, planned_load_km, ef_trend_pct, pace_score, hr_above_ceiling_pct, distance_score')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(30),
    serviceSupabase
      .from('run_analysis')
      .select('week_n, actual_load_km')
      .eq('user_id', user.id)
      .order('week_n', { ascending: false })
      .limit(40),
    serviceSupabase
      .from('plan_adjustments')
      .select('id')
      .eq('user_id', user.id)
      .eq('week_n', weekN)
      .in('status', ['pending', 'confirmed', 'auto_applied']),
    // Return any existing pending adjustment rather than creating a duplicate
    serviceSupabase
      .from('plan_adjustments')
      .select('*')
      .eq('user_id', user.id)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    // Recent fatigue tags for Trigger 4 (fatigue_accumulation)
    serviceSupabase
      .from('session_completions')
      .select('week_n, session_day, fatigue_tag')
      .eq('user_id', user.id)
      .eq('status', 'complete')
      .not('fatigue_tag', 'is', null)
      .order('week_n', { ascending: false })
      .limit(10),
    // AI-DEPTH-10 — connective tissue. Most recent non-pending adjustment
    // (confirmed / auto_applied / reverted) so the new explanation can
    // reference continuity or contradiction with what just happened.
    serviceSupabase
      .from('plan_adjustments')
      .select('summary, trigger_type, adjustment_type, week_n, created_at, status')
      .eq('user_id', user.id)
      .in('status', ['confirmed', 'auto_applied', 'reverted'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ])

  const analyses = analysisRes.data ?? []

  // Sort completions chronologically (oldest first) for consecutive-tag detection
  const recentFatigueTags: string[] = (completionsRes.data ?? [])
    .slice()
    .sort((a: any, b: any) => {
      if (a.week_n !== b.week_n) return a.week_n - b.week_n
      return (DAY_ORDER[a.session_day] ?? 99) - (DAY_ORDER[b.session_day] ?? 99)
    })
    .map((c: any) => c.fatigue_tag as string)

  // Return existing pending adjustment instead of creating a duplicate
  if (existingPendingRes.data) {
    await recordAdjustmentCheck(serviceSupabase, user.id, true)
    return NextResponse.json({ adjustment: existingPendingRes.data, requires_confirmation: true })
  }

  // Count of adjustments already made this week — enforces MAX_ADJUSTMENTS_PER_WEEK.
  const adjustmentsThisWeek = (adjustmentsThisWeekRes.data ?? []).length

  // Build aggregates for trigger check
  const thisWeekAnalyses = analyses.filter((a: any) => a.session_day.startsWith(`week_${weekN}_`))
  const thisWeekKm       = thisWeekAnalyses.reduce((s: number, a: any) => s + (a.actual_load_km ?? 0), 0)
  const plannedKm        = week.weekly_km ?? 0

  const weekLoadMap: Record<number, number> = {}
  ;(prevWeeksRes.data ?? []).forEach((r: any) => {
    if (!weekLoadMap[r.week_n]) weekLoadMap[r.week_n] = 0
    weekLoadMap[r.week_n] += r.actual_load_km ?? 0
  })
  const priorWeeksKm = Object.entries(weekLoadMap)
    .filter(([n]) => Number(n) < weekN)
    .sort(([a], [b]) => Number(b) - Number(a))
    .slice(0, 4)
    .map(([, km]) => km)

  const hrInZoneData = thisWeekAnalyses.map((a: any) => ({
    hrInZonePct:  a.hr_in_zone_pct ?? null,
    actualLoadKm: a.actual_load_km ?? null,
  }))

  const efTrendValues = thisWeekAnalyses.map((a: any) => a.ef_trend_pct).filter((v: any) => v !== null)
  const efTrendPct    = efTrendValues.length
    ? efTrendValues.reduce((s: number, v: number) => s + v, 0) / efTrendValues.length
    : null

  const currentWeekSessions = Object.values(week.sessions).filter(Boolean) as any[]

  const skipSignal = skipSignalRaw
    ? { ...skipSignalRaw, weekSessionsByDay: week.sessions as Record<string, any> }
    : undefined

  // ENGINE-01 — Fitness signal: quality sessions from recent weeks.
  // Cross-reference session_day against plan to determine session type.
  // Only include sessions where pace_score is non-null (VDOT-based plans only).
  const QUALITY_TYPES = new Set(['quality', 'intervals', 'tempo'])
  const recentQualityAnalyses = (analysisRes.data ?? [])
    .filter((a: any) => {
      if (a.pace_score === null || a.pace_score === undefined) return false
      // Derive session type from plan week for this analysis row
      const w = plan.weeks.find((pw: any) => pw.n === a.week_n)
      const s = (w?.sessions as any)?.[a.session_day as string]
      return s && QUALITY_TYPES.has((s as any).type)
    })
    .slice(0, 10) // last 10 quality sessions at most
    .map((a: any) => ({
      paceScore:         a.pace_score as number,
      hrAboveCeilingPct: a.hr_above_ceiling_pct as number | null,
      weekN:             a.week_n as number,
    }))

  // ENGINE-02 — Long run shortfall: long run sessions from recent weeks.
  const recentLongRunAnalyses = (analysisRes.data ?? [])
    .filter((a: any) => {
      if (a.actual_load_km === null || a.actual_load_km === undefined) return false
      const w = plan.weeks.find((pw: any) => pw.n === a.week_n)
      const s = (w?.sessions as any)?.[a.session_day as string]
      return s && (s as any).type === 'long'
    })
    .slice(0, 4) // last 4 long runs at most
    .map((a: any) => {
      const w = plan.weeks.find((pw: any) => pw.n === a.week_n)
      const s = (w?.sessions as any)?.[a.session_day as string]
      return {
        actualKm:  a.actual_load_km as number,
        plannedKm: (s as any)?.distance_km as number | null ?? null,
        weekN:     a.week_n as number,
      }
    })

  const proposed = checkAdjustmentTriggers({
    currentWeekN:         weekN,
    totalWeeks:           plan.weeks.length,
    currentWeekSessions,
    actualKm:             thisWeekKm,
    plannedKm,
    priorWeeksKm,
    hrInZoneData,
    efTrendPct,
    adjustmentsThisWeek,
    currentPhase,
    recentFatigueTags,
    rpeSignal,
    skipSignal,
    reorderSignal,
    recentQualityAnalyses,
    recentLongRunAnalyses,
  })

  if (!proposed) {
    await recordAdjustmentCheck(serviceSupabase, user.id, false)
    return NextResponse.json({ adjustment: null, message: 'No adjustment needed' })
  }

  // AI explanation — silent fallback to rule-based summary
  let explanationText: string = proposed.summary
  try {
    // AI-DEPTH-10 — pass the most recent non-pending adjustment as continuity context.
    // Null when this is the user's first adjustment ever.
    const previousAdjustment = lastResolvedAdjustmentRes.data
      ? {
          summary:        lastResolvedAdjustmentRes.data.summary as string,
          triggerType:    lastResolvedAdjustmentRes.data.trigger_type as string,
          adjustmentType: lastResolvedAdjustmentRes.data.adjustment_type as string,
          status:         lastResolvedAdjustmentRes.data.status as string,
          daysAgo: Math.max(
            0,
            Math.round(
              (Date.now() - new Date(lastResolvedAdjustmentRes.data.created_at as string).getTime()) / 86_400_000,
            ),
          ),
        }
      : null
    const prompt  = buildAdjustmentExplanationPrompt(proposed, buildAthleteContext({ plan }), previousAdjustment)
    const aiRes   = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type':    'application/json',
        'x-api-key':       process.env.ANTHROPIC_API_KEY!,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model:      ANTHROPIC_MODEL_DEEP,
        max_tokens: 150,
        messages:   [{ role: 'user', content: prompt }],
      }),
    })
    if (aiRes.ok) {
      const aiData = await aiRes.json()
      const text   = aiData.content?.[0]?.text?.trim()
      if (text) explanationText = text
    }
  } catch {
    // silent fallback to rule-based summary
  }

  // Manual triggers always require confirmation — user should review what they asked for
  const status = (proposed.requiresConfirmation || isManual) ? 'pending' : 'auto_applied'

  const adjustmentRow = {
    user_id:         user.id,
    week_n:          weekN,
    trigger_type:    proposed.trigger.type,
    trigger_detail:  proposed.trigger.detail,
    adjustment_type: proposed.adjustmentType,
    summary:         explanationText,
    sessions_before: proposed.sessionsBefore,
    sessions_after:  proposed.sessionsAfter,
    status,
    rule_engine_version: COACHING_RULE_ENGINE_VERSION,
    confirmed_at:    status === 'auto_applied' ? new Date().toISOString() : null,
  }

  const { data: inserted, error: insertError } = await serviceSupabase
    .from('plan_adjustments')
    .insert(adjustmentRow)
    .select()
    .single()

  if (insertError) {
    console.error('[adjust-plan] insert failed', insertError.message)
    return NextResponse.json({ error: 'Failed to save adjustment' }, { status: 500 })
  }

  // For auto-applied adjustments, update the plan immediately
  if (status === 'auto_applied') {
    const updatedPlan = applyAdjustmentToPlan(plan, weekN, proposed.sessionsAfter)
    await savePlanForUser(user.id, updatedPlan, supabase)

    // NOTIF-01 — an engine tweak happened *to* the runner without them asking,
    // so tell them: push + durable inbox row. Manual adjustments are excluded —
    // the user made that change themselves; pushing it back is noise.
    if (!isManual) {
      const url = '/dashboard?screen=plan'
      void notifyUser(user.id, {
        title: BRAND.push.planAdjusted,
        body:  explanationText,
        tag:   'plan-adjustment',
        data:  { url },
      })
      void recordNotification(user.id, {
        type:  'plan_adjustment',
        title: BRAND.push.planAdjusted,
        body:  explanationText,
        url,
      })
    }
  }

  // NOTIF-01 (pending path) — engine detected something that needs the runner's
  // confirmation but previously had no active channel to reach them. Without this,
  // the adjustment sits silently in the DB until they happen to open Me.
  //
  // Scope: automatic triggers only. Skip and reorder are user-initiated
  // (isExplicitSignal) — they already know what they asked for. Manual
  // (ReshapeScreen "Check now") is the user polling — no notification either.
  //
  // Deep-link to Me so the "1 change pending · Tap to review" badge is the
  // first thing they see. One more tap takes them to ReshapeScreen to confirm.
  if (status === 'pending' && !isManual && !isExplicitSignal) {
    const url = '/dashboard?screen=me'
    void notifyUser(user.id, {
      title: BRAND.push.planNeedsReview,
      body:  explanationText,
      tag:   'plan-adjustment',
      data:  { url },
    })
    void recordNotification(user.id, {
      type:  'plan_adjustment',
      title: BRAND.push.planNeedsReview,
      body:  explanationText,
      url,
    })
  }

  await recordAdjustmentCheck(serviceSupabase, user.id, true)
  return NextResponse.json({ adjustment: inserted, requires_confirmation: proposed.requiresConfirmation })
}

function applyAdjustmentToPlan(plan: Plan, weekN: number, sessionsAfter: any[]): Plan {
  const updated = JSON.parse(JSON.stringify(plan)) as Plan
  const week    = updated.weeks.find(w => w.n === weekN)
  if (!week) return updated

  const days = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const
  days.forEach((day, idx) => {
    if (sessionsAfter[idx]) {
      week.sessions[day] = sessionsAfter[idx]
    }
  })
  return updated
}
