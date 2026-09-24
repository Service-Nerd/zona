// GET|POST /api/email/preview — EMAIL-WAVE-1…4. Send every email to yourself.
//
// 🔴 WHY IT EXISTS. Every board sitting on the email programme ended on the same
// line: **nothing has ever been seen rendered in a real mail client.** A browser
// is far kinder than Gmail — it honours CSS a mail client strips, and it does not
// reflow a 520px table into a phone. `scripts/render-emails.ts` writes files you
// can look at; it cannot tell you what Gmail does with them.
//
// It also cannot run locally: `RESEND_API_KEY` lives in Vercel and is not in
// `.env.local`, so nothing on a dev machine can post to Resend. This route runs
// where the key is.
//
// ── IT SENDS TO YOU, AND ONLY TO YOU ────────────────────────────────────────
//
// There is deliberately **no `to` parameter**. The address is resolved from the
// authenticated admin's own account. A route that accepts an arbitrary recipient
// and a shared secret is an open relay with a Zonna return-path, and the blast
// radius of getting that wrong is the sending domain's reputation.
//
// ── IT GOES THROUGH `sendToUser`, LIKE EVERYTHING ELSE ──────────────────────
//
// Not through `sendEmail`. `noRawEmailSends.test.ts` would fail the build, and it
// should: a preview that bypassed suppression could mail an admin who had
// unsubscribed, and it would leave no `email_sent` record. **A preview is a real
// email. It obeys the same rules.**

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getUserFromRequest } from '@/lib/supabase/getUserFromRequest'
import { sendToUser } from '@/lib/email/sendToUser'
import {
  buildConnectEmail, buildFirstReadEmail, buildDay11Email, buildDay14Email,
} from '@/lib/email/trialEmailTemplates'
import {
  RUN_CLEAN, RUN_HOT, RUN_NO_HR, RUN_NONE, PREVIEW_SESSION,
} from '@/lib/email/previewFixtures'

export const dynamic = 'force-dynamic'

async function preview(req: NextRequest): Promise<NextResponse> {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  const { data } = await admin
    .from('user_settings')
    .select('is_admin, first_name, email_unsubscribe_token')
    .eq('id', user.id)
    .maybeSingle()

  const row = data as { is_admin: boolean | null; first_name: string | null; email_unsubscribe_token: string } | null
  if (!row?.is_admin) return NextResponse.json({ error: 'Admin only' }, { status: 403 })
  if (!user.email) return NextResponse.json({ error: 'No address on this account' }, { status: 400 })

  const name = row.first_name
  const tok  = row.email_unsubscribe_token

  // ⚠️ EVERY EMAIL IN EVERY STATE. The empty variants are the point: 22 of 30
  // real recipients hit one, and a preview that only shows the happy path is how
  // they shipped unnoticed.
  const all = [
    ['1 · Connect',                      buildConnectEmail(name, tok)],
    ['2 · First read',                   buildFirstReadEmail(name, { ...RUN_CLEAN, analysedRunCount: 1 }, tok, PREVIEW_SESSION)],
    ['2 · First read — no HR',           buildFirstReadEmail(name, { ...RUN_NO_HR, analysedRunCount: 1 }, tok, PREVIEW_SESSION)],
    ['4 · 3 days left',                  buildDay11Email(name, RUN_CLEAN, tok)],
    ['4 · 3 days left — above ceiling',  buildDay11Email(name, RUN_HOT, tok)],
    ['4 · 3 days left — no runs',        buildDay11Email(name, RUN_NONE, tok)],
    ['5 · Trial ends today',             buildDay14Email(name, RUN_CLEAN, tok)],
    ['5 · Trial ends today — no runs',   buildDay14Email(name, RUN_NONE, tok)],
  ] as const

  const results: Array<{ email: string; subject: string; outcome: string }> = []
  for (const [label, { subject, html }] of all) {
    const outcome = await sendToUser({
      userId: user.id,
      to: user.email,
      id: 'preview',
      kind: 'transactional',
      // The label rides in the subject so eight near-identical emails are
      // tellable apart in an inbox. Previews only — never on a real send.
      subject: `[preview] ${label} — ${subject}`,
      html,
    })
    results.push({ email: label, subject, outcome })
  }

  const sent = results.filter(r => r.outcome === 'sent').length
  return NextResponse.json({
    to: user.email,
    sent,
    of: results.length,
    // ⚠️ Read this rather than the count. A suppressed or failed send is reported
    // per email, because "8 attempted" and "8 arrived" are different facts.
    results,
  })
}

export async function GET(req: NextRequest)  { return preview(req) }
export async function POST(req: NextRequest) { return preview(req) }
