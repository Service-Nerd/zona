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
      `mailto:${process.env.VAPID_SUBJECT ?? 'push@zonna.run'}`,
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
 * Looks up ALL of a user's push subscriptions (web + iOS) and dispatches
 * each to the right transport. No-ops silently if the user has none.
 *
 * Previously this was web-only and never selected the platform column —
 * iOS rows have null p256dh/auth, so sendWebPush threw and the post-run
 * push silently never reached iOS users. Mirrors the platform-aware
 * branching already done in send-daily / send-weekly-report routes.
 */
export async function notifyUser(
  userId: string,
  payload: PushPayload,
): Promise<void> {
  const serviceSupabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  const { data: subs } = await serviceSupabase
    .from('push_subscriptions')
    .select('endpoint, p256dh, auth, platform')
    .eq('user_id', userId)

  if (!subs?.length) return

  // sendApnsPush is dynamically imported to keep the iOS-only `apn` npm
  // package off the call path for web subscribers.
  const { sendApnsPush } = await import('./apnpush')

  await Promise.all(subs.map(async sub => {
    if (sub.platform === 'ios') {
      await sendApnsPush(sub.endpoint, payload)
    } else if (sub.p256dh && sub.auth) {
      await sendWebPush({ endpoint: sub.endpoint, p256dh: sub.p256dh, auth: sub.auth }, payload)
    }
  }))
}
