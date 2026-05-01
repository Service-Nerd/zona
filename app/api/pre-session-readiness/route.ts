import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { getUserFromRequest } from '@/lib/supabase/getUserFromRequest'
import { getUserTier } from '@/lib/trial'
import { isFeatureAllowed } from '@/lib/plan/canUseFeature'
import { getCurrentWeekIndex } from '@/lib/plan'
import { computeReadiness, type DailyHealthSample } from '@/lib/coaching/readinessBaseline'
import { checkAdjustmentTriggers, type AdjustmentCheckInput } from '@/lib/coaching/planAdjustment'
import { READINESS, COACHING_RULE_ENGINE_VERSION } from '@/lib/coaching/constants'
import type { Plan, Session } from '@/types/plan'

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

const DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const

let _supabase: ReturnType<typeof createServiceClient> | undefined
function getSupabase(): any {
  return (_supabase ??= createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  ))
}

export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const tier = await getUserTier(user.id)
  if (!isFeatureAllowed('activity_intelligence', tier)) {
    return NextResponse.json({ adjustment: null, reason: 'tier' })
  }

  const userId = user.id
  const supabase = getSupabase()

  // Resolve today's planned session
  const { data: planRow } = await supabase
    .from('plans')
    .select('plan_json')
    .eq('user_id', userId)
    .single()

  const plan = planRow?.plan_json as Plan | null
  if (!plan?.weeks?.length) {
    return NextResponse.json({ adjustment: null, reason: 'no_plan' })
  }

  const weekIndex = getCurrentWeekIndex(plan.weeks)
  const week      = plan.weeks[weekIndex]
  if (!week) return NextResponse.json({ adjustment: null, reason: 'no_week' })

  const todayIdx = (new Date().getDay() + 6) % 7  // mon=0 ... sun=6
  const todayDay = DAYS[todayIdx]
  const todaySession = week.sessions[todayDay] as Session | undefined

  if (!todaySession) return NextResponse.json({ adjustment: null, reason: 'no_session' })
  if (!isQualityOrLong(todaySession.type)) {
    return NextResponse.json({ adjustment: null, reason: 'session_type_not_eligible' })
  }

  // Pull the last (BASELINE_WINDOW_DAYS + 1) days of samples — window for
  // baseline plus today's row.
  const windowDays = READINESS.BASELINE_WINDOW_DAYS + 1
  const since = new Date()
  since.setDate(since.getDate() - windowDays)

  const { data: samples } = await supabase
    .from('health_daily_samples')
    .select('sample_date, rhr_bpm, hrv_ms, sleep_hours')
    .eq('user_id', userId)
    .gte('sample_date', since.toISOString().slice(0, 10))
    .order('sample_date', { ascending: false })

  const todayDateStr = new Date().toISOString().slice(0, 10)
  const todaySample = (samples ?? []).find((s: any) => s.sample_date === todayDateStr) ?? {
    rhr_bpm: null, hrv_ms: null, sleep_hours: null,
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
    rhrBpm:     todaySample.rhr_bpm,
    hrvMs:      todaySample.hrv_ms,
    sleepHours: todaySample.sleep_hours,
  })

  if (!readiness.hasBaseline) {
    return NextResponse.json({ adjustment: null, reason: 'baseline_dormant', detail: readiness.detail })
  }
  if (!readiness.isElevatedRHR && !readiness.isLowHRV && !readiness.isShortSleep) {
    return NextResponse.json({ adjustment: null, reason: 'all_clear', detail: readiness.detail })
  }

  // Run today's session through the engine with only the readiness signal.
  const input: AdjustmentCheckInput = {
    currentWeekN:        week.n,
    totalWeeks:          plan.weeks.length,
    currentWeekSessions: [todaySession],
    actualKm:            0,
    plannedKm:           todaySession.distance_km ?? 0,
    priorWeeksKm:        [],
    hrInZoneData:        [],
    efTrendPct:          null,
    adjustmentsThisWeek: 0,
    currentPhase:        (week as any).phase,
    readinessSignal: {
      sessionType:   todaySession.type,
      sessionDay:    todayDay,
      isElevatedRHR: readiness.isElevatedRHR,
      isLowHRV:      readiness.isLowHRV,
      isShortSleep:  readiness.isShortSleep,
      hasBaseline:   readiness.hasBaseline,
    },
  }

  const adjustment = checkAdjustmentTriggers(input)
  if (!adjustment) {
    return NextResponse.json({ adjustment: null, reason: 'no_trigger', detail: readiness.detail })
  }

  // Idempotent persist: if a pending readiness adjustment already exists for
  // today's session, return it — don't write a duplicate.
  const { data: existing } = await supabase
    .from('plan_adjustments')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'pending')
    .eq('week_n', week.n)
    .eq('trigger_type', 'readiness_signal')
    .contains('trigger_detail', { sessionDay: todayDay })
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
      trigger_detail:      adjustment.trigger.detail,
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
