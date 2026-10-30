import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { secretMatches, cronSecretFrom } from '@/lib/security/secrets'
import { getInternalBaseUrl } from '@/lib/coaching/autoAnalyse'
import { BRAND } from '@/lib/brand'
import { sendWebPush } from '@/lib/webpush'
import { sendApnsPush } from '@/lib/apnpush'
import { recordNotification, pruneReadNotifications } from '@/lib/notifications'

// POST /api/push/send-weekly-report
// Called by Vercel cron every Sunday at 18:00.
// Generates weekly reports for all active paid/trial users with push subscriptions,
// then sends push notifications via the right channel for each platform.
//
// Protected by CRON_SECRET, read by `cronSecretFrom` (Bearer, as Vercel cron sends it, or x-cron-secret).
// WEEKLY-REPORT-CRON-AUTH-01: this route read x-cron-secret alone, so Vercel's call was refused every Sunday.

// Vercel cron always sends GET — see send-daily for the same shim.
export async function GET(req: NextRequest) { return POST(req) }

export async function POST(req: NextRequest) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
  if (!secretMatches(cronSecretFrom(req), process.env.CRON_SECRET)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // NOTIF-01 housekeeping — prune old read notifications. Folded into this
  // weekly cron rather than a new one (Vercel Hobby caps at 2). Best-effort.
  void pruneReadNotifications()

  const { data: subscriptions, error } = await supabase
    .from('push_subscriptions')
    .select('user_id, endpoint, p256dh, auth, platform')

  if (error || !subscriptions?.length) {
    return NextResponse.json({ sent: 0 })
  }

  // The one owner of the server→server base (GTM-SITE-01); a hand-built VERCEL_URL fallback was this route's copy.
  const baseUrl = getInternalBaseUrl()

  let sent = 0
  // A report the route declined (no plan, no runs, an error) used to vanish into `continue`. Counted, so a Sunday
  // that produces nothing says so in the log instead of looking like a quiet week.
  let declined = 0
  const errors: string[] = []
  // This route iterates per-subscription, so a multi-device user appears more
  // than once. The inbox row is per-user — guard so we record it only once.
  const recorded = new Set<string>()

  for (const sub of subscriptions) {
    try {
      // COACH-READ-AUTO-01 (SLT 2026-10-30, Wood's condition): FRESH. Without `force` the route returns the week's
      // existing read, so a runner who opened Coach on Monday would be pushed Monday's thinner headline on Sunday.
      const reportRes = await fetch(`${baseUrl}/api/weekly-report?force=true`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-service-key': process.env.SUPABASE_SERVICE_ROLE_KEY!,
          'x-user-id':     sub.user_id,
        },
      })

      if (!reportRes.ok) { declined++; continue }
      const { report } = await reportRes.json()
      if (!report?.headline) continue

      const payload = {
        title: BRAND.push.weeklyReport,
        body:  report.headline,
        tag:   'weekly-report',
        data:  { url: '/dashboard?screen=coach' },
      }

      if (!recorded.has(sub.user_id)) {
        recorded.add(sub.user_id)
        await recordNotification(sub.user_id, {
          type:  'weekly_report',
          title: payload.title,
          body:  payload.body,
          url:   payload.data.url,
        })
      }

      let pushSent = false
      if (sub.platform === 'ios') {
        pushSent = (await sendApnsPush(sub.endpoint, payload)).ok
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

  console.log(`[push/send-weekly-report] sent=${sent}, declined=${declined}, errors=${errors.length}`)
  return NextResponse.json({ sent, declined, errors: errors.slice(0, 5) })
}
