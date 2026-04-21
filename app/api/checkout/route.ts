import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Stripe Checkout session creation.
// Requires: STRIPE_SECRET_KEY + a configured Stripe product/price.
// See backlog Launch Config Checklist before enabling.

export async function POST(req: NextRequest) {
  if (!process.env.STRIPE_SECRET_KEY) {
    return NextResponse.json(
      { error: 'Payments not configured yet. Check back soon.' },
      { status: 503 }
    )
  }

  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { annual } = await req.json()

  const Stripe = (await import('stripe')).default
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2026-03-25.dahlia' })

  const priceId = annual
    ? process.env.STRIPE_PRICE_ANNUAL
    : process.env.STRIPE_PRICE_MONTHLY

  if (!priceId) {
    return NextResponse.json({ error: 'Price not configured.' }, { status: 503 })
  }

  const origin = req.headers.get('origin') ?? 'https://zona.vercel.app'

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    line_items: [{ price: priceId, quantity: 1 }],
    subscription_data: {
      trial_period_days: 14,
      metadata: { user_id: user.id },
    },
    metadata: { user_id: user.id },
    success_url: `${origin}/dashboard?subscription=success`,
    cancel_url: `${origin}/dashboard`,
    customer_email: user.email,
  })

  return NextResponse.json({ url: session.url })
}
