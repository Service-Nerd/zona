import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendApnsPush } from '@/lib/apnpush'
import { sendWebPush } from '@/lib/webpush'
import { recordNotification } from '@/lib/notifications'

// POST /api/push/send-plan-rebuilt
// One-off: notify the 2026-08-06 incident user ("User A") that her plan was
// rebuilt (GEN-FIX-01 Stage 2). Runs on the server where the APNs keys live —
// the local publish script cannot deliver the push (keys are Vercel-only).
// Guarded by CRON_SECRET (same as the other send-* routes). Identifies the user
// by her generator_input signature — no id in the repo — and requires exactly
// one match before sending. Safe to re-run: it just re-sends.
export async function GET(req: NextRequest) { return POST(req) }

export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-cron-secret')
  if (!secret || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

  // Identify User A by her (now-persisted) generator_input signature — distinctive.
  const { data: plans, error } = await sb.from('plans').select('user_id, plan_json')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  const match = (plans ?? []).filter((r: any) => {
    const gi = r.plan_json?.meta?.generator_input
    return gi && gi.race_distance_km === 21.1 && gi.goal === 'finish'
      && gi.age === 43 && gi.current_weekly_km === 30 && gi.longest_recent_run_km === 12
      && gi.race_date === '2026-11-18'
  })
  if (match.length !== 1) {
    return NextResponse.json({ sent: 0, reason: `signature matched ${match.length} rows` }, { status: 409 })
  }
  const uid = match[0].user_id as string

  const payload = {
    title: 'We rebuilt your plan.',
    body:  'It now runs all the way to your race, and says what it actually gives you. Take a look.',
    tag:   'plan-rebuilt',
    data:  { url: '/dashboard' },
  }

  const { data: subs } = await sb.from('push_subscriptions')
    .select('endpoint, p256dh, auth, platform').eq('user_id', uid)
  if (!subs?.length) return NextResponse.json({ sent: 0, reason: 'no push subscription' })

  await recordNotification(uid, { type: 'plan_rebuilt', title: payload.title, body: payload.body, url: payload.data.url })

  let sent = 0
  const results: Array<{ platform: string; ok: boolean; reason: string | null }> = []
  for (const sub of subs as any[]) {
    if (sub.platform === 'ios') {
      const r = await sendApnsPush(sub.endpoint, payload)
      results.push({ platform: 'ios', ok: r.ok, reason: r.reason })
      if (r.ok) sent++
    } else if (sub.p256dh && sub.auth) {
      const ok = await sendWebPush({ endpoint: sub.endpoint, p256dh: sub.p256dh, auth: sub.auth }, payload)
      results.push({ platform: 'web', ok, reason: ok ? null : 'web push failed' })
      if (ok) sent++
    }
  }
  return NextResponse.json({ sent, results })
}
