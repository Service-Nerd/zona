// GET|POST /api/email/unsubscribe?t=<token> — EMAIL-WAVE-0.
//
// 🔴 Zonna sent 35 emails with no way to stop them. This is that way.
//
// ── WHY BOTH VERBS ──────────────────────────────────────────────────────────
// GET is the link a human clicks. POST is `List-Unsubscribe-Post`, which Gmail
// and Apple Mail call on the reader's behalf when they press the client's own
// unsubscribe button — the one most people actually use. A route that only
// handles GET silently fails that path and the reader concludes we ignored them.
//
// ── WHY NO AUTH ─────────────────────────────────────────────────────────────
// The token IS the auth. Requiring a login to unsubscribe is a dark pattern, and
// the reader may not have the app installed on the device reading the mail. The
// token is a random uuid, unguessable and unique-indexed, and it grants exactly
// one power: stopping email to its own account.
//
// ⚠️ IDEMPOTENT ON PURPOSE. Clicking twice, or a mail client pre-fetching the
// link, must not error and must not un-unsubscribe. The update is conditional on
// the column still being null.

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { BRAND } from '@/lib/brand'
import { recordOpsEvent } from '@/lib/ops/recordOpsEvent'
import { EMAIL_COLORS as C, EMAIL_TYPE as T, emailWordmark } from '@/lib/email/emailTheme'

// @public-route: the unsubscribe token IS the auth. Requiring a login to stop
// receiving email is a dark pattern, and the reader may be on a device with no
// app installed. The token is a random uuid, unique-indexed, and grants exactly
// one power: stopping email to its own account.
export const dynamic = 'force-dynamic'

function page(title: string, body: string, ok: boolean): NextResponse {
  // Plain, self-contained HTML: this renders in whatever browser a mail client
  // opens, which may be an in-app webview with no access to the site's CSS.
  // Warm Slate values are inlined here for the same reason the email templates
  // inline theirs, and they are the same values.
  return new NextResponse(
    `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${BRAND.name}</title></head>
<body style="margin:0;background:${C.bg};font-family:system-ui,-apple-system,sans-serif;">
<div style="max-width:520px;margin:0 auto;padding:64px 24px;">
  <p style="margin:0 0 28px;">${emailWordmark(BRAND.name)}</p>
  <h1 style="margin:0;font-size:${T.heading}px;font-weight:700;color:${C.ink};line-height:1.25;letter-spacing:-0.01em;">${title}</h1>
  <p style="margin:16px 0 0;font-size:${T.body}px;color:${C.ink2};line-height:1.6;">${body}</p>
</div></body></html>`,
    { status: ok ? 200 : 400, headers: { 'Content-Type': 'text/html; charset=utf-8' } },
  )
}

async function unsubscribe(req: NextRequest): Promise<NextResponse> {
  const token = req.nextUrl.searchParams.get('t')
  if (!token) return page('That link is incomplete.', 'It is missing the part that tells us who you are. Reply to any email from us and we will sort it by hand.', false)

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  const { data, error } = await supabase
    .from('user_settings')
    .select('id, email_unsubscribed_at')
    .eq('email_unsubscribe_token', token)
    .maybeSingle()

  if (error) {
    await recordOpsEvent('email_sent', { id: 'unsubscribe', outcome: 'failed', reason: 'lookup_failed', message: error.message }, null)
    return page('Something went wrong.', 'We could not reach our own records. Reply to any email from us and we will stop by hand.', false)
  }
  // ⚠️ An unknown token is NOT an error to the reader. It is almost always a
  // stale link from an account that has since been deleted, and telling someone
  // their unsubscribe failed when there is nothing left to unsubscribe from is
  // worse than saying it is done.
  if (!data) return page("You're unsubscribed.", `Nothing further will arrive from ${BRAND.name}.`, true)

  const row = data as { id: string; email_unsubscribed_at: string | null }
  if (!row.email_unsubscribed_at) {
    await supabase.from('user_settings')
      .update({ email_unsubscribed_at: new Date().toISOString() })
      .eq('id', row.id)
      .is('email_unsubscribed_at', null)
    await recordOpsEvent('email_sent', { id: 'unsubscribe', outcome: 'unsubscribed' }, row.id)
  }

  return page(
    "That's it. We'll stop.",
    `No more email from ${BRAND.name}, including trial notices. Your plan and your account are untouched, and everything still works in the app.`,
    true,
  )
}

export async function GET(req: NextRequest) { return unsubscribe(req) }
export async function POST(req: NextRequest) { return unsubscribe(req) }
