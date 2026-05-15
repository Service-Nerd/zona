import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

// RevenueCat webhook docs: https://www.revenuecat.com/docs/integrations/webhooks
// Authorization: header value compared directly against REVENUECAT_WEBHOOK_SECRET

const REVENUECAT_WEBHOOK_SECRET = process.env.REVENUECAT_WEBHOOK_SECRET

function toStatus(eventType: string): 'trialing' | 'active' | 'cancelled' | 'expired' | null {
  switch (eventType) {
    case 'INITIAL_PURCHASE':
    case 'RENEWAL':
    case 'UNCANCELLATION':
      return 'active'
    case 'TRIAL_STARTED':
    case 'TRIAL_CONVERTED':
      return eventType === 'TRIAL_STARTED' ? 'trialing' : 'active'
    case 'CANCELLATION':
      return 'cancelled'
    case 'EXPIRATION':
      return 'expired'
    default:
      return null
  }
}

export async function POST(req: NextRequest) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
  const rawBody = await req.text()

  // Verify Authorization header matches configured secret
  if (REVENUECAT_WEBHOOK_SECRET) {
    const auth = req.headers.get('Authorization')
    if (!auth) return NextResponse.json({ error: 'Missing authorization' }, { status: 401 })
    if (auth !== REVENUECAT_WEBHOOK_SECRET) {
      return NextResponse.json({ error: 'Invalid authorization' }, { status: 401 })
    }
  }

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
    // Unhandled event type — acknowledge without acting
    return NextResponse.json({ received: true })
  }

  const appUserId: string = rc.app_user_id
  const expiresAt: string = rc.expiration_at_ms
    ? new Date(rc.expiration_at_ms).toISOString()
    : rc.expires_date ?? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()

  const { error } = await supabase
    .from('subscriptions')
    .upsert(
      {
        user_id: appUserId,
        provider: 'revenuecat',
        status,
        current_period_end: expiresAt,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' }
    )

  if (error) {
    console.error('[revenuecat webhook] upsert failed', error)
    return NextResponse.json({ error: 'DB write failed' }, { status: 500 })
  }

  return NextResponse.json({ received: true })
}
