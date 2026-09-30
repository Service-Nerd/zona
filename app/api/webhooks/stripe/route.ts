import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { recordOpsEvent } from '@/lib/ops/recordOpsEvent'
import { webhookTrace } from '@/lib/subscriptions/webhookTrace'
import { stripeToStatus } from '@/lib/subscriptions/stripeEvents'

// Stripe webhook docs: https://stripe.com/docs/webhooks
// Signature verified via stripe.webhooks.constructEvent (timing-safe)
//
// OPS-SUBS-TRACE-01 (2026-09-28) — this route had NO durable telemetry of any kind:
// four failure branches and the success path all reported via `console.error` /
// nothing, so a dropped payment left no queryable row. Traces are decided by
// `lib/subscriptions/webhookTrace.ts`, shared with the RevenueCat route so the two
// cannot drift — instrumenting one twin is what TWIN-SWEEP-01 names.
//
// ⚠️ DELIBERATELY NOT TRACED: the non-subscription event types filtered out below.
// Stripe sends many by design and a row per delivery would be noise, which
// NOISE-GATE-01 says gets telemetry ignored. Only a SUBSCRIPTION event that we
// could not act on is worth a row.

function getStripe() {
  if (!process.env.STRIPE_SECRET_KEY) throw new Error('STRIPE_SECRET_KEY not set')
  return new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2026-03-25.dahlia' })
}

export async function POST(req: NextRequest) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
  const rawBody = await req.text()
  const sig = req.headers.get('stripe-signature')

  if (!sig || !process.env.STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Missing signature or secret' }, { status: 401 })
  }

  let event: Stripe.Event
  try {
    event = getStripe().webhooks.constructEvent(rawBody, sig, process.env.STRIPE_WEBHOOK_SECRET)
  } catch (err) {
    console.error('[stripe webhook] signature verification failed', err)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  if (!['customer.subscription.created', 'customer.subscription.updated', 'customer.subscription.deleted'].includes(event.type)) {
    return NextResponse.json({ received: true })
  }

  // Stripe's `livemode` is TRUE for live and FALSE for test — the opposite polarity
  // from RevenueCat's `is_sandbox`. Converted here, beside the field name, so the
  // shared trace owner never has to guess which boolean convention it was handed.
  const stripeEnv = event.livemode ? 'production' : 'sandbox'
  const subscription = event.data.object as Stripe.Subscription
  const status = stripeToStatus(subscription.status)

  if (!status) {
    const t = webhookTrace('stripe', { result: 'unhandled', eventType: event.type }, stripeEnv)
    await recordOpsEvent(t.kind, { ...t.detail, stripe_status: subscription.status },
      subscription.metadata?.user_id ?? null)
    return NextResponse.json({ received: true })
  }

  // user_id stored as subscription metadata at checkout creation time
  const userId = subscription.metadata?.user_id
  if (!userId) {
    // A REAL PAYMENT DROPPED. Stripe retries a 400 only briefly, so without a row
    // here the only evidence was a console line nobody reads.
    console.error('[stripe webhook] subscription missing user_id metadata', subscription.id)
    const t = webhookTrace('stripe',
      { result: 'unusable', eventType: event.type, missing: 'user_id' }, stripeEnv)
    await recordOpsEvent(t.kind, t.detail, null)
    return NextResponse.json({ error: 'Missing user_id in metadata' }, { status: 400 })
  }

  const periodEnd = subscription.items.data[0]?.current_period_end
  if (!periodEnd) {
    console.error('[stripe webhook] subscription missing current_period_end', subscription.id)
    const t = webhookTrace('stripe',
      { result: 'unusable', eventType: event.type, missing: 'current_period_end' }, stripeEnv)
    await recordOpsEvent(t.kind, t.detail, userId)
    return NextResponse.json({ error: 'Missing period end' }, { status: 400 })
  }
  const currentPeriodEnd = new Date(periodEnd * 1000).toISOString()

  // Finding 10: apply through the ordering guard. Stripe doesn't guarantee
  // delivery order, so we gate the write on the source event's timestamp —
  // a stale `updated` arriving after a `deleted` is suppressed rather than
  // re-activating a cancelled subscription. Also idempotent for replays.
  const eventAt = new Date(event.created * 1000).toISOString()
  const { data: applied, error } = await (supabase.rpc as any)('apply_subscription_event', {
    p_user_id:    userId,
    p_provider:   'stripe',
    p_status:     status,
    p_period_end: currentPeriodEnd,
    p_event_at:   eventAt,
  })

  if (error) {
    console.error('[stripe webhook] apply_subscription_event failed', error)
    const t = webhookTrace('stripe',
      { result: 'write_failed', eventType: event.type, status, message: error.message ?? String(error) }, stripeEnv)
    await recordOpsEvent(t.kind, t.detail, userId)
    return NextResponse.json({ error: 'DB write failed' }, { status: 500 })
  }

  if (applied === false) {
    console.log('[stripe webhook] stale/out-of-order event suppressed', subscription.id, event.id)
  }

  // The HEARTBEAT. `applied: false` is the ordering guard working, not a failure.
  const t = webhookTrace('stripe',
    { result: 'received', eventType: event.type, status, applied: applied !== false }, stripeEnv)
  await recordOpsEvent(t.kind, t.detail, userId)

  return NextResponse.json({ received: true })
}
