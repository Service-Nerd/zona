import { createClient } from '@supabase/supabase-js'

// Shared Web Push delivery helper.
// Requires VAPID_PRIVATE_KEY + NEXT_PUBLIC_VAPID_PUBLIC_KEY env vars.
// Uses the 'web-push' npm package for VAPID signing.

export interface PushPayload {
  title: string
  body:  string
  tag?:  string
  data?: Record<string, unknown>
}

/**
 * Sends a Web Push notification to a single subscription endpoint.
 * Returns true on success, false on any failure.
 * Automatically removes expired subscriptions (410 Gone).
 */
export async function sendWebPush(
  sub: { endpoint: string; p256dh: string; auth: string },
  payload: PushPayload,
): Promise<boolean> {
  if (!process.env.VAPID_PRIVATE_KEY || !process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY) {
    console.warn('[webpush] VAPID keys not configured — skipping push delivery')
    return false
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const webpush = require('web-push') as any
    webpush.setVapidDetails(
      `mailto:${process.env.VAPID_SUBJECT ?? 'push@zona.app'}`,
      process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
      process.env.VAPID_PRIVATE_KEY!,
    )

    await webpush.sendNotification(
      { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
      JSON.stringify(payload),
    )
    return true
  } catch (err: any) {
    if (err.statusCode === 410) {
      // Subscription expired — clean up silently
      const serviceSupabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
      )
      void serviceSupabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint)
    }
    return false
  }
}

/**
 * Looks up a user's push subscription and sends a notification.
 * No-ops silently if the user has no subscription.
 */
export async function notifyUser(
  userId: string,
  payload: PushPayload,
): Promise<void> {
  const serviceSupabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  const { data: sub } = await serviceSupabase
    .from('push_subscriptions')
    .select('endpoint, p256dh, auth')
    .eq('user_id', userId)
    .maybeSingle()

  if (!sub) return

  await sendWebPush(sub, payload)
}
