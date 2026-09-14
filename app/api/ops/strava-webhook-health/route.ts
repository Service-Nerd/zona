import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { secretMatches } from '@/lib/security/secrets'
import { recordOpsEvent } from '@/lib/ops/recordOpsEvent'
import {
  judgeSubscriptions,
  judgeApiFailure,
  isSilenceSuspicious,
  STRAVA_CALLBACK_URL,
  WEBHOOK_SILENCE_HOURS,
  type StravaSubscription,
} from '@/lib/ops/stravaWebhookHealth'

// GET/POST /api/ops/strava-webhook-health — STRAVA-WEBHOOK-OBS-01 daily probe.
//
// The no-app auto-link depends on a Strava push subscription whose callback_url
// lives at STRAVA. Nothing in this repo can fail, no deploy can break it, and no
// test can see it — a new silent-failure class ("Untooled external
// subscription"). The founder's "runs only link when I open the app" is what a
// dead subscription looks like from outside, and it took a debugging session to
// attribute because nothing was watching.
//
// Two independent checks, because they fail differently:
//   1. SUBSCRIPTION — observed directly against Strava's API. Unconditional, so
//      it is true whether or not anyone has run recently. This is the one that
//      catches the dangerous case.
//   2. SILENCE — the subscription exists at Strava but has stopped delivering.
//      Only visible as absence, so it is gated on there being connected athletes
//      who could have produced a delivery.
//
// Auth: CRON_SECRET via Authorization: Bearer or x-cron-secret header.

// Suppress repeat alerts within this window so a persistently-dead subscription
// does not write a row every run. Matches ONBOARD-OBS-01's probe.
const DEDUP_WINDOW_HOURS = 20

const STRAVA_API = 'https://www.strava.com/api/v3/push_subscriptions'

export async function GET(req: NextRequest) { return POST(req) }

export async function POST(req: NextRequest) {
  const bearer = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ?? null
  const secret = bearer || req.headers.get('x-cron-secret')
  if (!secretMatches(secret, process.env.CRON_SECRET)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const clientId = process.env.STRAVA_CLIENT_ID ?? '219980'
  const clientSecret = process.env.STRAVA_CLIENT_SECRET
  if (!clientSecret) {
    // Refuse rather than report health we cannot observe. A probe that returns
    // "ok" because it could not check is the failure it exists to prevent.
    return NextResponse.json(
      { error: 'STRAVA_CLIENT_SECRET not set — cannot observe the subscription' },
      { status: 500 },
    )
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  const dedupCutoff = new Date(Date.now() - DEDUP_WINDOW_HOURS * 3_600_000).toISOString()
  const alreadyAlerted = async (kind: 'strava_subscription_missing' | 'strava_webhook_silent') => {
    const { data } = await supabase
      .from('ops_events')
      .select('id')
      .eq('kind', kind)
      .gte('created_at', dedupCutoff)
      .limit(1)
    return !!data && data.length > 0
  }

  // ── 1. The subscription itself ────────────────────────────────────────────
  let subscription: ReturnType<typeof judgeSubscriptions>
  try {
    const res = await fetch(`${STRAVA_API}?client_id=${clientId}&client_secret=${clientSecret}`)
    const body = await res.json().catch(() => null)
    // A non-OK answer is a FINDING, not a reason to bail. Strava returning
    // 403 Application/Inactive is the single most important state this probe can
    // observe — it means no subscription can exist or deliver at all — and the
    // first version of this route returned 502 and recorded nothing about it.
    subscription = res.ok
      ? judgeSubscriptions(Array.isArray(body) ? (body as StravaSubscription[]) : [])
      : judgeApiFailure(res.status, body)
  } catch (err) {
    return NextResponse.json(
      { error: `Strava API unreachable: ${(err as Error).message}` },
      { status: 502 },
    )
  }

  if (!subscription.ok && !(await alreadyAlerted('strava_subscription_missing'))) {
    await recordOpsEvent('strava_subscription_missing', {
      reason: subscription.reason,
      detail: subscription.detail,
      expected_callback: STRAVA_CALLBACK_URL,
      ...(subscription.reason === 'wrong_callback' ? { actual_callback: subscription.actual } : {}),
      ...(subscription.reason === 'app_inactive' ? { http_status: subscription.status } : {}),
      remedy: subscription.reason === 'app_inactive'
        ? 'Reactivate the Strava application in the Strava developer settings — this cannot be fixed from the repo.'
        : 'npx tsx scripts/strava-webhook-subscription.ts register',
    })
  }

  // ── 2. Is it still delivering? ────────────────────────────────────────────
  const { count: connectedAthletes } = await supabase
    .from('user_settings')
    .select('id', { count: 'exact', head: true })
    .not('strava_athlete_id', 'is', null)

  const { data: lastHit } = await supabase
    .from('ops_events')
    .select('created_at')
    .eq('kind', 'strava_webhook_received')
    .order('created_at', { ascending: false })
    .limit(1)

  const silence = isSilenceSuspicious({
    connectedAthletes: connectedAthletes ?? 0,
    lastDeliveryIso: lastHit?.[0]?.created_at ?? null,
    now: new Date(),
  })

  // Only report silence when the subscription itself looks healthy — otherwise
  // it is the same finding twice and the second row adds nothing.
  if (silence.suspicious && subscription.ok && !(await alreadyAlerted('strava_webhook_silent'))) {
    await recordOpsEvent('strava_webhook_silent', {
      reason: silence.reason,
      hours_since_last_delivery: silence.hoursSince,
      connected_athletes: connectedAthletes ?? 0,
      threshold_hours: WEBHOOK_SILENCE_HOURS,
    })
  }

  const healthy = subscription.ok && !silence.suspicious
  console.log(
    `[ops/strava-webhook-health] subscription=${subscription.ok ? 'ok' : subscription.reason}`
    + ` silence=${silence.suspicious ? 'SUSPICIOUS' : 'ok'} athletes=${connectedAthletes ?? 0}`,
  )
  return NextResponse.json({
    healthy,
    subscription,
    silence,
    connected_athletes: connectedAthletes ?? 0,
    expected_callback: STRAVA_CALLBACK_URL,
  })
}
