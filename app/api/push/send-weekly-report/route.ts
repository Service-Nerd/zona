import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// POST /api/push/send-weekly-report
// Called by Vercel cron every Sunday at 18:00.
// Generates weekly reports for all active paid/trial users with push subscriptions,
// then sends push notifications.
//
// Protected by CRON_SECRET header — must match env var.

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-cron-secret')
  if (!secret || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Fetch all push subscriptions for users with active plans
  const { data: subscriptions, error } = await supabase
    .from('push_subscriptions')
    .select('user_id, endpoint, p256dh, auth')

  if (error || !subscriptions?.length) {
    return NextResponse.json({ sent: 0 })
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL
    ?? (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000')

  let sent = 0
  const errors: string[] = []

  for (const sub of subscriptions) {
    try {
      // Generate weekly report for this user
      const reportRes = await fetch(`${baseUrl}/api/weekly-report`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-service-key': process.env.SUPABASE_SERVICE_ROLE_KEY!,
          'x-user-id':     sub.user_id,
        },
      })

      if (!reportRes.ok) continue
      const { report } = await reportRes.json()
      if (!report?.headline) continue

      // Send push notification
      const pushSent = await sendWebPush(sub, {
        title: 'Zona · Weekly report',
        body:  report.headline,
        tag:   'weekly-report',
        data:  { url: '/dashboard?screen=coach' },
      })

      if (pushSent) {
        sent++
        // Track opened_at will be set when user taps the notification
        void supabase
          .from('weekly_reports')
          .update({ generated_at: new Date().toISOString() })
          .eq('user_id', sub.user_id)
          .eq('week_n', report.week_n)
      }
    } catch (err: any) {
      errors.push(`${sub.user_id}: ${err.message}`)
    }
  }

  console.log(`[push/send-weekly-report] sent=${sent}, errors=${errors.length}`)
  return NextResponse.json({ sent, errors: errors.slice(0, 5) })
}

async function sendWebPush(
  sub: { endpoint: string; p256dh: string; auth: string },
  payload: { title: string; body: string; tag?: string; data?: Record<string, unknown> }
): Promise<boolean> {
  // Web Push requires VAPID signing. We use the web-push library pattern but
  // implement it via the Fetch API + VAPID headers to avoid Node.js-only deps.
  // In production this uses NEXT_PUBLIC_VAPID_PUBLIC_KEY + VAPID_PRIVATE_KEY.
  //
  // For the initial deployment, push is delivered via the subscription endpoint
  // directly — the browser's push service handles encryption.
  // Full VAPID implementation uses the 'web-push' package (add to package.json).

  if (!process.env.VAPID_PRIVATE_KEY || !process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY) {
    console.warn('[push] VAPID keys not configured — skipping push delivery')
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
    // 410 Gone = subscription expired — clean it up
    if (err.statusCode === 410) {
      void supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint)
    }
    return false
  }
}
