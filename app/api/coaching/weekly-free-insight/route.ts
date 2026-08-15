import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { getUserFromRequest } from '@/lib/supabase/getUserFromRequest'
import { getUserTier } from '@/lib/trial'
import { buildFreeInsightPrompt } from '@/lib/coaching/prompts/freeInsight'
import { assessReframeRiskGate, type CoachingFlag, type FatigueTag } from '@/lib/coaching/reframeRiskGate'
import { ANTHROPIC_MODEL } from '@/lib/ai/models'
import { coachingSessionType } from '@/lib/plan/sessionRole'
import { getUserDisplayPrefs } from '@/lib/userPrefs'

// GET /api/coaching/weekly-free-insight
//
// KIT-TASTE-01 — one free Haiku-backed insight per ISO-Monday week for free
// users, sourced from manual RPE + fatigue logs (Strava-independent). The
// Coach tab calls this on mount; the surface is pull-on-view (no cron).
//
// Free-tier-only by design. Paid/trial users have the full weekly report on
// the Coach tab; this route returns 400 for them. The Coach tab on those
// tiers does not call the route.
//
// Response shapes:
//   { state: 'insight',    headline, body }              — model output (cached or fresh)
//   { state: 'risk_gated', message }                     — reframe-risk gate silenced AI; rule-engine line
//   { state: 'insufficient', loggedCount }               — < 2 RPE logs in last 7 days
//   { state: 'unavailable' }                             — model failed; show empty/locked card
//
// The route never throws to the client — every failure mode collapses to one
// of the four states above so the Coach tab can render a deterministic UI.

const SESSION_WINDOW_DAYS    = 7
const MIN_LOGS_TO_QUALIFY    = 2
const MS_PER_DAY             = 24 * 60 * 60 * 1000

type RouteState =
  | { state: 'insight';      headline: string; body: string; cached: boolean }
  | { state: 'risk_gated';   message: string }
  | { state: 'insufficient'; loggedCount: number }
  | { state: 'unavailable' }

// Monday-anchored ISO week start, in the user's local timezone, formatted YYYY-MM-DD.
// We accept the tz from user_settings rather than the request — the Coach tab
// is server-rendered far enough back from midnight that this rarely matters,
// but the cache key needs to be deterministic across re-renders.
function isoWeekStart(now: Date, tz: string): string {
  // Compute the date parts in the user's tz first so we don't accidentally
  // cross a midnight boundary back into the previous local day.
  let local: { y: number; m: number; d: number; dow: number }
  try {
    const fmt = new Intl.DateTimeFormat('en-GB', {
      timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', weekday: 'short',
    })
    const parts = fmt.formatToParts(now).reduce<Record<string, string>>((acc, p) => {
      if (p.type !== 'literal') acc[p.type] = p.value
      return acc
    }, {})
    const dowMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }
    local = {
      y:   parseInt(parts.year ?? '', 10),
      m:   parseInt(parts.month ?? '', 10),
      d:   parseInt(parts.day ?? '', 10),
      dow: dowMap[parts.weekday ?? 'Mon'] ?? 1,
    }
  } catch {
    // Bad tz string — fall back to UTC.
    const u = now
    local = { y: u.getUTCFullYear(), m: u.getUTCMonth() + 1, d: u.getUTCDate(), dow: u.getUTCDay() }
  }
  const daysSinceMonday = (local.dow + 6) % 7  // Mon=0, Sun=6
  const anchor = new Date(Date.UTC(local.y, local.m - 1, local.d))
  anchor.setUTCDate(anchor.getUTCDate() - daysSinceMonday)
  return anchor.toISOString().slice(0, 10)
}

export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const tier = await getUserTier(user.id)
  if (tier !== 'free') {
    return NextResponse.json({ error: 'Free tier only' }, { status: 400 })
  }

  const service = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  const { data: settings } = await service
    .from('user_settings')
    .select('first_name, timezone')
    .eq('id', user.id)
    .maybeSingle()

  const tz        = settings?.timezone || 'UTC'
  const firstName = settings?.first_name ?? null
  const now       = new Date()
  const weekStart = isoWeekStart(now, tz)

  // 1. Cache hit — return immediately. Re-renders never re-bill Haiku.
  const { data: cached } = await service
    .from('free_insights')
    .select('headline, body')
    .eq('user_id', user.id)
    .eq('week_start_date', weekStart)
    .maybeSingle()
  if (cached?.headline && cached?.body) {
    return NextResponse.json<RouteState>({
      state: 'insight', headline: cached.headline, body: cached.body, cached: true,
    })
  }

  // 2. Pull last 7 days of completions for eligibility + prompt context. The
  // plan join is intentional — we want planned session type + planned km,
  // not just whatever the runner typed in. Joining client-side here is
  // simpler than a SQL view for v1.
  const windowStart = new Date(now.getTime() - SESSION_WINDOW_DAYS * MS_PER_DAY)
  const [completionsRes, planRes] = await Promise.all([
    service.from('session_completions')
      .select('week_n, session_day, status, rpe, fatigue_tag, coaching_flag, updated_at')
      .eq('user_id', user.id)
      .gte('updated_at', windowStart.toISOString())
      .order('updated_at', { ascending: false })
      .limit(20),
    service.from('plans').select('plan_json').eq('user_id', user.id).maybeSingle(),
  ])

  const completions = completionsRes.data ?? []

  // Manual completion logs that carry RPE — the trigger for the "2+" gate.
  const withRpe = completions.filter(c => c.status === 'complete' && c.rpe != null)
  if (withRpe.length < MIN_LOGS_TO_QUALIFY) {
    return NextResponse.json<RouteState>({ state: 'insufficient', loggedCount: withRpe.length })
  }

  // 3. Risk gate — re-uses the post-run reframe gate inputs. Without HR data
  // (no Strava on free tier), the drift fields are always null; the gate
  // still fires on flag accumulation and fatigue accumulation. If silenced,
  // render the rule-engine warning instead of an AI card.
  const recentFlags: CoachingFlag[] = completions
    .map(c => c.coaching_flag as CoachingFlag | null)
    .filter((f): f is CoachingFlag => f === 'ok' || f === 'watch' || f === 'flag')
  const recentFatigueTags: FatigueTag[] = completions
    .map(c => c.fatigue_tag as FatigueTag | null)
    .filter((t): t is FatigueTag => t === 'Fresh' || t === 'Fine' || t === 'Heavy' || t === 'Wrecked')
  const riskOutcome = assessReframeRiskGate({
    currentSessionFlag:    recentFlags[0] ?? null,
    recentCompletionFlags: recentFlags,
    recentFatigueTags,
    hrDriftBpm: null,
    hrDriftPct: null,
  })
  if (riskOutcome.silenced && riskOutcome.message) {
    return NextResponse.json<RouteState>({ state: 'risk_gated', message: riskOutcome.message })
  }

  // 4. Look up the planned session type + distance for each completion via
  // the plan JSON. Best-effort — when the plan can't resolve a slot, we
  // still pass the completion through with sessionType='unknown' so the
  // model still sees the RPE/fatigue signal.
  const plan = (planRes.data?.plan_json ?? null) as { weeks?: any[] } | null
  const promptCompletions = withRpe.slice(0, 6).map(c => {
    const week    = plan?.weeks?.find((w: any) => w.n === c.week_n)
    const slot    = (week?.sessions as Record<string, any> | undefined)?.[c.session_day] ?? null
    const updated = new Date(c.updated_at as string)
    const daysAgo = Math.max(0, Math.round((now.getTime() - updated.getTime()) / MS_PER_DAY))
    return {
      sessionType:       slot ? coachingSessionType(slot) : 'unknown',
      daysAgo,
      plannedDistanceKm: typeof slot?.distance_km === 'number' ? slot.distance_km : null,
      rpe:               (c.rpe as number | null) ?? null,
      fatigueTag:        (c.fatigue_tag as string | null) ?? null,
    }
  })

  // Planned-session count in the window — used to communicate completion ratio
  // to the model. Falls back to logged count when we can't resolve the plan.
  const plannedCount = (() => {
    if (!plan?.weeks?.length) return withRpe.length
    // Count distinct (week_n, session_day) slots in completions — close enough
    // for the model's prompt; saves walking the plan for date math.
    const seen = new Set<string>()
    for (const c of completions) seen.add(`${c.week_n}/${c.session_day}`)
    return Math.max(seen.size, withRpe.length)
  })()

  // 5. Haiku call. Failure → 'unavailable' (no cache write — next pageview retries).
  try {
    // FMT-01 — render distances/paces in the reader's unit (INV-PREF-001).
    const { units: displayUnits } = await getUserDisplayPrefs(service, user.id)
    const prompt = buildFreeInsightPrompt({
    units: displayUnits,
      weekLabel:    weekStart,
      loggedCount:  withRpe.length,
      plannedCount,
      completions:  promptCompletions,
      firstName,
    })

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

    if (!aiRes.ok) return NextResponse.json<RouteState>({ state: 'unavailable' })

    const aiData = await aiRes.json()
    const raw    = (aiData.content?.[0]?.text ?? '').trim()

    // Strip code fences if the model added them despite the instruction.
    const stripped = raw.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim()
    let parsed: { headline?: unknown; body?: unknown } | null = null
    try { parsed = JSON.parse(stripped) } catch { parsed = null }

    const headline = typeof parsed?.headline === 'string' ? parsed.headline.trim() : ''
    const body     = typeof parsed?.body     === 'string' ? parsed.body.trim()     : ''
    if (!headline || !body) return NextResponse.json<RouteState>({ state: 'unavailable' })

    // Cheerleader-word backstop — silent fallback if it slipped through.
    if (/\b(amazing|crushing|smash|beast mode|you've got this|crushed)\b/i.test(`${headline} ${body}`)) {
      return NextResponse.json<RouteState>({ state: 'unavailable' })
    }

    await service.from('free_insights').upsert({
      user_id:         user.id,
      week_start_date: weekStart,
      headline,
      body,
      ai_model:        ANTHROPIC_MODEL,
      created_at:      new Date().toISOString(),
    }, { onConflict: 'user_id,week_start_date' })

    return NextResponse.json<RouteState>({ state: 'insight', headline, body, cached: false })
  } catch {
    return NextResponse.json<RouteState>({ state: 'unavailable' })
  }
}
