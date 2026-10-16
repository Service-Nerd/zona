import { getUserFromRequest } from '@/lib/supabase/getUserFromRequest'
import { getUserDisplayPrefs } from '@/lib/userPrefs'
import { guardAiRequest } from '@/lib/ai/guardAiRequest'
import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { getUserTier } from '@/lib/trial'
import { isFeatureAllowed } from '@/lib/plan/canUseFeature'
// ADJUST-ENGINE-ENTRY-01 — ONE engine door for the synchronous adjustment path.
// `fetchWeeklyLoad` is the exception and is I/O, not engine: the FETCH is the
// caller's, what the triggers read off the result is the engine's.
import { runAdjustmentEngine, acceptAiSummary } from '@/lib/coaching/adjustmentEngine'
import { fetchWeeklyLoad } from '@/lib/coaching/weeklyActualLoad'
// The AI layer stays here (ADR-006): these two assemble runner-facing voice for a
// model the engine may not call, and their failure must be silent.
import { buildAdjustmentExplanationPrompt } from '@/lib/coaching/prompts/planAdjustment'
import { buildAthleteContext } from '@/lib/coaching/prompts/athleteContext'
import { getCurrentWeekIndex, savePlanForUser, readPlanJson } from '@/lib/plan'
import { recordOpsEvent } from '@/lib/ops/recordOpsEvent'
import type { Plan } from '@/types/plan'
import { ANTHROPIC_MODEL_DEEP } from '@/lib/ai/models'
import { callAnthropic } from '@/lib/ai/callAnthropic'
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
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // 🔴 ADJUST-PLAN-SAVE-CLIENT-01 — THIS ROUTE AUTHENTICATES OFF THE BEARER TOKEN
  // AND USED TO HAND `savePlanForUser` A COOKIE CLIENT. On native there is no
  // cookie session, so `auth.uid()` is NULL, `plans` RLS refuses the upsert and
  // the save throws — while the adjustment row had already been written. Measured
  // on the founder's account: 3 `plan_save_failed` events (2026-10-11, 2×2026-08-17),
  // every one `new row violates row-level security policy for table "plans"`, and
  // a `plan_integrity_mismatch` the next day because `plans.updated_at` was 8 days
  // older than the adjustment that claimed to have changed it.
  //
  // This is the WRITE half of `RECALIBRATE-ZONES-COOKIE-CLIENT-01` (2026-09-25).
  // That item fixed the read and its guard keys on `fetchPlanForUser`, so it was
  // structurally unable to see a save. The guard now keys on both.
  //
  // ⚠️ SERVICE, NOT USER-SCOPED, AND THE REASON IS A HELPER RATHER THAN A TABLE.
  // The first cut of this fix used `createUserScopedClient`, reasoning that `plans`,
  // `plan_archive` and `plan_weekly_notes` all carry `auth.uid() = user_id` policies
  // so RLS could stay live. That checked what `savePlanForUser` WRITES and not what
  // it CALLS: it invokes `reanchorCharityGrant`, which UPDATEs `charity_codes`, and a
  // user-scoped client may only SELECT that table. The write would have no-opped
  // SILENTLY and charity grants would have stopped re-anchoring to race day — for the
  // 500 Make-A-Wish runners. `rlsCoverage.test.ts` caught it, which is exactly why
  // that gate and `CLIENT_ACCEPTING_HELPERS` exist.
  const serviceSupabase = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const tier = await getUserTier(user.id)
  if (!isFeatureAllowed('dynamic_reshape_r20', tier)) {
    return NextResponse.json({ error: 'Subscription required' }, { status: 403 })
  }

  // Parse body signals
  const guard = await guardAiRequest(req, user.id, 'adjust-plan')
  if (!guard.ok) return guard.response
  const body        = guard.body
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
    const { data: settings } = await serviceSupabase
      .from('user_settings')
      .select('dynamic_adjustments_enabled')
      .eq('id', user.id)
      .single()
    if (settings?.dynamic_adjustments_enabled === false) {
      return NextResponse.json({ skipped: true, reason: 'user_disabled' })
    }
  }

  // Fetch plan first — weekN is needed to scope the adjustment count query.
  const planRes = await readPlanJson(serviceSupabase, user.id)

  // PLANS-SINGLE-NOT-MAYBE-01 — a failed READ is not "no plan": answering that would be false.
  if (planRes.error) return NextResponse.json({ error: 'Could not load your plan' }, { status: 500 })
  const plan = planRes.plan as Plan | null
  if (!plan || plan.weeks.length === 0) {
    return NextResponse.json({ error: 'No plan found' }, { status: 404 })
  }

  // ⚠️ RESOLVED HERE, NOT IN THE ENGINE, AND THE REASON IS NECESSITY RATHER THAN
  // DOCTRINE: `weekN` scopes three of the queries below, so it has to be known
  // before the engine can be called. It is passed in.
  const weekN = getCurrentWeekIndex(plan.weeks) + 1

  const [analysisRes, adjustmentsThisWeekRes, existingPendingRes, completionsRes, lastResolvedAdjustmentRes] = await Promise.all([
    serviceSupabase
      .from('run_analysis')
      // ENGINE-01/02: week_n, pace_score, hr_above_ceiling_pct, distance_score added
      // for fitness-signal and long-run-shortfall triggers.
      .select('week_n, session_day, hr_in_zone_pct, actual_load_km, planned_load_km, actual_load_mins, planned_load_mins, ef_trend_pct, pace_score, hr_above_ceiling_pct, distance_score')
      .eq('user_id', user.id)
      .is('superseded_at', null)   // PLAN-WEEK-COLLISION-01: live plan only
      .order('created_at', { ascending: false })
      .limit(30),
    // ⚠️ The prior-weeks `run_analysis` query that used to sit here is GONE.
    // `fetchWeeklyLoad` answers the same question from the activity log, and
    // leaving a second producer alive is how DELOAD-OWNER-01 happened.
    serviceSupabase
      .from('plan_adjustments')
      .select('id')
      .eq('user_id', user.id)
      .is('superseded_at', null)   // PLAN-WEEK-COLLISION-01: live plan only
      .eq('week_n', weekN)
      .in('status', ['pending', 'confirmed', 'auto_applied']),
    // Return any existing pending adjustment rather than creating a duplicate
    serviceSupabase
      .from('plan_adjustments')
      .select('*')
      .eq('user_id', user.id)
      .is('superseded_at', null)   // PLAN-WEEK-COLLISION-01: live plan only
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    // Recent reported cost for Trigger 4 (fatigue_accumulation, §112).
    //
    // 🔴 WIDENED AT §112, AND THE OLD SHAPE IS WHY THE TRIGGER COULD NOT SEE A
    // SKIP. `.eq('status', 'complete')` meant a skipped session was NEVER in
    // this window — not since part 1 moved the column, but from the beginning.
    // So the runner most obviously reporting cost, the one who could not start,
    // was the one the trigger was blind to.
    //
    // RESHAPE-FIX-WAVE2B-AUDIT's bare-stub protection is PRESERVED, not
    // dropped: a data-less "done" tap has null in BOTH columns, so the `.or()`
    // excludes it exactly as `.not('fatigue_tag','is',null)` used to.
    serviceSupabase
      .from('session_completions')
      .select('week_n, session_day, fatigue_tag, skip_reason, status')
      .eq('user_id', user.id)
      .is('superseded_at', null)   // PLAN-WEEK-COLLISION-01: live plan only
      .in('status', ['complete', 'skipped'])
      .or('fatigue_tag.not.is.null,skip_reason.not.is.null')
      .order('week_n', { ascending: false })
      .limit(10),
    // AI-DEPTH-10 — connective tissue. Most recent non-pending adjustment
    // (confirmed / auto_applied / reverted) so the new explanation can
    // reference continuity or contradiction with what just happened.
    serviceSupabase
      .from('plan_adjustments')
      .select('summary, trigger_type, adjustment_type, week_n, created_at, status')
      .eq('user_id', user.id)
      .is('superseded_at', null)   // PLAN-WEEK-COLLISION-01: live plan only
      .in('status', ['confirmed', 'auto_applied', 'reverted'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ])

  // Return existing pending adjustment instead of creating a duplicate
  if (existingPendingRes.data) {
    await recordAdjustmentCheck(serviceSupabase, user.id, true)
    return NextResponse.json({ adjustment: existingPendingRes.data, requires_confirmation: true })
  }

  // Count of adjustments already made this week — enforces MAX_ADJUSTMENTS_PER_WEEK.
  const adjustmentsThisWeek = (adjustmentsThisWeekRes.data ?? []).length

  // 🔴 LOG-OFFPLAN-01 — the week's load comes from the SINGLE OWNER, which reads
  // the activity log rather than `run_analysis`. Five routes had hand-rolled this
  // sum and they agreed only by accident; §68 Am.1 records one of them querying a
  // table that has neither column, silently, for four months.
  //
  // ⚠️ THE FETCH IS THE CALLER'S; WHAT THE TRIGGERS READ OFF IT IS THE ENGINE'S.
  // `priorWeeks` and the linked/off-plan split moved behind the entry point with
  // the triggers that read them, because which figure feeds which trigger is the
  // board's ruling (ADJUST-ENGINE-ENTRY-01).
  //
  // ⚠️ A FETCH FAILURE MUST NOT READ AS "THE RUNNER DID NOTHING". An empty map
  // would mean zero load, a ratio of 1.0 and a shadow of 0 — every load trigger
  // silently disarmed, which is §68 Am.1's failure exactly (an error destructured
  // away, a feature applying to nobody for four months). So this refuses to decide
  // rather than deciding on absent data, and the engine is never called at all.
  let weeklyLoad
  try {
    weeklyLoad = await fetchWeeklyLoad(serviceSupabase, user.id, plan)
  } catch (err) {
    console.error('[adjust-plan] LOG-OFFPLAN-01 weekly load unavailable', err)
    return NextResponse.json(
      { error: 'Could not read this week\'s load. No adjustment was checked.' },
      { status: 503 },
    )
  }

  // ADJUST-ENGINE-ENTRY-01 — THE ENGINE, in one call. Row→signal assembly, the
  // trigger stack, §69 magnitude, the prospective plan and the constitutional
  // re-validation all live behind this door. Everything above and below it is the
  // caller's: auth, the paywall, persistence, the AI pass and telemetry.
  const outcome = runAdjustmentEngine({
    plan,
    weekN,
    isManual,
    adjustmentsThisWeek,
    analyses:    analysisRes.data ?? [],
    completions: completionsRes.data ?? [],
    weeklyLoad,
    rpeSignal,
    skipSignal: skipSignalRaw,
    reorderSignal,
  })

  // The engine RAN and found nothing. The check is still stamped — that line
  // reports that the engine ran, not that it changed something, which is why the
  // early-exit paths above (403 / user_disabled / 404) deliberately do not stamp.
  if (outcome.kind === 'none') {
    await recordAdjustmentCheck(serviceSupabase, user.id, false)
    return NextResponse.json({ adjustment: null, message: 'No adjustment needed' })
  }

  // ⚠️ DESTRUCTURED, NOT PROPERTY-ACCESSED, AND THAT IS LOAD-BEARING: a new
  // `AdjustmentOutcome` kind fails to have these fields, so `tsc` flags it here.
  // That guard is real and incidental, so `adjustmentOutcomeHandled.test.ts`
  // asserts the property directly as well.
  const { proposed, status, requiresConfirmation, updatedPlan, reshapeErrors, ruleEngineVersion } = outcome

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
    // PROMPT-UNITS-ADJUST-01 — the runner's own units reach the model.
    //
    // ADR-015 Amendment: the AI layer is a display surface, so a miles runner must
    // not be told why their plan changed in kilometres. This route never read
    // `getUserDisplayPrefs`, which is why `buildAdjustmentExplanationPrompt`
    // carried a hardcoded `'km'` as a declared gap.
    const { units } = await getUserDisplayPrefs(serviceSupabase, user.id)
    const prompt  = buildAdjustmentExplanationPrompt(
      proposed, units, buildAthleteContext({ plan }), previousAdjustment)
    const aiRes   = await callAnthropic({
      surface:    'adjust-plan',
      model:      ANTHROPIC_MODEL_DEEP,
      maxTokens:  150,
      messages:   [{ role: 'user', content: prompt }],
      userId:     user.id,
    })
    if (aiRes.ok) {
      const text = aiRes.text.trim()
      if (text) {
        // RESHAPE-FIX-WAVE2A — validate the AI's prose against the structural
        // diff before publishing. The 2026-06-26 incident shipped a summary
        // ("the 24km run stays intact") that flatly contradicted the diff (the
        // 24km run moved). Anti-confabulation rules in the prompt failed to catch
        // it; the validator is the safety net.
        //
        // ⚠️ THE CHECK IS THE ENGINE'S, THE FALLBACK IS OURS. `acceptAiSummary`
        // asks "does this prose contradict what I changed?" and the engine is the
        // only thing holding the diff. What the runner reads on a rejection is the
        // caller's call: the rule-engine summary, silently (ADR-006), with the
        // reason logged so prompt drift surfaces.
        const verdict = acceptAiSummary(proposed, text)
        if (verdict.ok) {
          explanationText = text
        } else {
          console.warn('[adjust-plan] AI summary rejected by validator:', verdict.reason)
        }
      }
    }
  } catch {
    // silent fallback to rule-based summary
  }

  // RESHAPE-FIX-WAVE3-PHASE2 (Hutchinson) — the constitutional layer ran on the
  // reshaped plan INSIDE the engine, BEFORE anything is persisted, and the
  // prospective plan was built ONCE (reused by the auto-apply save below).
  //
  // ⚠️ THE CHECK IS THE ENGINE'S; THE REACTION IS DELIBERATELY NOT. Dev/test:
  // error-severity violations throw so property and matrix tests fail loudly.
  // Prod: record to `ops_events` and soft-degrade rather than break the runner's
  // flow, mirroring `generateRulePlan`'s posture. Both stay here, verbatim,
  // because the message and the ops event are observable and a refactor must not
  // quietly reword either (ADJUST-ENGINE-ENTRY-01).
  if (reshapeErrors.length > 0) {
    if (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test') {
      throw new Error(`reshape produced invalid plan: ${reshapeErrors.map(v => v.code).join(', ')}`)
    }
    await recordOpsEvent(
      'reshape_invalid',
      { route: 'adjust-plan', week_n: weekN, violations: reshapeErrors.map(v => ({ code: v.code, week: v.week, message: v.message })) },
      user.id,
    )
    console.error('[adjust-plan] reshape validation failed', reshapeErrors)
  }

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
    rule_engine_version: ruleEngineVersion,
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

  // For auto-applied adjustments, update the plan immediately (updatedPlan was
  // computed + constitutionally validated above).
  if (status === 'auto_applied') {
    // OPS-01: the plan_adjustments row is already written, so if this save
    // throws we'd have a recorded "auto_applied" adjustment with no matching
    // plan_json change — the exact 2026-06-26 incident. Record the failure to
    // ops_events before rethrowing so it's visible without waiting for the
    // daily integrity probe (or founder dogfooding).
    try {
      await savePlanForUser(user.id, updatedPlan, serviceSupabase)
    } catch (err) {
      await recordOpsEvent(
        'plan_save_failed',
        { route: 'adjust-plan', week_n: weekN, message: err instanceof Error ? err.message : String(err) },
        user.id,
      )
      throw err
    }

    // RESHAPE-FIX-WAVE3-PHASE2 (NOTIF quietness) — an auto-applied adjustment is
    // sub-threshold by construction (§69: high-magnitude changes route to
    // `pending` and DO push, below). A lock-screen ping for a small silent trim
    // is notification noise, so we no longer push here. Visibility stays passive
    // and discoverable: the durable inbox row below + the Me-screen "what changed
    // this week" audit surface. Manual adjustments are the user's own change —
    // no inbox row either.
    if (!isManual) {
      const url = '/dashboard?screen=plan'
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
  // RESHAPE-FIX-WAVE3: use the magnitude-derived value, not the builder's
  // pre-Wave-3 ad-hoc flag (kept on the proposal type for backward
  // compatibility but no longer authoritative).
  return NextResponse.json({ adjustment: inserted, requires_confirmation: requiresConfirmation })
}
