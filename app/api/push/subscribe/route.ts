import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getUserTier } from '@/lib/trial'

// POST /api/push/subscribe
// Saves a Web Push subscription for the authenticated user.
// Only paid/trial users can subscribe.

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const tier = await getUserTier(user.id)
  if (tier === 'free') return NextResponse.json({ error: 'Subscription required' }, { status: 403 })

  const body = await req.json()
  const { endpoint, keys } = body as {
    endpoint: string
    keys: { p256dh: string; auth: string }
  }

  if (!endpoint || !keys?.p256dh || !keys?.auth) {
    return NextResponse.json({ error: 'Invalid subscription object' }, { status: 422 })
  }

  const { error } = await supabase.from('push_subscriptions').upsert({
    user_id:    user.id,
    endpoint,
    p256dh:     keys.p256dh,
    auth:       keys.auth,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id,endpoint' })

  if (error) {
    console.error('[push/subscribe] upsert failed', error.message)
    return NextResponse.json({ error: 'Failed to save subscription' }, { status: 500 })
  }

  return NextResponse.json({ status: 'subscribed' })
}

// DELETE /api/push/subscribe
// Removes a push subscription (user unsubscribed).

export async function DELETE(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { endpoint } = await req.json()
  if (!endpoint) return NextResponse.json({ error: 'endpoint required' }, { status: 422 })

  await supabase
    .from('push_subscriptions')
    .delete()
    .eq('user_id', user.id)
    .eq('endpoint', endpoint)

  return NextResponse.json({ status: 'unsubscribed' })
}
