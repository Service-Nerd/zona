import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendWebPush } from '@/lib/webpush'
import { sendApnsPush } from '@/lib/apnpush'
import { getUserTier } from '@/lib/trial'
import { getCurrentWeekIndex } from '@/lib/plan'
import { resolveEffectiveSessions, type SessionOverride } from '@/lib/plan/effectiveSessions'
import { buildDailyPushTitle, buildDailyPushBody } from '@/lib/coaching/voiceLines'
import { recordNotification } from '@/lib/notifications'
import type { Plan, Session } from '@/types/plan'

// POST /api/push/send-daily
// Vercel cron — runs hourly. For each push subscription, computes the user's
// local hour from their stored timezone. Sends one daily push at user-local
// 06:30 to paid/trial users with `daily_push_enabled=true` on training days.
//
// Skip conditions (acceptance criteria from HOOK-01):
//   • Free tier — no daily push.
//   • daily_push_enabled = false — user opted out.
//   • No plan / no current week — nothing to push about.
//   • Today's session is undefined or `rest` (rest days send no push; v1 also
//     suppresses cross-train + strength per spec).
//   • Already sent today (daily_push_last_sent_on stamps the local date).
//   • Today screen opened within the last 30 minutes — runner is already in
//     the app, double-prompting kills the trust.
//
// Strava-independent — the source is the plan + voice lines, no run data
// touched anywhere on this path.
//
// Protected by CRON_SECRET header — must match env var. Vercel cron sends
// this automatically via the header configured in vercel.json.

const DOW_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const

// Session types that skip the push at v1 — rest plus the two we don't yet
// coach against (cross-train and strength). When those graduate to first-class
// coaching surfaces, drop them from this set.
const SKIP_PUSH_TYPES = new Set(['rest', 'cross-train', 'strength'])

const HEARTBEAT_SUPPRESSION_MIN = 30

type LocalClock = { hour: number; minute: number; isoDate: string }

// Compute user-local hour/minute and YYYY-MM-DD from a timezone. Uses Intl
// rather than a date library — no new dependency, and the formatter handles
// DST transitions correctly on its own.
function localClockFor(tz: string, now: Date): LocalClock | null {
  try {
    const fmt = new Intl.DateTimeFormat('en-GB', {
      timeZone: tz,
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hour12: false,
    })
    const parts = fmt.formatToParts(now).reduce<Record<string, string>>((acc, p) => {
      if (p.type !== 'literal') acc[p.type] = p.value
      return acc
    }, {})
    const hour   = parseInt(parts.hour ?? '', 10)
    const minute = parseInt(parts.minute ?? '', 10)
    if (Number.isNaN(hour) || Number.isNaN(minute)) return null
    return {
      hour,
      minute,
      isoDate: `${parts.year}-${parts.month}-${parts.day}`,
    }
  } catch {
    // Invalid timezone string — caller treats as "skip".
    return null
  }
}

// Vercel cron always sends GET. We keep POST for parity with the existing
// /api/push/send-weekly-report convention and for manual invocation (curl etc).
export async function GET(req: NextRequest) { return POST(req) }

export async function POST(req: NextRequest) {
  // Vercel cron sends `Authorization: Bearer <CRON_SECRET>` automatically. We
  // also accept `x-cron-secret` for parity with /api/push/send-weekly-report
  // (which predates this route) and for external/manual invocation.
  const bearer  = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ?? null
  const custom  = req.headers.get('x-cron-secret')
  const secret  = bearer || custom
  if (!secret || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  const { data: subscriptions, error } = await supabase
    .from('push_subscriptions')
    .select('user_id, endpoint, p256dh, auth, platform')

  if (error) {
    console.error('[push/send-daily] subscription read failed', error.message)
    return NextResponse.json({ error: 'Subscription read failed' }, { status: 500 })
  }
  if (!subscriptions?.length) {
    return NextResponse.json({ sent: 0, considered: 0 })
  }

  const now      = new Date()
  const heartbeatCutoff = new Date(now.getTime() - HEARTBEAT_SUPPRESSION_MIN * 60_000)

  let sent     = 0
  let skipped  = 0
  const errors: string[] = []

  // De-dupe by user — a single user with both web + iOS subscriptions should
  // get the push on every device, but tier/plan/eligibility only computed once.
  const subsByUser = new Map<string, typeof subscriptions>()
  for (const sub of subscriptions) {
    const list = subsByUser.get(sub.user_id) ?? []
    list.push(sub)
    subsByUser.set(sub.user_id, list)
  }

  for (const [userId, userSubs] of Array.from(subsByUser.entries())) {
    try {
      const { data: settings } = await supabase
        .from('user_settings')
        .select('timezone, daily_push_enabled, daily_push_last_sent_on, last_today_open_at')
        .eq('id', userId)
        .maybeSingle()

      if (!settings || settings.daily_push_enabled === false) { skipped++; continue }

      const tz    = settings.timezone || 'UTC'
      const clock = localClockFor(tz, now)
      if (!clock) { skipped++; continue }

      // Hour-window filter. Cron runs at :30 each hour (see vercel.json), so
      // when the user's local hour is 6 we are within minutes of their 06:30.
      if (clock.hour !== 6) { skipped++; continue }

      // Daily idempotency — never fire twice for the same local date.
      if (settings.daily_push_last_sent_on === clock.isoDate) { skipped++; continue }

      // Already-engaged suppression: runner opened Today in the last 30 min.
      if (
        settings.last_today_open_at &&
        new Date(settings.last_today_open_at) > heartbeatCutoff
      ) { skipped++; continue }

      // Paid/trial only.
      const tier = await getUserTier(userId)
      if (tier === 'free') { skipped++; continue }

      const [planRes, overridesRes] = await Promise.all([
        supabase.from('plans').select('plan_json').eq('user_id', userId).single(),
        supabase.from('session_overrides')
          .select('week_n, original_day, new_day')
          .eq('user_id', userId),
      ])

      const plan = planRes.data?.plan_json as Plan | null
      if (!plan || plan.weeks.length === 0) { skipped++; continue }

      const weekIndex = getCurrentWeekIndex(plan.weeks)
      const week      = plan.weeks[weekIndex]
      if (!week) { skipped++; continue }
      const weekN = weekIndex + 1

      const allOverrides: SessionOverride[] = (overridesRes.data as SessionOverride[] | null) ?? []
      const currentWeekOverrides = allOverrides.filter(o => o.week_n === weekN)
      const effectiveWeek = resolveEffectiveSessions(week, currentWeekOverrides)

      // Local day-of-week — derived from the user's tz isoDate so DST + early
      // morning timezones don't pull the wrong day.
      const dayOfWeek = new Date(clock.isoDate + 'T00:00:00Z').getUTCDay()
      const dowKey    = DOW_KEYS[dayOfWeek]
      const session   = (effectiveWeek[dowKey]?.session ?? null) as Session | null

      if (!session || SKIP_PUSH_TYPES.has(session.type)) { skipped++; continue }

      const payload = {
        title: buildDailyPushTitle(session),
        body:  buildDailyPushBody(session.type),
        tag:   `daily-push-${clock.isoDate}`,
        data:  { url: '/dashboard?screen=today' },
      }

      let deliveredAny = false
      for (const sub of userSubs) {
        let ok = false
        if (sub.platform === 'ios') {
          ok = await sendApnsPush(sub.endpoint, payload)
        } else if (sub.p256dh && sub.auth) {
          ok = await sendWebPush({ endpoint: sub.endpoint, p256dh: sub.p256dh, auth: sub.auth }, payload)
        }
        if (ok) deliveredAny = true
      }

      // Inbox record — once per user, regardless of per-device delivery, so
      // the durable copy survives even if a device token has gone stale.
      await recordNotification(userId, {
        type:  'daily_training',
        title: payload.title,
        body:  payload.body,
        url:   payload.data.url,
      })

      if (deliveredAny) {
        sent++
        await supabase
          .from('user_settings')
          .update({ daily_push_last_sent_on: clock.isoDate })
          .eq('id', userId)
      }
    } catch (err: any) {
      errors.push(`${userId}: ${err.message}`)
    }
  }

  console.log(`[push/send-daily] sent=${sent}, skipped=${skipped}, errors=${errors.length}`)
  return NextResponse.json({ sent, skipped, errors: errors.slice(0, 5) })
}
