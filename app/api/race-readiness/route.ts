import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { getUserFromRequest } from '@/lib/supabase/getUserFromRequest'
import { getUserTier } from '@/lib/trial'
import { isFeatureAllowed } from '@/lib/plan/canUseFeature'
import { buildRaceReadinessPrompt } from '@/lib/coaching/prompts/raceReadiness'
import { ANTHROPIC_MODEL } from '@/lib/ai/models'
import type { Plan } from '@/types/plan'

// POST /api/race-readiness
// Generates and caches a pre-race readiness assessment for the user.
// Called by CoachScreen when daysToRace ∈ [0, 14].
// Idempotent: subsequent calls for the same (user_id, race_date) return the
// cached row rather than re-generating.
//
// Auth: bearer token. PAID/TRIAL — activity_intelligence gate.
// Body: {} (empty — all data derived from plan + Supabase)

export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const tier = await getUserTier(user.id)
  if (!isFeatureAllowed('activity_intelligence', tier)) {
    return NextResponse.json({ error: 'Subscription required' }, { status: 403 })
  }

  const serviceSupabase = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  // ── Fetch plan first — race_date drives idempotency ─────────────────────
  const planRes = await serviceSupabase
    .from('plans')
    .select('plan_json')
    .eq('user_id', user.id)
    .single()

  const plan = planRes.data?.plan_json as Plan | null
  if (!plan) return NextResponse.json({ error: 'Plan not found' }, { status: 404 })

  const { race_date, race_name, race_distance_km } = plan.meta
  if (!race_date) {
    return NextResponse.json({ error: 'Plan has no race_date' }, { status: 422 })
  }

  // Compute daysToRace from today.
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const raceDay = new Date(race_date)
  raceDay.setHours(0, 0, 0, 0)
  const daysToRace = Math.round((raceDay.getTime() - today.getTime()) / 86_400_000)

  // Safety guard — only generate within the race window.
  if (daysToRace < 0 || daysToRace > 14) {
    return NextResponse.json(
      { error: 'Race readiness note only generated within 14 days of race' },
      { status: 422 },
    )
  }

  // Idempotency check — return cached row if already generated for this race date.
  const { data: existing } = await serviceSupabase
    .from('race_readiness_notes')
    .select('content, generated_at')
    .eq('user_id', user.id)
    .eq('race_date', race_date)
    .maybeSingle()

  if (existing) {
    return NextResponse.json({ content: existing.content, cached: true })
  }

  // ── Fetch supporting data in parallel ──────────────────────────────────
  const [settingsRes, analysisRes, completionsRes] = await Promise.all([
    serviceSupabase
      .from('user_settings')
      .select('first_name')
      .eq('id', user.id)
      .single(),
    serviceSupabase
      .from('run_analysis')
      .select('week_n, hr_in_zone_pct, ef_trend_pct, actual_load_km, source')
      .eq('user_id', user.id)
      .neq('source', 'manual'),
    serviceSupabase
      .from('session_completions')
      .select('week_n, status, session_type, rpe')
      .eq('user_id', user.id),
  ])

  const firstName = settingsRes.data?.first_name ?? null
  const analyses  = analysisRes.data ?? []
  const completions = completionsRes.data ?? []

  // ── Derive current phase from plan ─────────────────────────────────────
  // Find the week whose date range contains today, then read its phase.
  const todayIso = today.toISOString().slice(0, 10)
  let currentPhase: string | null = null
  for (let i = 0; i < plan.weeks.length; i++) {
    const w = plan.weeks[i]
    const weekStart = w.date // ISO date string e.g. "2026-04-06"
    const nextWeekStart = plan.weeks[i + 1]?.date ?? race_date
    if (todayIso >= weekStart && todayIso < nextWeekStart) {
      currentPhase = (w as any).phase ?? null
      break
    }
  }
  // Fall back to last week's phase if we're past the final week.
  if (!currentPhase && plan.weeks.length > 0) {
    currentPhase = (plan.weeks[plan.weeks.length - 1] as any).phase ?? null
  }

  // ── Plan-wide aggregates ────────────────────────────────────────────────

  // Total planned sessions (non-rest) across the whole plan.
  const totalPlannedSessions = plan.weeks.reduce((sum: number, w: any) => {
    const sessions = Object.values((w as any).sessions ?? {}) as any[]
    return sum + sessions.filter((s: any) => s?.type && s.type !== 'rest').length
  }, 0)

  // Completed sessions across the whole plan.
  const completedSessions = completions.filter((c: any) => c.status === 'complete').length

  // Zone discipline: avg hr_in_zone_pct from all Strava/AH analyses.
  const zonePcts = analyses
    .map((a: any) => a.hr_in_zone_pct)
    .filter((v: any) => v !== null) as number[]
  const avgZoneDisciplinePct = zonePcts.length > 0
    ? zonePcts.reduce((s, v) => s + v, 0) / zonePcts.length
    : null

  // EF trend: avg of first-2-weeks EF vs avg of last-2-weeks EF.
  // Sort analyses by week_n to identify earliest and most recent.
  const sortedAnalyses = [...analyses]
    .filter((a: any) => a.ef_trend_pct !== null)
    .sort((a: any, b: any) => a.week_n - b.week_n)

  let efTrendPct: number | null = null
  if (sortedAnalyses.length >= 2) {
    const earlySlice = sortedAnalyses.slice(0, 2)
    const lateSlice  = sortedAnalyses.slice(-2)
    const earlyAvg   = earlySlice.reduce((s: number, a: any) => s + a.ef_trend_pct, 0) / earlySlice.length
    const lateAvg    = lateSlice.reduce((s: number, a: any) => s + a.ef_trend_pct, 0) / lateSlice.length
    efTrendPct = lateAvg - earlyAvg
  } else if (sortedAnalyses.length === 1) {
    efTrendPct = sortedAnalyses[0].ef_trend_pct
  }

  // Total km logged across entire plan.
  const totalLoadKm = analyses.reduce((s: number, a: any) => s + (a.actual_load_km ?? 0), 0) || null

  // Recent easy RPE: avg RPE on easy/recovery sessions in the last 3 plan weeks.
  // "Last 3 weeks" = the 3 highest week_n values with completions.
  const allWeekNums = Array.from(new Set(completions.map((c: any) => c.week_n))).sort((a: number, b: number) => b - a)
  const recentWeekNums = new Set(allWeekNums.slice(0, 3))
  const recentEasyRpeSamples = completions
    .filter((c: any) =>
      recentWeekNums.has(c.week_n) &&
      (c.session_type === 'easy' || c.session_type === 'recovery') &&
      c.rpe !== null,
    )
    .map((c: any) => c.rpe as number)

  const recentEasyRpe = recentEasyRpeSamples.length > 0
    ? recentEasyRpeSamples.reduce((s, v) => s + v, 0) / recentEasyRpeSamples.length
    : null

  // ── Build prompt + call AI ──────────────────────────────────────────────
  const prompt = buildRaceReadinessPrompt({
    raceName:              race_name ?? 'your race',
    raceDistanceKm:        race_distance_km ?? null,
    daysToRace,
    totalPlannedSessions,
    completedSessions,
    avgZoneDisciplinePct,
    efTrendPct,
    totalLoadKm,
    recentEasyRpe,
    currentPhase,
    firstName,
  })

  let content: string | null = null
  try {
    const aiRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type':      'application/json',
        'x-api-key':         process.env.ANTHROPIC_API_KEY!,
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
      content = aiData.content?.[0]?.text?.trim() ?? null
    }
  } catch {
    // silent — no row written, client will not retry until next Coach screen open
  }

  if (!content) {
    return NextResponse.json({ error: 'AI generation failed' }, { status: 503 })
  }

  // ── Store ───────────────────────────────────────────────────────────────
  const { error: insertErr } = await serviceSupabase
    .from('race_readiness_notes')
    .insert({
      user_id:      user.id,
      race_date,
      content,
      days_to_race: daysToRace,
      ai_model:     ANTHROPIC_MODEL,
    })

  if (insertErr) {
    console.error('[race-readiness] insert failed', insertErr.message)
    // Still return content — client can display even if persist failed.
  }

  return NextResponse.json({ content, cached: false })
}
