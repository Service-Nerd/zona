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
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { fetchPlanForUser, savePlanForUser } from '@/lib/plan'
import { generateMaintenanceBlock } from '@/lib/plan/maintenance'
import { enrichMaintenanceBlock } from '@/lib/plan/enrichMaintenance'
import { GENERATION_CONFIG } from '@/lib/plan/generationConfig'
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

  // ── 4. Compute plan peak weekly_km ───────────────────────────────────────────
  // Exclude maintenance weeks (idempotent guard above ensures none exist here,
  // but guard anyway for safety).
  const planWeeks = plan.weeks.filter(
    w => w.phase !== 'maintenance_restoration' && w.phase !== 'maintenance_base',
  )
  const peakWeeklyKm = Math.max(...planWeeks.map(w => w.weekly_km ?? 0))

  // ── 5. Generate maintenance block ────────────────────────────────────────────
  let maintWeeks
  try {
    maintWeeks = generateMaintenanceBlock({
      raceResult,
      lastRaceWeek,
      peakWeeklyKm: Math.max(peakWeeklyKm, GENERATION_CONFIG.POST_RACE_MAINTENANCE_BLOCK.MIN_PEAK_KM_FLOOR),
      raceDistanceKm: plan.meta.race_distance_km,
      daysAvailable: plan.meta.days_available ?? 4,
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

  // ── 6. Append to plan and save ───────────────────────────────────────────────
  const updatedPlan: Plan = {
    ...plan,
    weeks: [...plan.weeks, ...maintWeeks],
  }

  try {
    await savePlanForUser(user.id, updatedPlan, serviceClient)
  } catch (err) {
    console.error('[maintenance-block] save failed:', err)
    return NextResponse.json({ error: 'Failed to save plan' }, { status: 500 })
  }

  return NextResponse.json({ plan: updatedPlan, weeks_added: maintWeeks.length })
}
