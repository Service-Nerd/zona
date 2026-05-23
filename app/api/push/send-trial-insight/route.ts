import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { BRAND } from '@/lib/brand'
import { sendWebPush } from '@/lib/webpush'
import { sendApnsPush } from '@/lib/apnpush'
import { getUserTier } from '@/lib/trial'

// POST/GET /api/push/send-trial-insight
//
// HOOK-02 — one-shot mid-trial reciprocity nudge. Fires once between trial
// day 3 and day 5 inclusive when the user has ≥2 analysed runs. Title is
// `BRAND.push.trialInsight`; body is the first sentence of the most recent
// `run_analysis.feedback_text` (already in Kit voice).
//
// Cron: hourly (vercel.json). The trial-day filter is the rate limit — a
// given user is eligible across roughly three calendar days, and the
// `trial_insight_push_sent_at` stamp makes it a one-shot for life.
//
// Strava-independent — sources from `run_analysis` which is populated by
// either Strava or HealthKit pipelines (source-agnostic on the read side).
//
// Auth: accepts both `Authorization: Bearer <CRON_SECRET>` (Vercel cron's
// default) and `x-cron-secret` (parity with /api/push/send-weekly-report).

const TRIAL_DAY_MIN = 3
const TRIAL_DAY_MAX = 5
const BODY_MAX_CHARS = 100
const MS_PER_DAY = 24 * 60 * 60 * 1000

// First sentence of the feedback text, truncated. Falls back to a hard
// character truncation if no sentence terminator appears in the body. We
// avoid mid-word breaks where possible.
function firstSentence(text: string, max = BODY_MAX_CHARS): string {
  const trimmed = text.trim()
  if (!trimmed) return ''
  const match = trimmed.match(/^.+?[.!?](?:\s|$)/)
  const candidate = (match ? match[0] : trimmed).trim()
  if (candidate.length <= max) return candidate
  // Hard cap — back up to the previous word boundary, then ellipsise.
  const hard = candidate.slice(0, max)
  const lastSpace = hard.lastIndexOf(' ')
  return (lastSpace > max - 20 ? hard.slice(0, lastSpace) : hard).replace(/[.,;:]\s*$/, '') + '…'
}

function trialDayNumber(trialStartedAt: string, now: Date): number {
  const start = new Date(trialStartedAt).getTime()
  return Math.floor((now.getTime() - start) / MS_PER_DAY) + 1
}

export async function GET(req: NextRequest) { return POST(req) }

export async function POST(req: NextRequest) {
  const bearer = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ?? null
  const custom = req.headers.get('x-cron-secret')
  const secret = bearer || custom
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
    console.error('[push/send-trial-insight] subscription read failed', error.message)
    return NextResponse.json({ error: 'Subscription read failed' }, { status: 500 })
  }
  if (!subscriptions?.length) {
    return NextResponse.json({ sent: 0, considered: 0 })
  }

  const now    = new Date()
  let sent     = 0
  let skipped  = 0
  const errors: string[] = []

  // Group subscriptions by user — multi-device users get a push on every
  // device, but eligibility is computed once per user.
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
        .select('trial_started_at, trial_insight_push_sent_at')
        .eq('id', userId)
        .maybeSingle()

      if (!settings) { skipped++; continue }
      // One-shot — never re-fire.
      if (settings.trial_insight_push_sent_at) { skipped++; continue }
      if (!settings.trial_started_at) { skipped++; continue }

      const day = trialDayNumber(settings.trial_started_at, now)
      if (day < TRIAL_DAY_MIN || day > TRIAL_DAY_MAX) { skipped++; continue }

      // Tier check — only paid/trial. A user whose trial expired (e.g. day 5
      // crosses midnight before this cron runs on day 6) will have already
      // been filtered by the day-range check above; this is the backstop for
      // users who paid mid-trial (still 'paid', still eligible).
      const tier = await getUserTier(userId)
      if (tier === 'free') { skipped++; continue }

      // Need ≥2 analysed runs with usable feedback_text. Order by created_at
      // desc so the first row is the most recent — that's the one we source
      // the body from.
      const { data: analyses } = await supabase
        .from('run_analysis')
        .select('feedback_text, week_n, session_day, created_at')
        .eq('user_id', userId)
        .not('feedback_text', 'is', null)
        .order('created_at', { ascending: false })
        .limit(5)

      const usable = (analyses ?? []).filter(a => (a.feedback_text ?? '').trim().length > 0)
      if (usable.length < 2) { skipped++; continue }

      const latest = usable[0]
      const body   = firstSentence(latest.feedback_text as string)
      if (!body) { skipped++; continue }

      const payload = {
        title: BRAND.push.trialInsight,
        body,
        tag:   'trial-insight',
        // Deep-link to the matched session. DashboardClient reads
        // screen=session + weekN + sessionDay and routes to SessionScreen.
        data: {
          url: `/dashboard?screen=session&weekN=${latest.week_n}&sessionDay=${encodeURIComponent(latest.session_day)}`,
        },
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

      if (deliveredAny) {
        sent++
        await supabase
          .from('user_settings')
          .update({ trial_insight_push_sent_at: now.toISOString() })
          .eq('id', userId)
      }
    } catch (err: any) {
      errors.push(`${userId}: ${err.message}`)
    }
  }

  console.log(`[push/send-trial-insight] sent=${sent}, skipped=${skipped}, errors=${errors.length}`)
  return NextResponse.json({ sent, skipped, errors: errors.slice(0, 5) })
}
