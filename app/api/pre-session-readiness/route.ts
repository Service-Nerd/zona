import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/supabase/getUserFromRequest'
import { getUserTier } from '@/lib/trial'
import { isFeatureAllowed } from '@/lib/plan/canUseFeature'
import { getSessionForDate, parseLocalDate, readPlanJson } from '@/lib/plan'
import { orderedWeekSessions } from '@/lib/plan/weekSessions'
import { recordOpsEvent } from '@/lib/ops/recordOpsEvent'
import { computeReadiness, type DailyHealthSample, type SleepStageMinutes } from '@/lib/coaching/readinessBaseline'
import { checkAdjustmentTriggers, type AdjustmentCheckInput } from '@/lib/coaching/planAdjustment'
import { coachingSessionType } from '@/lib/plan/sessionRole'
import { READINESS, COACHING_RULE_ENGINE_VERSION } from '@/lib/coaching/constants'
import type { Plan } from '@/types/plan'
import { createUserScopedClient } from '@/lib/supabase/userScopedClient'

// GET /api/pre-session-readiness
//
// Called by TodayScreen on mount. Returns a ProposedAdjustment if today's
// quality/long session should be softened based on RHR / HRV / sleep
// deviations from the user's 14-day baseline. Returns null otherwise.
//
// Auth: bearer token (paid/trial). Tier-gated on `activity_intelligence`.
// Free users receive null silently — the readiness signal is paid value.
//
// CoachingPrinciples §59. The only adjustment trigger that fires *before*
// the run, not after.

// SEC-08 — user-scoped (JWT) client, created PER REQUEST.
//
// This was a module-scoped memoised service-role client (`_supabase ??= ...`).
// Memoising is harmless for the service role, which has no identity, and is a
// security hazard for a per-user JWT client: the first caller's token would be
// captured in module scope and reused for every subsequent request on that warm
// instance, serving one runner another runner's data. So the memo is gone, not
// merely repointed — this is the restructure the backlog flagged, not a swap.
//
// plans / health_daily_samples / plan_adjustments are all policy-covered for the
// operations below (rlsCoverage.test.ts enforces it on every build).

export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const tier = await getUserTier(user.id)
  if (!isFeatureAllowed('activity_intelligence', tier)) {
    return NextResponse.json({ adjustment: null, reason: 'tier' })
  }

  const userId = user.id
  const supabase = createUserScopedClient(req)
  if (!supabase) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Resolve today's planned session
  const { plan: planRowPlan, error: planRowError } = await readPlanJson(supabase, userId)
  // PLANS-SINGLE-NOT-MAYBE-01 — this read is optional here, so a failure carries on as it did; it is now logged.
  if (planRowError) console.error('[pre-session-readiness] plan read failed:', planRowError)

  const plan = planRowPlan as Plan | null
  if (!plan?.weeks?.length) {
    return NextResponse.json({ adjustment: null, reason: 'no_plan' })
  }

  // Date-aware resolution (ADR-016): the real session for today, or null before
  // the plan starts / after it ends / on an empty day. Guards against the
  // saturating getCurrentWeekIndex, which would otherwise resolve week 1's
  // weekday session for a plan that hasn't begun and propose a pre-run softening
  // for a session that isn't live yet (INV-TIME-001).
  // READINESS-WRONG-DAY-01 — the RUNNER'S calendar date, not the server's. The client sends
  // its local date (as it does for the daily coach note); samples are keyed by local date,
  // and on Vercel `new Date()` is UTC, so a runner east or west of it was read a day off.
  const qDate = req.nextUrl.searchParams.get('date')
  const todayDateStr = qDate && /^\d{4}-\d{2}-\d{2}$/.test(qDate) ? qDate : new Date().toISOString().slice(0, 10)
  const resolved = getSessionForDate(plan.weeks, parseLocalDate(todayDateStr))
  if (!resolved) return NextResponse.json({ adjustment: null, reason: 'no_active_session' })

  const week         = resolved.week
  const todayDay     = resolved.dayKey
  // The key the session is STORED under in `week.sessions` (a moved session lives on its
  // original key). The edit and the write-back address this one.
  const todayKey     = resolved.originalDay
  const todaySession = resolved.session

  // Classify via the canonical owner — a long run is `type: 'easy'`, so
  // `todaySession.type` alone would fail this gate and readiness would never
  // fire for long-run days (sessionRole.ts).
  if (!isQualityOrLong(coachingSessionType(todaySession))) {
    return NextResponse.json({ adjustment: null, reason: 'session_type_not_eligible' })
  }

  // Pull the last (BASELINE_WINDOW_DAYS + 1) days of samples — window for
  // baseline plus today's row.
  const windowDays = READINESS.BASELINE_WINDOW_DAYS + 1
  const since = new Date()
  since.setDate(since.getDate() - windowDays)

  const { data: samples } = await supabase
    .from('health_daily_samples')
    .select('sample_date, rhr_bpm, hrv_ms, sleep_hours, sleep_stages')
    .eq('user_id', userId)
    .gte('sample_date', since.toISOString().slice(0, 10))
    .order('sample_date', { ascending: false })

  // `sleep_stages: null` was MISSING from this fallback. It went unnoticed
  // because the client used to be typed `any` (a module-scoped
  // `getSupabase(): any`), so nothing checked the shape; on a day with no
  // sample, `todaySample.sleep_stages` was `undefined` rather than null. Removing
  // the `any` when this route moved to the user-scoped client surfaced it.
  const todaySample = (samples ?? []).find((s: any) => s.sample_date === todayDateStr) ?? {
    rhr_bpm: null, hrv_ms: null, sleep_hours: null, sleep_stages: null,
  }
  const baselineWindow: DailyHealthSample[] = (samples ?? [])
    .filter((s: any) => s.sample_date !== todayDateStr)
    .map((s: any) => ({
      sampleDate: s.sample_date,
      rhrBpm:     s.rhr_bpm,
      hrvMs:      s.hrv_ms,
      sleepHours: s.sleep_hours,
    }))

  const readiness = computeReadiness(baselineWindow, {
    rhrBpm:      todaySample.rhr_bpm,
    hrvMs:       todaySample.hrv_ms,
    sleepHours:  todaySample.sleep_hours,
    sleepStages: toSleepStages(todaySample.sleep_stages),
  })

  if (!readiness.hasBaseline) {
    return NextResponse.json({ adjustment: null, reason: 'baseline_dormant', detail: readiness.detail })
  }
  if (!readiness.softeningWarranted) {
    return NextResponse.json({ adjustment: null, reason: 'all_clear', detail: readiness.detail })
  }

  // Run today's session through the engine with only the readiness signal.
  const input: AdjustmentCheckInput = {
    currentWeekN:        week.n,
    totalWeeks:          plan.weeks.length,
    // The engine's contract is the whole week, Mon → Sun (RESHAPE-FIX-WAVE1's guard). A
    // one-session list THREW here for every softening since 2026-06-26.
    currentWeekSessions: orderedWeekSessions(week),
    // LOG-OFFPLAN-01 — this route never exercises the load triggers (both zero,
    // `priorWeeksKm` empty); it is here for the readiness path only. Split into
    // the two named figures so it cannot silently acquire the old meaning.
    linkedKm:            0,
    offPlanKm:           0,
    plannedKm:           todaySession.distance_km ?? 0,
    priorWeeksKm:        [],
    hrInZoneData:        [],
    efTrendPct:          null,
    adjustmentsThisWeek: 0,
    currentPhase:        (week as any).phase,
    readinessSignal: {
      sessionType:        coachingSessionType(todaySession),
      sessionDay:         todayKey,
      isElevatedRHR:      readiness.isElevatedRHR,
      isLowHRV:           readiness.isLowHRV,
      isShortSleep:       readiness.isShortSleep,
      isPoorSleepQuality: readiness.isPoorSleepQuality,
      softeningWarranted: readiness.softeningWarranted,
      hasBaseline:        readiness.hasBaseline,
    },
  }

  let adjustment: ReturnType<typeof checkAdjustmentTriggers>
  try {
    adjustment = checkAdjustmentTriggers(input)
  } catch (e) {
    // The client swallows this route's failures (it is a boot-time enrichment), so a crash
    // here was invisible for four months. It now leaves a trace.
    await recordOpsEvent('readiness_failed', { message: String((e as Error)?.message ?? e).split('\n')[0].slice(0, 200) }, userId)
    return NextResponse.json({ adjustment: null, reason: 'engine_error' }, { status: 500 })
  }
  if (!adjustment) {
    return NextResponse.json({ adjustment: null, reason: 'no_trigger', detail: readiness.detail })
  }

  // Idempotent persist: if a pending readiness adjustment already exists for
  // today's session, return it — don't write a duplicate.
  // READINESS-WRONG-DAY-01 — a readiness ease is for ONE day. A pending one from an earlier
  // day never applied, so it is closed as `reverted` (the plan is exactly as it was) rather
  // than left to surface on Today as a stale card.
  const { data: pendingReadiness } = await supabase
    .from('plan_adjustments').select('id, trigger_detail')
    .eq('user_id', userId).is('superseded_at', null)
    .eq('status', 'pending').eq('trigger_type', 'readiness_signal')
  const stale = (pendingReadiness ?? []).filter((r: { trigger_detail?: { sessionDate?: string } }) => r.trigger_detail?.sessionDate !== todayDateStr).map((r: { id: string }) => r.id)
  if (stale.length) await supabase.from('plan_adjustments').update({ status: 'reverted' }).in('id', stale)

  const { data: existing } = await supabase
    .from('plan_adjustments')
    .select('*')
    .eq('user_id', userId)
    .is('superseded_at', null)   // PLAN-WEEK-COLLISION-01: live plan only
    .eq('status', 'pending')
    .eq('week_n', week.n)
    .eq('trigger_type', 'readiness_signal')
    .contains('trigger_detail', { sessionDay: todayKey, sessionDate: todayDateStr })
    .maybeSingle()

  if (existing) {
    return NextResponse.json({ adjustment: existing, detail: readiness.detail })
  }

  const { data: inserted, error: insertErr } = await supabase
    .from('plan_adjustments')
    .insert({
      user_id:             userId,
      week_n:              week.n,
      trigger_type:        adjustment.trigger.type,
      trigger_detail:      { ...adjustment.trigger.detail, sessionDate: todayDateStr, displayDay: todayDay },
      adjustment_type:     adjustment.adjustmentType,
      summary:             adjustment.summary,
      sessions_before:     adjustment.sessionsBefore,
      sessions_after:      adjustment.sessionsAfter,
      status:              'pending',
      rule_engine_version: COACHING_RULE_ENGINE_VERSION,
    })
    .select()
    .single()

  if (insertErr) {
    console.error('[pre-session-readiness] insert failed', insertErr.message)
    return NextResponse.json({ adjustment, detail: readiness.detail, persisted: false })
  }

  return NextResponse.json({ adjustment: inserted, detail: readiness.detail, persisted: true })
}

function isQualityOrLong(t: string | undefined): boolean {
  return t === 'quality' || t === 'long' || t === 'intervals' || t === 'tempo'
}

/** Coerce the sleep_stages JSONB into a typed shape, or null if absent/malformed. */
function toSleepStages(raw: unknown): SleepStageMinutes | null {
  if (!raw || typeof raw !== 'object') return null
  const s = raw as Record<string, unknown>
  const num = (v: unknown): number => (typeof v === 'number' && isFinite(v) ? v : 0)
  return { deep: num(s.deep), rem: num(s.rem), light: num(s.light), awake: num(s.awake) }
}
