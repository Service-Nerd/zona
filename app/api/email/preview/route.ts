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
import { secretMatches } from '@/lib/security/secrets'
import { sendToUser } from '@/lib/email/sendToUser'
import {
  buildConnectEmail, buildFirstReadEmail, buildDay11Email, buildDay14Email,
} from '@/lib/email/trialEmailTemplates'
import {
  RUN_CLEAN, RUN_HOT, RUN_NO_HR, RUN_NONE, PREVIEW_SESSION,
} from '@/lib/email/previewFixtures'

export const dynamic = 'force-dynamic'

async function preview(req: NextRequest): Promise<NextResponse> {
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  // ── TWO WAYS IN, AND THE SECOND ONE EXISTS BECAUSE THE FIRST DOES NOT WORK
  //    FROM A BROWSER ─────────────────────────────────────────────────────────
  //
  // 🔴 This shipped user-auth only, with the instruction "open it in a browser
  // while logged in". It returns 401 every time, and `getUserFromRequest`'s own
  // doc comment says why: *"Reads the token from the Authorization header
  // (client sends it explicitly because @supabase/ssr cookie sync to the server
  // is unreliable)"*. Every in-app call goes through `authedFetch`, which sets
  // that header. A browser address bar sets nothing.
  //
  // **The comment was there and I did not read it**, which is the same class as
  // trusting a written assumption over the code.
  //
  // So `CRON_SECRET` is accepted too — the same shared-secret shape every other
  // ops route uses (`/api/ops/plan-audit`, `send-trial`), triggerable with one
  // curl and no UI. The user path stays for an in-app button later.
  const bearer = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ?? null
  const viaSecret = secretMatches(req.headers.get('x-cron-secret') || bearer, process.env.CRON_SECRET)

  // ⚠️ THE SECRET PATH STILL NEEDS A RECIPIENT, and it must be an ADMIN's
  // address — not an argument. The secret proves the caller is us; it does not
  // make an arbitrary `to` safe, and a route that accepts one is an open relay
  // with our return-path on it.
  // Named, not inferred: `typeof row` on a `let` initialised to null narrows to
  // `never` inside the branches and the errors say nothing useful.
  interface AdminRow {
    is_admin: boolean | null
    first_name: string | null
    email_unsubscribe_token: string
  }
  let userId: string | null = null
  let address: string | null = null
  let row: AdminRow | null = null

  if (viaSecret) {
    const { data } = await admin
      .from('user_settings')
      .select('id, is_admin, first_name, email_unsubscribe_token')
      .eq('is_admin', true)
      .limit(1)
      .maybeSingle()
    const a = data as (AdminRow & { id: string }) | null
    if (!a) return NextResponse.json({ error: 'No admin account' }, { status: 404 })
    userId = a.id
    row = a
    const { data: u } = await admin.auth.admin.getUserById(a.id)
    address = u?.user?.email ?? null
  } else {
    const user = await getUserFromRequest(req)
    if (!user) {
      return NextResponse.json({
        error: 'Unauthorized',
        // Say how, rather than leaving the caller to guess — this route 401'd
        // silently once already.
        hint: 'Send CRON_SECRET as `x-cron-secret`, or call from the app with an Authorization bearer token. A plain browser request cannot authenticate: the cookie session is not read server-side.',
      }, { status: 401 })
    }
    const { data } = await admin
      .from('user_settings')
      .select('is_admin, first_name, email_unsubscribe_token')
      .eq('id', user.id)
      .maybeSingle()
    row = data as AdminRow | null
    userId = user.id
    address = user.email ?? null
  }

  if (!row?.is_admin) return NextResponse.json({ error: 'Admin only' }, { status: 403 })
  if (!address || !userId) return NextResponse.json({ error: 'No address on this account' }, { status: 400 })

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
      userId,
      to: address,
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
    to: address,
    sent,
    of: results.length,
    // ⚠️ Read this rather than the count. A suppressed or failed send is reported
    // per email, because "8 attempted" and "8 arrived" are different facts.
    results,
  })
}

export async function GET(req: NextRequest)  { return preview(req) }
export async function POST(req: NextRequest) { return preview(req) }
