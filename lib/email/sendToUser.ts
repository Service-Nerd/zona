// sendToUser.ts — the single owner of "send an email to a runner".
//
// 🔴 EMAIL-WAVE-0, SLT 2026-09-24. `sendEmail` is the transport: it takes an
// address and posts it to Resend. It knows nothing about consent, it records
// nothing, and until now it was called directly from a route. That is how 35
// emails went out with no unsubscribe path and no record that they existed.
//
// This module is the layer that makes both impossible to skip:
//
//   1. **Suppression.** An unsubscribed runner is not sent to. The check lives
//      here rather than at the call site, because a check at the call site is a
//      check the next call site forgets — this repo has paid for that with
//      `decideTrialEmails` (a route that mailed "3 days left" to people who had
//      already subscribed), with fourteen hand-written Anthropic calls, and with
//      the tier order existing three times.
//   2. **A record.** Every outcome records an `email_sent` ops event, INCLUDING
//      the suppressed and failed ones. A send we cannot see is a send we cannot
//      reason about, which is the state the SLT ruled on.
//
// ⚠️ `noRawEmailSends.test.ts` fails the build if any file outside this module
// calls `sendEmail`. That test is the mechanism; this comment is not.
//
// ── ONE UNSUBSCRIBE STOPS EVERYTHING ─────────────────────────────────────────
//
// `kind` is recorded, not obeyed. The law would let a transactional notice
// through to someone who opted out of marketing, and we are choosing not to: a
// runner who asks us to stop and then receives "your coaching pauses today" has
// been told their preference was negotiable. Trial state is visible in the app,
// which is where it belongs. **If that policy is ever revisited, it is revisited
// here, in one place, with the reason.**

import { createClient } from '@supabase/supabase-js'
import { sendEmail } from './resend'
import { unsubscribeUrl } from './trialEmailTemplates'
import { recordOpsEvent } from '@/lib/ops/recordOpsEvent'

/** What kind of message this is. **Recorded for analysis, never used to bypass
 *  suppression** — see the header. */
export type EmailKind = 'transactional' | 'marketing'

/** Every email the programme can send. A closed union so a new email cannot be
 *  added without appearing in the instrumentation vocabulary — the same reason
 *  `lib/ai/surfaces.ts` exists. */
export type EmailId =
  | 'connect'
  | 'first_read'
  | 'pattern'
  | 'trial_day11'
  | 'trial_day14'
  | 'preview'

export type SendOutcome = 'sent' | 'suppressed_unsubscribed' | 'no_address' | 'failed'

export interface SendToUserArgs {
  userId: string
  to: string | null | undefined
  id: EmailId
  kind: EmailKind
  subject: string
  /** Must already contain the unsubscribe footer — `wrapper()` puts it there. */
  html: string
}

/**
 * Send one email to one runner, or record honestly why we did not.
 *
 * Returns the outcome rather than a boolean, because "we chose not to send" and
 * "the send failed" are different facts and a caller that cannot tell them apart
 * will stamp a `*_sent_at` column for an email nobody received. That specific
 * bug is what the `suppressed_unsubscribed` outcome exists to prevent.
 */
export async function sendToUser(args: SendToUserArgs): Promise<SendOutcome> {
  const { userId, to, id, kind, subject, html } = args

  // ⚠️ THE OWNER BUILDS ITS OWN CLIENT, exactly as `recordOpsEvent` does, and the
  // caller cannot pass one. Taking it as a parameter was the first cut: typing it
  // structurally produced TS2589 against Supabase's generics, and typing it as
  // `ReturnType<typeof createClient>` rejected the caller's own client. Both are
  // symptoms of the same thing — a consent check whose client the caller chooses
  // is a consent check the caller can get wrong.
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  if (!to) {
    await record(userId, id, kind, 'no_address', subject)
    return 'no_address'
  }

  // ⚠️ READ THE SUPPRESSION STATE, DO NOT TRUST THE CALLER. Every route that has
  // ever filtered its own recipients has eventually filtered them wrongly.
  const { data, error } = await supabase
    .from('user_settings')
    // Both facts in ONE read: whether to send, and the token the List-Unsubscribe
    // header needs. Two queries would be two chances for them to disagree.
    .select('email_unsubscribed_at, email_unsubscribe_token')
    .eq('id', userId)
    .maybeSingle()

  // A read failure is NOT a licence to send. The safe direction when we cannot
  // tell whether someone opted out is silence.
  if (error) {
    await record(userId, id, kind, 'failed', subject, { reason: 'consent_read_failed', message: error.message })
    return 'failed'
  }
  const row = data as { email_unsubscribed_at?: string | null; email_unsubscribe_token?: string } | null
  if (row?.email_unsubscribed_at) {
    await record(userId, id, kind, 'suppressed_unsubscribed', subject)
    return 'suppressed_unsubscribed'
  }

  const ok = await sendEmail({
    to, subject, html,
    ...(row?.email_unsubscribe_token ? { unsubscribeUrl: unsubscribeUrl(row.email_unsubscribe_token) } : {}),
  })
  const outcome: SendOutcome = ok ? 'sent' : 'failed'
  await record(userId, id, kind, outcome, subject)
  return outcome
}

async function record(
  userId: string,
  id: EmailId,
  kind: EmailKind,
  outcome: SendOutcome,
  subject: string,
  extra: Record<string, unknown> = {},
): Promise<void> {
  // The subject is recorded because it is the only thing that distinguishes two
  // sends of the same email after a copy change, and copy is the thing most
  // likely to be revised.
  await recordOpsEvent('email_sent', { id, kind, outcome, subject, ...extra }, userId)
}
