import { getUserFromRequest } from '@/lib/supabase/getUserFromRequest'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { getUserTier } from '@/lib/trial'
import { isFeatureAllowed } from '@/lib/plan/canUseFeature'
import { buildDailyCoachNotePrompt } from '@/lib/coaching/prompts/dailyCoachNote'
import { buildAthleteContext } from '@/lib/coaching/prompts/athleteContext'
import { zoneForSessionType } from '@/lib/coaching/zoneRules'
import { getCurrentWeekIndex } from '@/lib/plan'
import { resolveEffectiveSessions, slotForOriginalDay, type SessionOverride } from '@/lib/plan/effectiveSessions'
import type { Plan } from '@/types/plan'
import { ANTHROPIC_MODEL } from '@/lib/ai/models'

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

  // Build context: plan + last completions + run_analysis + first_name + last weekly report + swap overrides
  const [planRes, settingsRes, completionsRes, analysisRes, lastWeeklyRes, overridesRes] = await Promise.all([
    serviceSupabase.from('plans').select('plan_json').eq('user_id', userId).single(),
    serviceSupabase.from('user_settings').select('first_name, resting_hr, max_hr').eq('id', userId).single(),
    serviceSupabase
      .from('session_completions')
      .select('week_n, session_day, status, rpe, fatigue_tag, avg_hr, updated_at, apple_health_uuid, strava_activity_id')
      .eq('user_id', userId)
      .order('week_n', { ascending: false })
      .order('updated_at', { ascending: false, nullsFirst: false })
      .limit(8),
    serviceSupabase
      .from('run_analysis')
      .select('week_n, session_day, verdict, hr_above_ceiling_pct, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(5),
    // AI-DEPTH-10 — connective tissue. The daily note may reference the
    // most recent weekly report's headline when today's session connects
    // to it (e.g. weekly said "easy ran hot", today is easy → "hold the
    // zone today"). Both fields required — silent-fallback weeks skip.
    serviceSupabase
      .from('weekly_reports')
      .select('headline, body, week_n')
      .eq('user_id', userId)
      .not('headline', 'is', null)
      .order('week_n', { ascending: false })
      .limit(1)
      .maybeSingle(),
    serviceSupabase.from('session_overrides')
      .select('week_n, original_day, new_day')
      .eq('user_id', userId),
  ])

  const plan = planRes.data?.plan_json as Plan | null
  if (!plan || plan.weeks.length === 0) {
    return NextResponse.json({ error: 'No plan found' }, { status: 404 })
  }

  const weekIndex = getCurrentWeekIndex(plan.weeks)
  const weekN     = weekIndex + 1
  const week      = plan.weeks[weekIndex]
  if (!week) return NextResponse.json({ error: 'No current week in plan' }, { status: 404 })

  // Today's session — slot lookup must respect swap/move overrides.
  // Without this, a session moved into today's slot reads as "nothing today".
  const allOverrides: SessionOverride[] = (overridesRes.data as SessionOverride[] | null) ?? []
  const currentWeekOverrides = allOverrides.filter(o => o.week_n === weekN)
  const effectiveWeek = resolveEffectiveSessions(week, currentWeekOverrides)
  const dayOfWeek = new Date(noteDate + 'T00:00:00Z').getUTCDay()  // 0=Sun..6=Sat
  const dowKey    = DOW_KEYS[dayOfWeek]
  // Treat strength as a rest day for coaching purposes — feature not yet built out.
  const rawTodaySession = effectiveWeek[dowKey]?.session ?? null
  const todaySession = rawTodaySession && !EXCLUDED_SESSION_TYPES.includes(rawTodaySession.type) ? rawTodaySession : null
  const todayDayName = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][dayOfWeek]
  const todayZone = zoneForSessionType(todaySession?.type)

  const completions = completionsRes.data ?? []

  // Last completed non-strength session — must also reference a session that still exists
  // in the current plan to avoid orphaned completions from old plan versions surfacing.
  const lastCompleted = completions.find((c: any) => {
    if (c.status !== 'complete') return false
    const lcWeekCheck = plan.weeks[c.week_n - 1] as any
    const lcSessionCheck = lcWeekCheck?.sessions?.[c.session_day]
    if (!lcSessionCheck) return false  // skip completions whose plan session no longer exists
    return !EXCLUDED_SESSION_TYPES.includes(lcSessionCheck.type)
  })

  let lastSession: any = null
  if (lastCompleted) {
    const noteDateMs  = new Date(noteDate + 'T00:00:00Z').getTime()
    const lcWeek      = plan.weeks[lastCompleted.week_n - 1] as any
    const lcSession   = lcWeek?.sessions?.[lastCompleted.session_day] ?? null

    // Resolve actual run date from the linked activity (Apple Health primary, Strava secondary).
    // Falls back to the planned session date only when the completion has no linked activity.
    let actualRunMs: number | null = null
    if (lastCompleted.apple_health_uuid || lastCompleted.strava_activity_id) {
      const baseQuery = serviceSupabase
        .from('strava_activities')
        .select('start_date')
        .eq('user_id', userId)
      const { data: activity } = lastCompleted.apple_health_uuid
        ? await baseQuery.eq('apple_health_uuid', lastCompleted.apple_health_uuid).maybeSingle()
        : await baseQuery.eq('strava_activity_id', lastCompleted.strava_activity_id).maybeSingle()
      if (activity?.start_date) {
        const activityDayMs = new Date((activity.start_date as string).slice(0, 10) + 'T00:00:00Z').getTime()
        actualRunMs = activityDayMs
      }
    }

    if (actualRunMs == null) {
      // Completions are keyed by original_day; if that session was swapped, the
      // planned calendar date is the new_day slot, not the original.
      const lcWeekOverrides = allOverrides.filter(o => o.week_n === lastCompleted.week_n)
      const effectiveSlot = slotForOriginalDay(lastCompleted.session_day, lcWeekOverrides)
      const weekStart = lcWeek?.date ? new Date(lcWeek.date + 'T00:00:00Z').getTime() : noteDateMs
      const dayOffset = DOW_OFFSET[effectiveSlot] ?? 0
      actualRunMs     = weekStart + dayOffset * 86_400_000
    }

    const daysAgo = Math.max(1, Math.round((noteDateMs - actualRunMs) / 86_400_000))

    // Sessions older than 14 days are not useful coaching context — skip them so a
    // stale completion (e.g. from a Strava re-sync touching an old record) can't
    // surface as "the last session" and produce confusing day-name references.
    if (daysAgo > 14) {
      // leave lastSession null
    } else {
      const lastRunDayName = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][new Date(actualRunMs).getUTCDay()]
      // Match analysis row
      const analysis = (analysisRes.data ?? []).find(
        (a: any) => a.week_n === lastCompleted.week_n && a.session_day === lastCompleted.session_day
      )
      lastSession = {
        daysAgo,
        dayName: lastRunDayName,
        type: lcSession?.type ?? 'run',
        verdict: analysis?.verdict ?? null,
        hrAboveCeilingPct: analysis?.hr_above_ceiling_pct ?? null,
        rpe: lastCompleted.rpe ?? null,
        fatigueTag: lastCompleted.fatigue_tag ?? null,
      }
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
    todaySessionType:  todaySession?.type ?? null,
    todaySessionLabel: todaySession?.label ?? null,
    todayZoneLabel:    todayZone?.label ?? null,
    todayDistanceKm:   todaySession?.distance_km ?? null,
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
    athleteContext: buildAthleteContext({ plan }),
    previousWeeklyReport: lastWeeklyRes.data?.headline && lastWeeklyRes.data?.body
      ? { headline: lastWeeklyRes.data.headline as string, body: lastWeeklyRes.data.body as string }
      : null,
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
        model:      ANTHROPIC_MODEL,
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
      ai_model:     ANTHROPIC_MODEL,
    }, { onConflict: 'user_id,note_date' })

  return NextResponse.json({ note: content, cached: false })
}
