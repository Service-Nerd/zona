import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { BRAND } from '@/lib/brand'
import { sendWebPush } from '@/lib/webpush'
import { sendApnsPush } from '@/lib/apnpush'

// POST /api/push/send-weekly-report
// Called by Vercel cron every Sunday at 18:00.
// Generates weekly reports for all active paid/trial users with push subscriptions,
// then sends push notifications via the right channel for each platform.
//
// Protected by CRON_SECRET header — must match env var.

export async function POST(req: NextRequest) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
  const secret = req.headers.get('x-cron-secret')
  if (!secret || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { data: subscriptions, error } = await supabase
    .from('push_subscriptions')
    .select('user_id, endpoint, p256dh, auth, platform')

  if (error || !subscriptions?.length) {
    return NextResponse.json({ sent: 0 })
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL
    ?? (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000')

  let sent = 0
  const errors: string[] = []

  for (const sub of subscriptions) {
    try {
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

      const payload = {
        title: BRAND.push.weeklyReport,
        body:  report.headline,
        tag:   'weekly-report',
        data:  { url: '/dashboard?screen=coach' },
      }

      let pushSent = false
      if (sub.platform === 'ios') {
        pushSent = await sendApnsPush(sub.endpoint, payload)
      } else {
        if (!sub.p256dh || !sub.auth) continue
        pushSent = await sendWebPush({ endpoint: sub.endpoint, p256dh: sub.p256dh, auth: sub.auth }, payload)
      }

      if (pushSent) {
        sent++
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
