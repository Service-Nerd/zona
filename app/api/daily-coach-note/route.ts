import { getUserFromRequest } from '@/lib/supabase/getUserFromRequest'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { getUserTier } from '@/lib/trial'
import { isFeatureAllowed } from '@/lib/plan/canUseFeature'
import { buildDailyCoachNotePrompt } from '@/lib/coaching/prompts/dailyCoachNote'
import { zoneForSessionType } from '@/lib/coaching/zoneRules'
import { getCurrentWeekIndex } from '@/lib/plan'
import type { Plan } from '@/types/plan'

// GET /api/daily-coach-note?date=YYYY-MM-DD
// Auth-gated (paid/trial). Returns the cached daily note if it exists; else
// generates a new one and caches it. One row per user per local date.
//
// Free users get 403. Tier-divergent UI on the client doesn't even fetch.
//
// Query params:
//   date     — user's local date (YYYY-MM-DD). Defaults to UTC date if missing.
//   force    — true to regenerate today's note even if cached.

const DOW_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const
const DOW_OFFSET: Record<string, number> = { sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6 }
// Strength sessions are excluded from coaching logic until the feature is built out.
const EXCLUDED_SESSION_TYPES = ['strength']

export async function GET(req: NextRequest) {
  const supabase = createClient()
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const tier = await getUserTier(user.id)
  if (!isFeatureAllowed('activity_intelligence', tier)) {
    return NextResponse.json({ error: 'Subscription required' }, { status: 403 })
  }

  const userId = user.id
  const dateParam = req.nextUrl.searchParams.get('date')
  const noteDate = dateParam ?? new Date().toISOString().slice(0, 10)
  const force    = req.nextUrl.searchParams.get('force') === 'true'

  const serviceSupabase = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // Cache hit?
  if (!force) {
    const { data: existing } = await serviceSupabase
      .from('daily_coach_notes')
      .select('content, generated_at')
      .eq('user_id', userId)
      .eq('note_date', noteDate)
      .maybeSingle()
    if (existing?.content) {
      return NextResponse.json({ note: existing.content, cached: true })
    }
  }

  // Build context: plan + last completions + run_analysis + first_name
  const [planRes, settingsRes, completionsRes, analysisRes] = await Promise.all([
    serviceSupabase.from('plans').select('plan_json').eq('user_id', userId).single(),
    serviceSupabase.from('user_settings').select('first_name, resting_hr, max_hr').eq('id', userId).single(),
    serviceSupabase
      .from('session_completions')
      .select('week_n, session_day, status, rpe, fatigue_tag, avg_hr, updated_at')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false, nullsFirst: false })
      .limit(8),
    serviceSupabase
      .from('run_analysis')
      .select('week_n, session_day, verdict, hr_above_ceiling_pct, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(5),
  ])

  const plan = planRes.data?.plan_json as Plan | null
  if (!plan || plan.weeks.length === 0) {
    return NextResponse.json({ error: 'No plan found' }, { status: 404 })
  }

  const weekIndex = getCurrentWeekIndex(plan.weeks)
  const weekN     = weekIndex + 1
  const week      = plan.weeks[weekIndex]
  if (!week) return NextResponse.json({ error: 'No current week in plan' }, { status: 404 })

  // Today's session (by day-of-week from the local date param)
  const dayOfWeek = new Date(noteDate + 'T00:00:00Z').getUTCDay()  // 0=Sun..6=Sat
  const dowKey    = DOW_KEYS[dayOfWeek]
  // Treat strength as a rest day for coaching purposes — feature not yet built out.
  const rawTodaySession = (week.sessions as any)?.[dowKey] ?? null
  const todaySession = EXCLUDED_SESSION_TYPES.includes(rawTodaySession?.type) ? null : rawTodaySession
  const todayDayName = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][dayOfWeek]
  const todayZone = zoneForSessionType(todaySession?.type)

  const completions = completionsRes.data ?? []

  // Last completed non-strength session — find, then look up type from plan to confirm
  const lastCompleted = completions.find((c: any) => {
    if (c.status !== 'complete') return false
    const lcWeekCheck = plan.weeks[c.week_n - 1] as any
    const lcSessionCheck = lcWeekCheck?.sessions?.[c.session_day]
    return !EXCLUDED_SESSION_TYPES.includes(lcSessionCheck?.type)
  })

  let lastSession: any = null
  if (lastCompleted) {
    // daysAgo from the session's actual planned date, not the log timestamp
    const noteDateMs  = new Date(noteDate + 'T00:00:00Z').getTime()
    const lcWeek      = plan.weeks[lastCompleted.week_n - 1] as any
    const lcSession   = lcWeek?.sessions?.[lastCompleted.session_day] ?? null
    const weekStart   = lcWeek?.date ? new Date(lcWeek.date + 'T00:00:00Z').getTime() : noteDateMs
    const dayOffset   = DOW_OFFSET[lastCompleted.session_day] ?? 0
    const sessionMs   = weekStart + dayOffset * 86_400_000
    const daysAgo     = Math.max(1, Math.round((noteDateMs - sessionMs) / 86_400_000))
    // Match analysis row
    const analysis = (analysisRes.data ?? []).find(
      (a: any) => a.week_n === lastCompleted.week_n && a.session_day === lastCompleted.session_day
    )
    lastSession = {
      daysAgo,
      type: lcSession?.type ?? 'run',
      verdict: analysis?.verdict ?? null,
      hrAboveCeilingPct: analysis?.hr_above_ceiling_pct ?? null,
      rpe: lastCompleted.rpe ?? null,
      fatigueTag: lastCompleted.fatigue_tag ?? null,
    }
  }

  // Fatigue trend — last 3 non-strength tags
  const recentTags = completions
    .filter((c: any) => {
      if (!c.fatigue_tag) return false
      const w = plan.weeks[c.week_n - 1] as any
      const s = w?.sessions?.[c.session_day]
      return !EXCLUDED_SESSION_TYPES.includes(s?.type)
    })
    .slice(0, 3)
    .map((c: any) => c.fatigue_tag as string)
  const heavyFatigueTrend = recentTags.length >= 3 &&
    recentTags.filter(t => ['Heavy', 'Wrecked', 'Cooked'].includes(t)).length >= 2

  // Consecutive nailed sessions (most recent forward)
  let consecutiveNailed = 0
  for (const a of (analysisRes.data ?? [])) {
    if (a.verdict === 'nailed') consecutiveNailed++
    else break
  }

  // Race + plan context
  const weeksToRace = plan.meta.race_date
    ? Math.max(0, Math.round((new Date(plan.meta.race_date).getTime() - Date.now()) / (7 * 24 * 60 * 60 * 1000)))
    : null

  const promptInput = {
    todayDayName,
    todaySessionType: todaySession?.type ?? null,
    todayZoneLabel: todayZone?.label ?? null,
    todayDistanceKm: todaySession?.distance_km ?? null,
    lastSession,
    weekPhase: (week as any).phase as string | null,
    weekN,
    totalWeeks: plan.weeks.length,
    weeksToRace,
    raceName: plan.meta.race_name ?? null,
    raceDistanceKm: plan.meta.race_distance_km ?? null,
    heavyFatigueTrend,
    consecutiveNailed,
    firstName: settingsRes.data?.first_name ?? null,
  }

  // Generate via Claude — silent fallback to null on failure
  let content: string | null = null
  try {
    const prompt = buildDailyCoachNotePrompt(promptInput)
    const aiRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type':    'application/json',
        'x-api-key':       process.env.ANTHROPIC_API_KEY!,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model:      'claude-haiku-4-5-20251001',
        max_tokens: 80,
        messages:   [{ role: 'user', content: prompt }],
      }),
    })

    if (aiRes.ok) {
      const aiData = await aiRes.json()
      const raw    = (aiData.content?.[0]?.text ?? '').trim()
      // Strip surrounding quotes if the model added them despite instructions
      content = raw.replace(/^["']|["']$/g, '').trim() || null
      // Reject cheerleader words — silent fallback
      if (content && /\b(amazing|crushing|smash|beast mode|you've got this|crushed)\b/i.test(content)) {
        content = null
      }
    }
  } catch {
    // silent fallback
  }

  if (!content) {
    return NextResponse.json({ note: null, cached: false, fallback: true })
  }

  await serviceSupabase
    .from('daily_coach_notes')
    .upsert({
      user_id:      userId,
      note_date:    noteDate,
      content,
      generated_at: new Date().toISOString(),
      ai_model:     'claude-haiku-4-5-20251001',
    }, { onConflict: 'user_id,note_date' })

  return NextResponse.json({ note: content, cached: false })
}
