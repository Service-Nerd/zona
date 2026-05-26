import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/supabase/getUserFromRequest'
import { createClient } from '@supabase/supabase-js'
import { getUserTier } from '@/lib/trial'

// push_subscriptions has RLS (auth.uid() = user_id). The native app authenticates
// with a Bearer token (no Supabase cookies), so a cookie-based client has no
// session and auth.uid() is NULL — every insert was being rejected by RLS and the
// row silently never stored. The user is already authenticated via
// getUserFromRequest and user_id is pinned server-side, so we write with the
// service-role client (RLS-exempt) the same way delete-account / getUserTier do.
function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

// True when `tz` is an IANA zone the runtime recognises. Intl throws a
// RangeError on an unknown zone — we treat that as "ignore", not "store".
function isValidTimeZone(tz: string): boolean {
  try {
    Intl.DateTimeFormat('en-GB', { timeZone: tz })
    return true
  } catch {
    return false
  }
}

// POST /api/push/subscribe
// Saves a push subscription for the authenticated user. Accepts two shapes:
//   web: { endpoint, keys: { p256dh, auth } }    — Web Push (PWA / browser)
//   ios: { platform: 'ios', token }              — APNs device token
// Only paid/trial users can subscribe.

// `timezone` is the IANA zone of the registering device (e.g. 'Europe/London').
// send-daily reads user_settings.timezone to fire the 06:30 push in the user's
// local time, so the device that receives the push is the authoritative source
// for that zone — capture it here rather than relying solely on the on-load
// client write, which leaves the column at its 'UTC' default if it never runs.
type WebSubscription = {
  endpoint: string
  keys: { p256dh: string; auth: string }
  platform?: 'web'
  timezone?: string
}

type IosSubscription = {
  platform: 'ios'
  token: string
  timezone?: string
}

type SubscriptionBody = WebSubscription | IosSubscription

export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const supabase = adminClient()

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

  // Capture the registering device's timezone so the daily push fires at the
  // user's local 06:30. Validated against Intl before writing — an unknown
  // zone string is ignored rather than overwriting a good value with junk.
  const tz = body.timezone
  if (tz && isValidTimeZone(tz)) {
    const { error: tzError } = await supabase
      .from('user_settings')
      .update({ timezone: tz, updated_at: new Date().toISOString() })
      .eq('id', user.id)
    if (tzError) console.warn('[push/subscribe] timezone update failed', tzError.message)
  }

  return NextResponse.json({ status: 'subscribed' })
}

// GET /api/push/subscribe[?platform=ios|web]
// Reports whether the authenticated user has a stored push subscription, so the
// UI toggle can reflect real subscription state rather than mere OS permission
// (permission granted ≠ a row was ever written — the token can fail to register).
export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ subscribed: false }, { status: 401 })
  const supabase = adminClient()

  const platform = new URL(req.url).searchParams.get('platform')
  let query = supabase
    .from('push_subscriptions')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
  if (platform === 'ios' || platform === 'web') query = query.eq('platform', platform)

  const { count, error } = await query
  if (error) {
    console.error('[push/subscribe] count failed', error.message)
    return NextResponse.json({ subscribed: false }, { status: 500 })
  }
  return NextResponse.json({ subscribed: (count ?? 0) > 0 })
}

// DELETE /api/push/subscribe
// Removes a push subscription (user unsubscribed).
// Body accepts either { endpoint } (web) or { token } (ios).

export async function DELETE(req: NextRequest) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const supabase = adminClient()

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
