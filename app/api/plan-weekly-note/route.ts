import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { getUserFromRequest } from '@/lib/supabase/getUserFromRequest'
import { getUserTier } from '@/lib/trial'
import { isFeatureAllowed } from '@/lib/plan/canUseFeature'
import {
  buildPlanWeeklyNotePrompt,
  parsePlanWeeklyNoteResponse,
} from '@/lib/coaching/prompts/planWeeklyNote'
import { buildAthleteContext } from '@/lib/coaching/prompts/athleteContext'
import { ANTHROPIC_MODEL } from '@/lib/ai/models'
import type { Plan } from '@/types/plan'

// POST /api/plan-weekly-note
// Generates and caches an AI-voiced week-ahead headline + 1–2 items for the
// Plan screen voice card. Cached per (user_id, week_n) — subsequent calls
// return the cached row instead of re-generating. Cache is invalidated on
// any plan save (see savePlanForUser in lib/plan.ts).
//
// Auth: bearer token. PAID/TRIAL — activity_intelligence gate.
// Body: { week_n: number } (1-indexed week number)
//
// Pattern: mirrors app/api/phase-summary/route.ts (PLAN-VOICE-AI).

// Plan sessions are keyed by lowercase 3-letter day names (mon|tue|…) per
// types/plan.ts Week.sessions. Earlier this array was capitalised, which
// never matched anything — every cached weekly note was generated against
// an empty sessions block and the AI produced "no running this week" copy.
// The 20260522 migration purges those bad rows.
const DAYS_OF_WEEK = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const
const DAY_DISPLAY: Record<typeof DAYS_OF_WEEK[number], string> = {
  mon: 'Mon', tue: 'Tue', wed: 'Wed', thu: 'Thu', fri: 'Fri', sat: 'Sat', sun: 'Sun',
}

// Self-healing cache cutoff. Rows generated before this timestamp predate
// the capitalised-keys fix and narrate empty session blocks ("nothing
// scheduled this week"). Survives migration deploy lag and any future
// prompt change that requires a forced refresh — bump this constant.
const CACHE_MIN_GENERATED_AT = '2026-05-22T00:00:00Z'

export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const tier = await getUserTier(user.id)
  if (!isFeatureAllowed('activity_intelligence', tier)) {
    return NextResponse.json({ error: 'Subscription required' }, { status: 403 })
  }

  const body = await req.json().catch(() => ({}))
  const week_n = Number((body as { week_n?: number }).week_n)
  if (!Number.isInteger(week_n) || week_n < 1) {
    return NextResponse.json({ error: 'week_n (positive integer) required' }, { status: 422 })
  }

  const serviceSupabase = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  // ── Idempotency check ───────────────────────────────────────────────────
  // Cutoff filter: ignore rows generated before the capitalised-keys fix so
  // any stale "nothing scheduled this week" copy regenerates on next view.
  const { data: existing } = await serviceSupabase
    .from('plan_weekly_notes')
    .select('headline, items')
    .eq('user_id', user.id)
    .eq('week_n', week_n)
    .gte('generated_at', CACHE_MIN_GENERATED_AT)
    .maybeSingle()

  if (existing) {
    return NextResponse.json({
      headline: existing.headline,
      items:    (existing.items as string[]) ?? [],
      cached:   true,
    })
  }

  // ── Fetch plan + settings + previous week's note ────────────────────────
  const [planRes, settingsRes, prevNoteRes] = await Promise.all([
    serviceSupabase.from('plans').select('plan_json').eq('user_id', user.id).single(),
    serviceSupabase.from('user_settings').select('first_name').eq('id', user.id).single(),
    // AI-DEPTH-10 continuity — most recent prior weekly note (typically week N-1
    // but may skip when invalidation cleared the cache).
    serviceSupabase
      .from('plan_weekly_notes')
      .select('week_n, headline, items')
      .eq('user_id', user.id)
      .lt('week_n', week_n)
      .order('week_n', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ])

  const plan = planRes.data?.plan_json as Plan | null
  if (!plan) return NextResponse.json({ error: 'Plan not found' }, { status: 404 })

  const week = plan.weeks[week_n - 1] as any
  if (!week) {
    return NextResponse.json({ error: `Week ${week_n} not found in plan` }, { status: 404 })
  }

  const firstName = settingsRes.data?.first_name ?? null

  // ── Derive prompt inputs ────────────────────────────────────────────────
  const phase: string | null = week.phase ?? null

  // Race countdown — null when no race date set.
  const raceDateStr = (plan as any)?.meta?.race_date as string | undefined
  const raceName    = (plan as any)?.meta?.race_name as string | undefined ?? null
  const raceDistance = (plan as any)?.meta?.race_distance as string | undefined ?? null
  let weeksToRace: number | null = null
  if (raceDateStr) {
    const ms = new Date(raceDateStr).getTime() - Date.now()
    weeksToRace = Math.max(0, Math.round(ms / (1000 * 60 * 60 * 24 * 7)))
  }

  // Session list — skip rest days; preserve plan-week day order (Mon–Sun).
  const sessionsBlock = DAYS_OF_WEEK.flatMap(day => {
    const sess = week.sessions?.[day] as { type?: string; distance_km?: number } | undefined
    if (!sess || !sess.type || sess.type === 'rest') return []
    return [{
      day:        DAY_DISPLAY[day],
      type:       sess.type,
      distanceKm: sess.distance_km ?? null,
    }]
  })

  // Rest-heavy classification — grounds the AI so it doesn't pattern-match
  // "no quality session" to "rest week" and tell the user their easy/long
  // week is a rest week. True only when the week is genuinely deload:
  // foundation/taper phase, deload-typed/badged week, or ≤2 sessions total.
  const weekType  = week.type as string | undefined
  const weekBadge = week.badge as string | undefined
  const isRestHeavyWeek = (
    phase === 'foundation' || phase === 'taper' ||
    weekType === 'deload' || weekBadge === 'deload' ||
    sessionsBlock.length <= 2
  )

  // ── Build prompt + call AI ──────────────────────────────────────────────
  const prompt = buildPlanWeeklyNotePrompt({
    weekN:           week_n,
    phase,
    weeksToRace,
    raceName,
    raceDistance,
    sessions:        sessionsBlock,
    firstName,
    athleteContext:  buildAthleteContext({ plan }),
    previousWeeklyNote: prevNoteRes.data
      ? {
          weekN:    prevNoteRes.data.week_n as number,
          headline: prevNoteRes.data.headline as string,
          items:    (prevNoteRes.data.items as string[]) ?? [],
        }
      : null,
    isRestHeavyWeek,
  })

  let rawContent: string | null = null
  try {
    const aiRes = await fetch('https://api.anthropic.com/v1/messages', {
      method:  'POST',
      headers: {
        'Content-Type':      'application/json',
        'x-api-key':         process.env.ANTHROPIC_API_KEY!,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model:      ANTHROPIC_MODEL,
        max_tokens: 220,
        messages:   [{ role: 'user', content: prompt }],
      }),
    })
    if (aiRes.ok) {
      const aiData = await aiRes.json()
      rawContent = aiData.content?.[0]?.text?.trim() ?? null
    }
  } catch {
    // silent — client will fall back to rule-engine voice
  }

  if (!rawContent) {
    return NextResponse.json({ error: 'AI generation failed' }, { status: 503 })
  }

  const parsed = parsePlanWeeklyNoteResponse(rawContent)
  if (!parsed) {
    return NextResponse.json({ error: 'AI response unparseable' }, { status: 503 })
  }

  // ── Store ───────────────────────────────────────────────────────────────
  // Upsert so a pre-cutoff stale row gets overwritten when we regenerate
  // (otherwise the primary-key conflict would silently leave the bad copy).
  const { error: insertErr } = await serviceSupabase
    .from('plan_weekly_notes')
    .upsert({
      user_id:      user.id,
      week_n,
      headline:     parsed.headline,
      items:        parsed.items,
      ai_model:     ANTHROPIC_MODEL,
      generated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,week_n' })

  if (insertErr) {
    console.error('[plan-weekly-note] upsert failed', insertErr.message)
    // Still return content — client renders even if persist failed.
  }

  return NextResponse.json({
    headline: parsed.headline,
    items:    parsed.items,
    cached:   false,
  })
}
