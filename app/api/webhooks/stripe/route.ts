import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'

// Stripe webhook docs: https://stripe.com/docs/webhooks
// Signature verified via stripe.webhooks.constructEvent (timing-safe)

function getStripe() {
  if (!process.env.STRIPE_SECRET_KEY) throw new Error('STRIPE_SECRET_KEY not set')
  return new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2026-03-25.dahlia' })
}

function toStatus(stripeStatus: Stripe.Subscription.Status): 'trialing' | 'active' | 'cancelled' | 'expired' | null {
  switch (stripeStatus) {
    case 'trialing':      return 'trialing'
    case 'active':        return 'active'
    case 'canceled':      return 'cancelled'
    case 'unpaid':
    case 'past_due':
    case 'incomplete_expired': return 'expired'
    default:              return null
  }
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

  const subscription = event.data.object as Stripe.Subscription
  const status = toStatus(subscription.status)

  if (!status) return NextResponse.json({ received: true })

  // user_id stored as subscription metadata at checkout creation time
  const userId = subscription.metadata?.user_id
  if (!userId) {
    console.error('[stripe webhook] subscription missing user_id metadata', subscription.id)
    return NextResponse.json({ error: 'Missing user_id in metadata' }, { status: 400 })
  }

  const periodEnd = subscription.items.data[0]?.current_period_end
  if (!periodEnd) {
    console.error('[stripe webhook] subscription missing current_period_end', subscription.id)
    return NextResponse.json({ error: 'Missing period end' }, { status: 400 })
  }
  const currentPeriodEnd = new Date(periodEnd * 1000).toISOString()

  const { error } = await supabase
    .from('subscriptions')
    .upsert(
      {
        user_id: userId,
        provider: 'stripe',
        status,
        current_period_end: currentPeriodEnd,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' }
    )

  if (error) {
    console.error('[stripe webhook] upsert failed', error)
    return NextResponse.json({ error: 'DB write failed' }, { status: 500 })
  }

  return NextResponse.json({ received: true })
}
