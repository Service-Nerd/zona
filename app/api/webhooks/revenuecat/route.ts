import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { secretMatches } from '@/lib/security/secrets'
import { recordOpsEvent } from '@/lib/ops/recordOpsEvent'
import { toStatus, isGrantEvent, eventAtIso, NON_EXPIRING_GRANT_YEARS } from '@/lib/subscriptions/revenuecatEvents'

// RevenueCat webhook docs: https://www.revenuecat.com/docs/integrations/webhooks
// Authorization: header value compared against REVENUECAT_WEBHOOK_SECRET

const REVENUECAT_WEBHOOK_SECRET = process.env.REVENUECAT_WEBHOOK_SECRET

export async function POST(req: NextRequest) {
  // Finding 3: fail closed. A missing secret must never mean "accept every
  // request" — that let anyone forge a subscription for any user_id. Reject
  // unless the secret is configured AND the Authorization header matches it.
  if (!REVENUECAT_WEBHOOK_SECRET) {
    console.error('[revenuecat webhook] REVENUECAT_WEBHOOK_SECRET not set — rejecting request')
    return NextResponse.json({ error: 'Webhook not configured' }, { status: 503 })
  }
  if (!secretMatches(req.headers.get('Authorization'), REVENUECAT_WEBHOOK_SECRET)) {
    return NextResponse.json({ error: 'Invalid authorization' }, { status: 401 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
  const rawBody = await req.text()

  let event: any
  try {
    event = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { event: rc } = event
  if (!rc) return NextResponse.json({ error: 'Malformed payload' }, { status: 400 })

  const status = toStatus(rc.type)
  if (!status) {
    // Unhandled event type. Still acknowledge and still do nothing — guessing a
    // status from an event we do not understand would mis-tier a real customer.
    // But RECORD it: this branch used to be silent, which is how a comp grant
    // could fail with no trace at all. If a charity runner reports a paywall
    // they should not be seeing, look here first.
    await recordOpsEvent('revenuecat_event_unhandled',
      { event_type: rc.type }, rc.app_user_id ?? null)
    return NextResponse.json({ received: true })
  }

  const appUserId: string = rc.app_user_id
  const expiresAt: string = rc.expiration_at_ms
    ? new Date(rc.expiration_at_ms).toISOString()
    : rc.expires_date ?? (
        isGrantEvent(rc.type)
          // Open-ended comp: do NOT apply the 30-day subscription default.
          ? new Date(Date.now() + NON_EXPIRING_GRANT_YEARS * 365 * 24 * 60 * 60 * 1000).toISOString()
          : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
      )

  // 🔴 SUBS-ORDERING-REVENUECAT-01 (2026-09-24) — THIS USED TO BE A PLAIN UPSERT,
  // AND THE GUARD IT NOW CALLS WAS WRITTEN FOR THIS ROUTE TOO.
  //
  // `20260819_subscription_event_ordering.sql` opens: "Stripe (AND REVENUECAT) do
  // not guarantee delivery order. A stale `customer.subscription.updated` arriving
  // AFTER a `deleted` could re-activate a cancelled subscription VIA THE PLAIN
  // UPSERT." It named both providers, was wired for one, and this route went on
  // performing the exact upsert that sentence describes as the hazard — so a
  // replayed delivery was not a no-op, an out-of-order event could re-activate a
  // cancelled subscription or move `current_period_end` backwards, and
  // `last_event_at` was never populated for this provider at all.
  //
  // `subscriptions` is what `resolveTier` reads for every tier decision in the app,
  // so the blast radius was a real customer's tier. Found while WRITING THE
  // CONTRACT for this route — reading it closely enough to write down what it
  // promises is what surfaced it.
  const eventAt = eventAtIso(rc)
  if (!eventAt) {
    // Null is the correct fallback — it makes the RPC apply, i.e. exactly the old
    // behaviour — but a guard that has quietly stopped guarding must leave a trace.
    await recordOpsEvent('revenuecat_event_no_timestamp',
      { event_type: rc.type }, appUserId ?? null)
  }

  const { data: applied, error } = await (supabase.rpc as any)('apply_subscription_event', {
    p_user_id:    appUserId,
    p_provider:   'revenuecat',
    p_status:     status,
    p_period_end: expiresAt,
    p_event_at:   eventAt,
  })

  if (error) {
    console.error('[revenuecat webhook] apply_subscription_event failed', error)
    return NextResponse.json({ error: 'DB write failed' }, { status: 500 })
  }
  if (applied === false) {
    console.log('[revenuecat webhook] stale/out-of-order event suppressed', rc.type, appUserId)
  }

  return NextResponse.json({ received: true })
}
