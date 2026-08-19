import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { secretMatches } from '@/lib/security/secrets'
import { sendEmail } from '@/lib/email/resend'
import { buildDay11Email, buildDay14Email, type RunSummary } from '@/lib/email/trialEmailTemplates'
import { trialDayNumber, decideTrialEmails } from '@/lib/email/trialEmailWindow'

// POST /api/email/send-trial
//
// GTM-09 (day 14) + GTM-10 (day 11) trial lifecycle emails.
//
// Runs once daily via GitHub Actions (email-cron-trial.yml). For each
// trialing user whose trial_started_at falls in the day-11 or day-14
// window — and whose idempotency stamp is unset — sends one email and
// stamps the send.
//
// Content follows SLT board guidance: surface a specific run + what it
// showed. No scarcity framing. Sounds like the app noticed something.
//
// Auth: CRON_SECRET via Authorization: Bearer or x-cron-secret header.
//
// Send windows (nudge + expiry) are stamp-guarded RANGES, not exact-day
// equality — see lib/email/trialEmailWindow.ts + architectural-principles N-014.

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function getRunSummary(supabase: any, userId: string): Promise<RunSummary> {
  const { data: analyses } = await supabase
    .from('run_analysis')
    .select('actual_load_km, hr_in_zone_pct, verdict, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(10)

  const rows = (analyses ?? []) as Array<{
    actual_load_km: number | null
    hr_in_zone_pct: number | null
    verdict: string | null
    created_at: string
  }>
  const latest = rows[0] ?? null

  return {
    actualLoadKm: latest?.actual_load_km ?? null,
    hrInZonePct: latest?.hr_in_zone_pct ?? null,
    verdict: latest?.verdict ?? null,
    analysedRunCount: rows.length,
    dayName: latest?.created_at ? DAY_NAMES[new Date(latest.created_at).getDay()] : null,
  }
}

export async function GET(req: NextRequest) { return POST(req) }

export async function POST(req: NextRequest) {
  const bearer = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ?? null
  const custom = req.headers.get('x-cron-secret')
  const secret = bearer || custom
  if (!secretMatches(secret, process.env.CRON_SECRET)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  const { data: allSettings, error } = await supabase
    .from('user_settings')
    .select('id, trial_started_at, trial_email_day11_sent_at, trial_email_day14_sent_at')
    .not('trial_started_at', 'is', null)

  if (error) {
    console.error('[email/send-trial] user_settings read failed:', error.message)
    return NextResponse.json({ error: 'Read failed' }, { status: 500 })
  }

  const now = new Date()
  let day11Sent = 0
  let day14Sent = 0
  let skipped = 0
  const errors: string[] = []

  for (const settings of allSettings ?? []) {
    try {
      const day = trialDayNumber(settings.trial_started_at, now)
      const { needsDay11, needsDay14 } = decideTrialEmails(day, settings)

      if (!needsDay11 && !needsDay14) { skipped++; continue }

      // Get user email via admin API (service role only)
      const { data: { user }, error: userErr } = await supabase.auth.admin.getUserById(settings.id)
      if (userErr || !user?.email) { skipped++; continue }

      const email = user.email
      const firstName = (user.user_metadata?.full_name as string | undefined)?.split(' ')[0] ?? null

      const run = await getRunSummary(supabase, settings.id)

      if (needsDay11) {
        const { subject, html } = buildDay11Email(firstName, run)
        const ok = await sendEmail({ to: email, subject, html })
        if (ok) {
          day11Sent++
          await supabase
            .from('user_settings')
            .update({ trial_email_day11_sent_at: now.toISOString() })
            .eq('id', settings.id)
        }
      }

      if (needsDay14) {
        const { subject, html } = buildDay14Email(firstName, run)
        const ok = await sendEmail({ to: email, subject, html })
        if (ok) {
          day14Sent++
          await supabase
            .from('user_settings')
            .update({ trial_email_day14_sent_at: now.toISOString() })
            .eq('id', settings.id)
        }
      }
    } catch (err: any) {
      errors.push(`${settings.id}: ${err.message}`)
    }
  }

  console.log(`[email/send-trial] day11=${day11Sent}, day14=${day14Sent}, skipped=${skipped}, errors=${errors.length}`)
  return NextResponse.json({ day11Sent, day14Sent, skipped, errors: errors.slice(0, 5) })
}
