import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/supabase/getUserFromRequest'
import { createClient } from '@/lib/supabase/server'
import { getUserTier } from '@/lib/trial'

// POST /api/push/subscribe
// Saves a push subscription for the authenticated user. Accepts two shapes:
//   web: { endpoint, keys: { p256dh, auth } }    — Web Push (PWA / browser)
//   ios: { platform: 'ios', token }              — APNs device token
// Only paid/trial users can subscribe.

type WebSubscription = {
  endpoint: string
  keys: { p256dh: string; auth: string }
  platform?: 'web'
}

type IosSubscription = {
  platform: 'ios'
  token: string
}

type SubscriptionBody = WebSubscription | IosSubscription

export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const supabase = createClient()

  const tier = await getUserTier(user.id)
  if (tier === 'free') return NextResponse.json({ error: 'Subscription required' }, { status: 403 })

  const body = await req.json() as SubscriptionBody

  let row: {
    user_id:  string
    endpoint: string
    platform: 'web' | 'ios'
    p256dh:   string | null
    auth:     string | null
    updated_at: string
  }

  if (body.platform === 'ios') {
    if (!body.token) {
      return NextResponse.json({ error: 'token required for ios' }, { status: 422 })
    }
    row = {
      user_id:    user.id,
      endpoint:   body.token,
      platform:   'ios',
      p256dh:     null,
      auth:       null,
      updated_at: new Date().toISOString(),
    }
  } else {
    const { endpoint, keys } = body
    if (!endpoint || !keys?.p256dh || !keys?.auth) {
      return NextResponse.json({ error: 'Invalid subscription object' }, { status: 422 })
    }
    row = {
      user_id:    user.id,
      endpoint,
      platform:   'web',
      p256dh:     keys.p256dh,
      auth:       keys.auth,
      updated_at: new Date().toISOString(),
    }
  }

  const { error } = await supabase
    .from('push_subscriptions')
    .upsert(row, { onConflict: 'user_id,endpoint' })

  if (error) {
    console.error('[push/subscribe] upsert failed', error.message)
    return NextResponse.json({ error: 'Failed to save subscription' }, { status: 500 })
  }

  return NextResponse.json({ status: 'subscribed' })
}

// DELETE /api/push/subscribe
// Removes a push subscription (user unsubscribed).
// Body accepts either { endpoint } (web) or { token } (ios).

export async function DELETE(req: NextRequest) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const supabase = createClient()

  const body = await req.json() as { endpoint?: string; token?: string }
  const key = body.endpoint ?? body.token
  if (!key) return NextResponse.json({ error: 'endpoint or token required' }, { status: 422 })

  await supabase
    .from('push_subscriptions')
    .delete()
    .eq('user_id', user.id)
    .eq('endpoint', key)

  return NextResponse.json({ status: 'unsubscribed' })
}
