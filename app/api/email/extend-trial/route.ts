// GET /api/email/extend-trial?t=<token> — ACT-EMAIL-DAY14-01.
//
// 🔴 WHY THIS EXISTS. `ops_events.email_sent`, by subject: **"Fourteen days, no runs read."
// went out 13 times of 16.** The last thing most trial runners heard from Zonna was a count of
// zero, in a mail asking them to pay for reads — and the measured reason is usually ours: of 37
// trialists, 24 had no trainable plan week inside their trial at all. A trial in which the
// product never did its one trick is not a trial anyone can decide on.
//
// So the day-14 email offers seven more days, and this is the link that grants them.
//
// ── WHY NO AUTH ─────────────────────────────────────────────────────────────
// The same reasoning as `/api/email/unsubscribe`, which this mirrors deliberately: the token IS
// the auth. It is the runner's existing `email_unsubscribe_token` — a random uuid, unique
// indexed — and reusing it means there is one secret per runner rather than two to leak.
// ⚠️ The power it grants is bounded and one-directional: seven extra days of a trial, once,
// ever. It cannot revoke, cannot change tier, and cannot be replayed.
//
// ⚠️ IDEMPOTENT, AND THE SECOND CLICK SAYS SO. Mail clients pre-fetch links, and a reader who
// clicks twice must not be told it failed. The update is conditional on `trial_extended_at`
// still being null; a second call reports the extension they already have rather than erroring
// or silently granting another week.
//
// 🔴 GET CONFIRMS, POST GRANTS, AND THAT SPLIT IS NOT CEREMONY. A GET that mutates is granted by
// every mail-gateway link scanner on delivery — so the offer would be consumed before the runner
// read the sentence, the acceptance number would measure spam filters, and the day-17 "offer
// still open" branch would be unreachable for anyone behind a corporate gateway. The confirm
// page is one button and costs the reader a tap; the alternative costs us the measurement and
// them the choice.
// ⚠️ `/api/email/unsubscribe` deliberately does the opposite and answers GET, because a scanner
// unsubscribing someone is an annoyance where a scanner spending their one extension is a loss.

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { BRAND } from '@/lib/brand'
import { recordOpsEvent } from '@/lib/ops/recordOpsEvent'
import { TRIAL_EXTENSION_DAYS } from '@/lib/trial'
import { EMAIL_COLORS as C, EMAIL_TYPE as T, emailWordmark } from '@/lib/email/emailTheme'

// @public-route: the token IS the auth — see the header. Requiring a login to accept an
// extension we offered by email would lose the people the offer exists for.
export const dynamic = 'force-dynamic'

function page(title: string, body: string): NextResponse {
  // Self-contained HTML with inlined Warm Slate values, for the same reason the email templates
  // inline theirs: this renders in whatever browser a mail client opens, which may be an in-app
  // webview with no access to the site's CSS.
  return new NextResponse(
    `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${BRAND.name}</title></head>
<body style="margin:0;background:${C.bg};font-family:system-ui,-apple-system,sans-serif;">
<div style="max-width:520px;margin:0 auto;padding:64px 24px;">
  <p style="margin:0 0 28px;">${emailWordmark(BRAND.name)}</p>
  <h1 style="margin:0;font-size:${T.heading}px;font-weight:700;color:${C.ink};line-height:1.25;letter-spacing:-0.01em;">${title}</h1>
  <p style="margin:16px 0 0;font-size:${T.lead}px;color:${C.ink2};line-height:1.6;">${body}</p>
</div></body></html>`,
    { status: 200, headers: { 'content-type': 'text/html; charset=utf-8' } },
  )
}

/** The confirm page: one button, posting back to this route. */
function confirmPage(token: string): NextResponse {
  return new NextResponse(
    `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${BRAND.name}</title></head>
<body style="margin:0;background:${C.bg};font-family:system-ui,-apple-system,sans-serif;">
<div style="max-width:520px;margin:0 auto;padding:64px 24px;">
  <p style="margin:0 0 28px;">${emailWordmark(BRAND.name)}</p>
  <h1 style="margin:0;font-size:${T.heading}px;font-weight:700;color:${C.ink};line-height:1.25;letter-spacing:-0.01em;">${TRIAL_EXTENSION_DAYS} more days?</h1>
  <p style="margin:16px 0 0;font-size:${T.lead}px;color:${C.ink2};line-height:1.6;">Your plan is where you left it. Run one, and we will read it.</p>
  <form method="post" action="/api/email/extend-trial?t=${encodeURIComponent(token)}" style="margin:28px 0 0;">
    <button type="submit" style="display:inline-block;padding:14px 28px;background:${C.mossStrong};color:${C.card};border:1px solid ${C.mossDeep};border-radius:8px;font-size:${T.body}px;font-weight:600;cursor:pointer;">Yes, add ${TRIAL_EXTENSION_DAYS} days</button>
  </form>
</div></body></html>`,
    { status: 200, headers: { 'content-type': 'text/html; charset=utf-8' } },
  )
}

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('t')
  if (!token) return page('That link is incomplete.', 'Open the link from the email again.')
  // No read, no write, nothing recorded: a scanner opening this learns nothing and changes
  // nothing, which is the whole point of the split.
  return confirmPage(token)
}

export async function POST(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('t')
  if (!token) return page('That link is incomplete.', 'Open the link from the email again.')

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  const { data: row, error } = await supabase
    .from('user_settings')
    .select('id, trial_extended_at')
    .eq('email_unsubscribe_token', token)
    .maybeSingle()

  if (error) {
    // ⚠️ A failed READ is not an unknown token, and saying "we don't recognise that link" to a
    // runner holding a valid one would be a lie we could not detect later.
    await recordOpsEvent('trial_extend_failed', { stage: 'read', message: error.message.slice(0, 300) })
    return page('Something went wrong.', 'Try the link again in a minute.')
  }
  if (!row) {
    await recordOpsEvent('trial_extend_failed', { stage: 'unknown_token' })
    return page('We don’t recognise that link.', 'It may have been replaced by a newer email.')
  }

  if (row.trial_extended_at) {
    await recordOpsEvent('trial_extended', { outcome: 'already', days: TRIAL_EXTENSION_DAYS }, row.id)
    return page(
      `You already have the extra ${TRIAL_EXTENSION_DAYS} days.`,
      'Nothing more to do. Go for a run.',
    )
  }

  // Conditional on the column still being null: two concurrent clicks cannot both win, so the
  // extension is granted once however many times the link is opened.
  const { data: updated, error: writeErr } = await supabase
    .from('user_settings')
    .update({ trial_extended_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq('id', row.id)
    .is('trial_extended_at', null)
    .select('id')

  if (writeErr) {
    await recordOpsEvent('trial_extend_failed', { stage: 'write', message: writeErr.message.slice(0, 300) }, row.id)
    return page('Something went wrong.', 'Try the link again in a minute.')
  }

  const won = Array.isArray(updated) && updated.length > 0
  await recordOpsEvent('trial_extended', { outcome: won ? 'granted' : 'already', days: TRIAL_EXTENSION_DAYS }, row.id)
  return page(
    `${TRIAL_EXTENSION_DAYS} more days.`,
    'Your plan is where you left it. Run one, and we will read it.',
  )
}
