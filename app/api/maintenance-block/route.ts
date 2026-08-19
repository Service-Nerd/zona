// POST /api/maintenance-block
// FREE — plan structure generation; AI voice enrichment is PAID (maintenance_coaching gate).
//
// Called by DashboardClient when isPlanComplete + result_embedded + no maintenance weeks.
// Idempotent: a second call returns the existing plan unchanged if maintenance weeks exist.
//
// Body: {} (no params required — derives everything from the plan + user settings)
// Returns: { plan: Plan, weeks_added: number } | { plan: Plan, skipped: true }

import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/supabase/getUserFromRequest'
import { enforceAiRateLimit } from '@/lib/ai/guardAiRequest'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { fetchPlanForUser, savePlanForUser } from '@/lib/plan'
import { generateMaintenanceBlock, aggregatePlanResponse, inferRunDaysPerWeek, inferActualRunCadence, type MaintenanceIntent } from '@/lib/plan/maintenance'
import { enrichMaintenanceBlock } from '@/lib/plan/enrichMaintenance'
import { GENERATION_CONFIG } from '@/lib/plan/generationConfig'
import { computeReadiness, type DailyHealthSample } from '@/lib/coaching/readinessBaseline'
import { READINESS } from '@/lib/coaching/constants'
import { getUserTier } from '@/lib/trial'
import { isFeatureAllowed } from '@/lib/plan/canUseFeature'
import type { Plan } from '@/types/plan'

export async function POST(req: NextRequest) {
  const serviceClient = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const limited = await enforceAiRateLimit(user.id, 'maintenance-block')
  if (limited) return limited

  // ── 1. Fetch plan via service client (native auth — Bearer token) ─────────────
  const { data: settings } = await serviceClient
    .from('user_settings')
    .select('gist_url, plan_json')
    .eq('id', user.id)
    .single()

  const plan = await fetchPlanForUser(user.id, serviceClient, {
    gistUrl:        settings?.gist_url,
    legacyPlanJson: settings?.plan_json as Plan | null,
  })
  if (!plan || plan.weeks.length === 0) {
    return NextResponse.json({ error: 'No plan found' }, { status: 404 })
  }

  // ── 2. Idempotency — already has maintenance weeks ────────────────────────────
  const alreadyHasMaintenance = plan.weeks.some(
    w => w.phase === 'maintenance_restoration' || w.phase === 'maintenance_base',
  )
  if (alreadyHasMaintenance) {
    return NextResponse.json({ plan, skipped: true })
  }

  // ── 3. Verify trigger conditions ──────────────────────────────────────────────
  const lastRaceWeekIdx = plan.weeks.findLastIndex(
    w => w.type === 'race' || (w as any).badge === 'race',
  )
  if (lastRaceWeekIdx < 0) {
    return NextResponse.json({ error: 'No race week found' }, { status: 400 })
  }

  const lastRaceWeek = plan.weeks[lastRaceWeekIdx]
  const raceResult   = (lastRaceWeek as any).result_embedded
  if (!raceResult) {
    return NextResponse.json({ error: 'Race result not yet logged' }, { status: 400 })
  }

  // ── 4. Person & circumstance inputs (§75 Layers 1–5) ─────────────────────────
  const mCfg = GENERATION_CONFIG.POST_RACE_MAINTENANCE_BLOCK
  const nonMaint = plan.weeks.filter(
    w => w.phase !== 'maintenance_restoration' && w.phase !== 'maintenance_base',
  )

  // Layer 1 — BASE volume (the sustainable level the athlete built from), not peak.
  // Prefer base-phase weeks; fall back to the plan's non-deload training weeks.
  const baseWeeks = nonMaint.filter(
    w => w.phase === 'base' && (w as any).type !== 'deload' && (w.weekly_km ?? 0) > 0,
  )
  const baseSource = baseWeeks.length ? baseWeeks : nonMaint.filter(w => (w.weekly_km ?? 0) > 0)
  const baseVols = baseSource.map(w => w.weekly_km ?? 0).sort((a, b) => a - b)
  const medianBase = baseVols.length ? baseVols[Math.floor(baseVols.length / 2)] : 0
  const baseWeeklyKm = Math.max(medianBase, mCfg.MIN_BASE_KM_FLOOR)

  // Layer 3 + cadence — logged sessions. Fetch once, use for both the plan-response
  // aggregate AND actual-cadence detection.
  const { data: completions } = await serviceClient
    .from('session_completions')
    .select('rpe, fatigue_tag, week_n, session_day, status')
    .eq('user_id', user.id)
  const planResponse = aggregatePlanResponse(completions ?? [])

  // §75 — match the athlete's ACTUAL run cadence: prefer what they COMPLETED
  // (frequency AND which days — so the block lands on their real rhythm, e.g.
  // tue/fri/sat/sun, not a hardcoded mon/wed/fri/sat on their strength days).
  // Falls back to plan-prescribed cadence when logs are too sparse to trust, then
  // to meta.days_available (which counts strength/cross-train days too).
  const actualCadence = inferActualRunCadence(
    nonMaint, completions ?? [], mCfg.ACTUAL_CADENCE_MIN_COMPLETED_RUNS,
  )
  const runDaysPerWeek =
    actualCadence?.daysPerWeek ?? inferRunDaysPerWeek(nonMaint) ?? plan.meta.days_available ?? 4

  // Layer 2 — injuries (persisted on plan.meta).
  const injuryHistory = (plan.meta as any).injury_history as string[] | undefined

  // Layer 4 — are RHR/HRV still off baseline right now? (health optional — silent degrade)
  let recoverySuppressed = false
  try {
    const since = new Date()
    since.setDate(since.getDate() - (READINESS.BASELINE_WINDOW_DAYS + 1))
    const { data: samples } = await serviceClient
      .from('health_daily_samples')
      .select('sample_date, rhr_bpm, hrv_ms, sleep_hours')
      .eq('user_id', user.id)
      .gte('sample_date', since.toISOString().slice(0, 10))
      .order('sample_date', { ascending: false })
    const todayStr = new Date().toISOString().slice(0, 10)
    const today = (samples ?? []).find((s: any) => s.sample_date === todayStr)
      ?? { rhr_bpm: null, hrv_ms: null, sleep_hours: null }
    const baseline: DailyHealthSample[] = (samples ?? [])
      .filter((s: any) => s.sample_date !== todayStr)
      .map((s: any) => ({ sampleDate: s.sample_date, rhrBpm: s.rhr_bpm, hrvMs: s.hrv_ms, sleepHours: s.sleep_hours }))
    const readiness = computeReadiness(baseline, {
      rhrBpm: today.rhr_bpm, hrvMs: today.hrv_ms, sleepHours: today.sleep_hours, sleepStages: null,
    })
    recoverySuppressed = readiness.hasBaseline && (readiness.isElevatedRHR || readiness.isLowHRV)
  } catch { /* health data optional — neutral when absent */ }

  // Layer 5 — intent from the post-plan review. Prefer the value persisted on the
  // race result (result_embedded.maintenance_intent); fall back to a POST-body
  // override, then the conservative 'tick_over' default.
  const body = await req.json().catch(() => ({} as any))
  const rawIntent = (raceResult as any).maintenance_intent ?? body?.intent
  const intent: MaintenanceIntent =
    (['rest', 'tick_over', 'stay_sharp'].includes(rawIntent) ? rawIntent : 'tick_over')

  // ── 5. Generate maintenance block ────────────────────────────────────────────
  let maintWeeks
  try {
    maintWeeks = generateMaintenanceBlock({
      raceResult,
      lastRaceWeek,
      baseWeeklyKm,
      raceDistanceKm: plan.meta.race_distance_km,
      daysAvailable: runDaysPerWeek,
      trainingDays: actualCadence?.dayKeys,
      injuryHistory,
      planResponse,
      recoverySuppressed,
      intent,
    })
  } catch (err) {
    console.error('[maintenance-block] generation failed:', err)
    return NextResponse.json({ error: 'Maintenance block generation failed' }, { status: 500 })
  }

  // ── 5b. AI voice enrichment (PAID — MAINT-02) ─────────────────────────────────
  // Gated by `maintenance_coaching`. Adds per-session coach_notes + a per-week
  // coach_debrief. Enricher failure is silent — returns rule-engine weeks unchanged
  // (ADR-006 hybrid pattern). Free/expired users keep the rule-engine block as-is.
  const tier = await getUserTier(user.id)
  if (isFeatureAllowed('maintenance_coaching', tier)) {
    maintWeeks = await enrichMaintenanceBlock(maintWeeks, {
      raceResult,
      raceName:       plan.meta.race_name,
      raceDistanceKm: plan.meta.race_distance_km,
    })
  }

  // ── 6. Build maintenance as its OWN plan object and hand off (§75, MAINT-06) ──
  // The finished race plan ENDS: it moves to history and the maintenance block
  // becomes the sole active plan. We DON'T append maintenance weeks to the race
  // plan. Instead we save a standalone maintenance plan — `savePlanForUser`'s
  // race-change guard (different race_name) archives the completed race plan into
  // plan_archive automatically, so we reuse that path rather than duplicating it.
  //
  // week_n stays CONTINUOUS (maintWeeks carry n = lastRaceWeek.n + 1 …): the app
  // keys session_completions/run_analysis by week.n, so continuing the sequence
  // means maintenance completions never collide with the archived race plan's —
  // no schema change, no migration.
  const maintenancePlan: Plan = {
    meta: {
      ...plan.meta,
      plan_kind:               'maintenance',
      race_name:               plan.meta.race_name ? `After ${plan.meta.race_name}` : 'Post-race maintenance',
      race_date:               '',   // no upcoming race → countdown / projections no-op
      source_race_name:        plan.meta.race_name,
      source_race_distance_km: plan.meta.race_distance_km,
      // Capture the race date BEFORE race_date is wiped to '' above. Without
      // this, nothing downstream knows when the race was, and post-race coaching
      // fabricates the elapsed time (ADR-013 / sessionFeedback maintenance block).
      source_race_date:        plan.meta.race_date || undefined,
      source_race_outcome:     (raceResult as any).outcome ?? undefined,
      source_finish_time:      (raceResult as any).finish_time ?? undefined,
      last_updated:            new Date().toISOString(),
    },
    weeks: maintWeeks,
  }

  try {
    await savePlanForUser(user.id, maintenancePlan, serviceClient)
  } catch (err) {
    console.error('[maintenance-block] save failed:', err)
    return NextResponse.json({ error: 'Failed to save plan' }, { status: 500 })
  }

  return NextResponse.json({ plan: maintenancePlan, weeks_added: maintWeeks.length })
}
