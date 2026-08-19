import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { secretMatches } from '@/lib/security/secrets'
import { sendWebPush } from '@/lib/webpush'
import { sendApnsPush } from '@/lib/apnpush'
import { getUserTier } from '@/lib/trial'
import { getSessionForDate, isDateBeforePlan, isPlanComplete, parseLocalDate } from '@/lib/plan'
import { resolveEffectiveSessions, DAY_KEYS, type DayKey, type SessionOverride } from '@/lib/plan/effectiveSessions'
import { buildDailyPushTitle, buildDailyPushBody, type NextKeySession } from '@/lib/coaching/voiceLines'
import { recordNotification } from '@/lib/notifications'
import { normalizeDisplayPrefs } from '@/lib/userPrefs'
import { loadSessionMetricOverrides } from '@/lib/sessionMetricOverrides'
import { resolveSessionMetric } from '@/lib/format'
import type { Plan, Session } from '@/types/plan'

// POST /api/push/send-daily
// Vercel cron — runs hourly. For each push subscription, computes the user's
// local hour from their stored timezone. Sends one daily push to paid/trial
// users with `daily_push_enabled=true` on every planned day — the first cron
// run in the user-local morning window (06:00–11:00) delivers; the idempotency
// stamp collapses the window to one send per day. On a healthy cron the 06:30
// run wins; a drifted/dropped run self-heals at the next hour.
//
// Skip conditions (HOOK-01, amended 2026-05-27 to fire on every planned day):
//   • Free tier — no daily push.
//   • daily_push_enabled = false — user opted out.
//   • No plan / no current week — nothing to push about.
//   • Today has no session at all (genuinely empty day). Rest / strength /
//     cross-train DO push now (product decision 2026-05-27).
//   • Already sent today (daily_push_last_sent_on stamps the local date).
//   • Today screen opened within the last 30 minutes — runner is already in
//     the app, double-prompting kills the trust.
//
// Strava-independent — the source is the plan + voice lines, no run data
// touched anywhere on this path.
//
// Protected by CRON_SECRET header — must match env var. Vercel cron sends
// this automatically via the header configured in vercel.json.

const FULL_DAY_NAMES: Record<DayKey, string> = {
  mon: 'Monday', tue: 'Tuesday', wed: 'Wednesday', thu: 'Thursday',
  fri: 'Friday', sat: 'Saturday', sun: 'Sunday',
}
// Demanding sessions an easy/recovery day exists to protect. key_session=true
// (long runs, race-pace tempos, tune-ups) also qualifies.
const KEY_SESSION_TYPES = new Set(['quality', 'tempo', 'intervals', 'hard', 'long', 'race'])

// The next key session later in THIS training week — gives the morning push a
// "why" on easy/recovery days ("Easy 45m today. Intervals Thursday."). "This
// week" is a structural boundary (the plan week, Mon→Sun via DAY_KEYS), not a
// tunable lookahead — so no coaching numeric is introduced.
function findNextKeyThisWeek(
  effectiveWeek: ReturnType<typeof resolveEffectiveSessions>,
  todayKey: DayKey,
): NextKeySession | null {
  const start = DAY_KEYS.indexOf(todayKey)
  if (start < 0) return null
  for (let i = start + 1; i < DAY_KEYS.length; i++) {
    const s = effectiveWeek[DAY_KEYS[i]]?.session
    if (!s) continue
    if (KEY_SESSION_TYPES.has(s.type) || s.key_session) {
      return { type: s.type, dayName: FULL_DAY_NAMES[DAY_KEYS[i]] }
    }
  }
  return null
}

// Product decision 2026-05-27: the morning push fires on EVERY planned day,
// rest included — a daily cue, not only run days. (Previously rest / strength /
// cross-train were suppressed via SKIP_PUSH_TYPES; that set is now removed.)
// The voice-line builders already carry on-brand copy for every type, e.g.
// rest → "Do nothing. It helps.", strength → "Build the body that holds the
// zones." Only a day with no session at all is skipped.

const HEARTBEAT_SUPPRESSION_MIN = 30

// Morning send window (user-local hours). The cron fires hourly at :30, but
// GitHub Actions scheduled runs drift (5–30+ min) and are occasionally dropped
// entirely. An exact `hour === 6` match meant a single delayed/missed run lost
// the whole day's push. Instead we accept any run from local 06:00 up to (not
// including) 11:00 and let the daily idempotency stamp (`daily_push_last_sent_on`)
// guarantee exactly one send per local day: the first eligible run that morning
// delivers, every later run that day no-ops on the stamp. Delivery time is
// unchanged on a healthy cron (the 06:30 run still wins); a drifted/dropped run
// now self-heals at 07:30/08:30 instead of vanishing. Ops/delivery constants,
// not coaching numerics — same rationale as HEARTBEAT_SUPPRESSION_MIN above.
const MORNING_SEND_HOUR       = 6
const MORNING_WINDOW_END_HOUR = 11

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
  if (!secretMatches(secret, process.env.CRON_SECRET)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // ?test=1 — admin-only delivery test. Bypasses the time-of-day, idempotency
  // and already-engaged gates so a push fires immediately, and restricts the
  // run to is_admin accounts so it can never reach a real user. Does NOT stamp
  // daily_push_last_sent_on (so it can't suppress the genuine 06:30 push) and
  // does not write to the inbox. Triggered via the push-cron-daily GitHub
  // Action's manual "Run workflow" (test input) — still CRON_SECRET-gated.
  const testMode = new URL(req.url).searchParams.get('test') === '1'

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
  // Per-reason skip tally — returned in the response so an admin can see *why*
  // a run sent nothing (e.g. `rest_or_skip_type` on a strength day vs an actual
  // fault) without trawling logs. D-04: a skip is data, not silence.
  const skipReasons: Record<string, number> = {}
  const skip = (reason: string) => {
    skipped++
    skipReasons[reason] = (skipReasons[reason] ?? 0) + 1
  }

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
        .select('timezone, daily_push_enabled, daily_push_last_sent_on, last_today_open_at, is_admin, preferred_units, preferred_metric')
        .eq('id', userId)
        .maybeSingle()

      if (!settings) { skip('no_settings'); continue }
      if (settings.daily_push_enabled === false) { skip('push_disabled'); continue }

      // Test mode only ever touches admin accounts — never a real user.
      if (testMode && !settings.is_admin) { skip('test_non_admin'); continue }

      const tz    = settings.timezone || 'UTC'
      const clock = localClockFor(tz, now)
      if (!clock) { skip('bad_timezone'); continue }

      // Timing gates — skipped in test mode so a manual run fires immediately.
      if (!testMode) {
        // Morning-window filter. Accept any run from local 06:00 up to 11:00;
        // the idempotency stamp below collapses the window to one send per day.
        // (Was an exact `hour === 6` — fragile to GitHub cron drift; see the
        // MORNING_SEND_HOUR comment.)
        if (clock.hour < MORNING_SEND_HOUR || clock.hour >= MORNING_WINDOW_END_HOUR) {
          skip('outside_window'); continue
        }

        // Daily idempotency — never fire twice for the same local date. This is
        // what makes the widened window safe: only the first in-window run sends.
        if (settings.daily_push_last_sent_on === clock.isoDate) { skip('already_sent'); continue }

        // Already-engaged suppression: runner opened Today in the last 30 min.
        if (
          settings.last_today_open_at &&
          new Date(settings.last_today_open_at) > heartbeatCutoff
        ) { skip('recently_engaged'); continue }
      }

      // Paid/trial only.
      const tier = await getUserTier(userId)
      if (tier === 'free') { skip('free_tier'); continue }

      const [planRes, overridesRes, metricOverrides] = await Promise.all([
        supabase.from('plans').select('plan_json').eq('user_id', userId).single(),
        supabase.from('session_overrides')
          .select('week_n, original_day, new_day')
          .eq('user_id', userId),
        loadSessionMetricOverrides(supabase, userId),
      ])

      const plan = planRes.data?.plan_json as Plan | null
      if (!plan || plan.weeks.length === 0) { skip('no_plan'); continue }

      // Canonical date-aware resolution (ADR-016 / INV-TIME-001): the real
      // session for the user's local calendar date, or null when there is
      // genuinely nothing to push about — before the plan starts, after it ends,
      // a between-week gap, or an empty day. Replaces the old getCurrentWeekIndex
      // + day-of-week lookup, which SATURATED to week 1 before the plan began and
      // fired a "today's session" push a week early.
      const localToday = parseLocalDate(clock.isoDate)
      const allOverrides: SessionOverride[] = (overridesRes.data as SessionOverride[] | null) ?? []
      const resolved = getSessionForDate(plan.weeks, localToday, allOverrides)

      // No active session for today → don't send. Distinguish the reasons so the
      // skip tally (D-04) reads not-yet-started vs finished vs ordinary empty day.
      // Test mode still falls through to a generic payload so the delivery test
      // works regardless of plan state.
      if (!resolved && !testMode) {
        skip(
          isDateBeforePlan(plan.weeks, localToday) ? 'plan_not_started'
          : isPlanComplete(plan.weeks, localToday) ? 'plan_complete'
          : 'no_session',
        )
        continue
      }

      const session = (resolved?.session ?? null) as Session | null

      // "Next key session later THIS week" for the easy/recovery-day "why" tag —
      // computed from the effective week the resolved session lives in.
      let nextKey: NextKeySession | null = null
      if (resolved) {
        const weekOverrides = allOverrides.filter(o => o.week_n === resolved.weekN)
        const effectiveWeek = resolveEffectiveSessions(resolved.week, weekOverrides)
        nextKey = findNextKeyThisWeek(effectiveWeek, resolved.dayKey)
      }

      // Resolve how to render the session metric: per-session override → plan
      // primary_metric → global preference, plus km/mi. This is why the push now
      // reads "Easy 1h 18 today" in the user's own units instead of a hardcoded
      // 'km' (ADR-015 / INV-PREF-001).
      const prefs = normalizeDisplayPrefs(settings)
      const display = resolved
        ? {
            units: prefs.units,
            metric: resolveSessionMetric(
              resolved.weekN, resolved.originalDay,
              resolved.session.primary_metric, metricOverrides, prefs.metric,
            ),
          }
        : prefs

      const payload = session
        ? {
            title: buildDailyPushTitle(session, nextKey, display),
            body:  buildDailyPushBody(session.type),
            tag:   `daily-push-${clock.isoDate}`,
            data:  { url: '/dashboard?screen=today' },
          }
        : {
            title: 'Test push',
            body:  "Kit can reach you — notifications are working.",
            tag:   `daily-push-test-${clock.isoDate}`,
            data:  { url: '/dashboard?screen=today' },
          }

      let deliveredAny = false
      for (const sub of userSubs) {
        let ok = false
        if (sub.platform === 'ios') {
          const r = await sendApnsPush(sub.endpoint, payload)
          ok = r.ok
          // In test mode, surface the APNs failure reason in the response so a
          // manual run shows *why* delivery failed without digging into logs.
          if (!ok && testMode) errors.push(`${userId} ios: ${r.reason ?? 'unknown'}`)
        } else if (sub.p256dh && sub.auth) {
          ok = await sendWebPush({ endpoint: sub.endpoint, p256dh: sub.p256dh, auth: sub.auth }, payload)
        }
        if (ok) deliveredAny = true
      }

      // Inbox record — once per user, regardless of per-device delivery, so
      // the durable copy survives even if a device token has gone stale.
      // Skipped in test mode to keep the real inbox clean.
      if (!testMode) {
        await recordNotification(userId, {
          type:  'daily_training',
          title: payload.title,
          body:  payload.body,
          url:   payload.data.url,
        })
      }

      if (deliveredAny) {
        sent++
        // Don't stamp in test mode — that would suppress the genuine 06:30 push.
        if (!testMode) {
          await supabase
            .from('user_settings')
            .update({ daily_push_last_sent_on: clock.isoDate })
            .eq('id', userId)
        }
      }
    } catch (err: any) {
      errors.push(`${userId}: ${err.message}`)
    }
  }

  console.log(
    `[push/send-daily] sent=${sent}, skipped=${skipped}, errors=${errors.length}, ` +
    `reasons=${JSON.stringify(skipReasons)}`,
  )
  return NextResponse.json({ sent, skipped, skipReasons, errors: errors.slice(0, 5) })
}
