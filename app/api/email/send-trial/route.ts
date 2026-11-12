import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { secretMatches } from '@/lib/security/secrets'
import { sendToUser } from '@/lib/email/sendToUser'
import { buildDay11Email, buildDay14Email, buildDay17Email, buildDay30Email, type RunSummary } from '@/lib/email/trialEmailTemplates'
import { countRunsRead, latestRunRead, trialWindow } from '@/lib/ops/runRead'
import { decideTrialEmails, localHourIn } from '@/lib/email/trialEmailWindow'
import { resolveTier, resolveTrialWindow, trialDayOfWindow, TRIAL_STARTS_AT_FIRST_READ, TRIAL_DAYS } from '@/lib/trial'

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

/**
 * ACT-READ-COUNT-01 — the trial read summary, counted by the owner and SCOPED TO THE TRIAL.
 *
 * 🔴 TWO DEFECTS CLOSED HERE, NEITHER OF THEM THE ONE THAT WAS REPORTED. The brief said a runner
 * who had completed 14 sessions was told *"1 run read"*. Measured: at day 14 he had **1 completion
 * and 1 read**; the 15 of each arrived afterwards and the email was right. What was actually wrong:
 *
 * 1. `.limit(10)` followed by `rows.length` — **a hard ceiling of ten presented as a total**, in
 *    the mail that asks the runner to pay for reads. `countRunsRead` does an exact HEAD count, so
 *    there is no limit to forget.
 * 2. The query had **no trial window** while the copy it feeds says *"Fourteen days, N runs read"*
 *    and *"N sessions across your trial"*. It counted the runner's whole history. The window is
 *    now passed explicitly, from the same `TRIAL_DAYS` the tier resolver uses.
 *
 * ⚠️ A read FAILURE is not a zero. `countRunsRead` throws rather than returning 0, because 0 renders
 * as "no runs read" — a sentence about the runner — where an error is a sentence about us.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function getRunSummary(supabase: any, userId: string, trialStartedAt: string | null): Promise<RunSummary> {
  const window = trialWindow(trialStartedAt, TRIAL_DAYS) ?? undefined
  const [analysedRunCount, latest] = await Promise.all([
    countRunsRead(supabase, userId, window),
    latestRunRead(supabase, userId, window),
  ])

  return {
    actualLoadKm: latest?.actual_load_km ?? null,
    hrInZonePct: latest?.hr_in_zone_pct ?? null,
    hrAboveCeilingPct: latest?.hr_above_ceiling_pct ?? null,
    verdict: latest?.verdict ?? null,
    analysedRunCount,
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
    .select('id, is_admin, is_internal, timezone, trial_extended_at, trial_started_at, trial_email_day11_sent_at, trial_email_day14_sent_at, trial_email_day17_sent_at, trial_email_day30_sent_at, email_unsubscribed_at, email_unsubscribe_token')
    .not('trial_started_at', 'is', null)

  if (error) {
    console.error('[email/send-trial] user_settings read failed:', error.message)
    return NextResponse.json({ error: 'Read failed' }, { status: 500 })
  }

  // ── Who must NOT be told their trial is ending ──────────────────────────
  //
  // This route used to send on `trial_started_at` alone, so a charity runner
  // holding a 90-day grant got "3 days left." on day 11 and "Trial ends today"
  // on day 14, and someone who subscribed mid-trial got the same. The rule
  // lives in `decideTrialEmails`; this just supplies the facts.
  //
  // TWO BULK READS, deliberately not `getUserTier` per user. That would be
  // three queries per runner per night (N+1), and the cron already walks every
  // trialling account. Two set-shaped reads answer it for everyone at once.
  const [{ data: subRows }, { data: grantRows }] = await Promise.all([
    supabase.from('subscriptions').select('user_id, status, current_period_end'),
    supabase.from('charity_codes').select('claimed_by, expires_at').not('claimed_by', 'is', null),
  ])

  const subByUser = new Map((subRows ?? []).map(r => [r.user_id, r]))
  // Keyed on the ROW, not on liveness: a lapsed grant still means this runner
  // never had a trial story, so they never get trial copy.
  const grantByUser = new Map((grantRows ?? []).map(r => [r.claimed_by, r]))

  const now = new Date()

  /**
   * ACT-TRIAL-AT-FIRST-READ-01 — each candidate's EARLIEST run read, superseded rows included.
   *
   * ⚠️ ONE QUERY FOR THE WHOLE BATCH, not one per runner inside the loop. This is a cron over
   * every trialist, so a per-user read would be N serialised round trips for a value most of
   * them share the absence of.
   *
   * ⚠️ AND ONLY WHILE THE FLAG IS ON. `resolveTrialWindow` ignores the read on the signup path,
   * so fetching it today would be a query bought for a policy that discards it — the same rule
   * `getUserTier` follows.
   *
   * ⚠️ UNFILTERED BY `superseded_at`, deliberately, and it is the opposite of what
   * `lib/ops/runRead.ts` wants. The question is *"has this runner ever been shown what the
   * product does"*, which cannot un-happen; filtering would lose a first read to a race change
   * and bring an already-expired trial back. Argued into `supersedeCoverage`'s allowlist.
   */
  const firstReadByUser = new Map<string, string>()
  let firstReadFailed = false
  if (TRIAL_STARTS_AT_FIRST_READ) {
    const ids = (allSettings ?? []).map(s => s.id)
    if (ids.length > 0) {
      const { data: reads, error: readErr } = await supabase
        .from('run_analysis')
        .select('user_id, created_at')
        .in('user_id', ids)
        .order('created_at', { ascending: true })
      // 🔴 A FAILED READ IS NOT "NO READ". Treated as absence it would start every runner's
      // clock at the cap and silence the day-11 and day-14 emails for all of them, on our
      // outage. `firstReadUnavailable` is the honest input and the owner knows what to do
      // with it.
      if (readErr) {
        console.error('[email/send-trial] first-read query failed', readErr.message)
        firstReadFailed = true
      } else {
        for (const r of reads ?? []) {
          if (!firstReadByUser.has(r.user_id)) firstReadByUser.set(r.user_id, r.created_at)
        }
      }
    }
  }

  let day11Sent = 0
  let day14Sent = 0
  let day17Sent = 0
  let day30Sent = 0
  let skipped = 0
  const errors: string[] = []

  for (const settings of allSettings ?? []) {
    try {
      const sub = subByUser.get(settings.id)
      const grant = grantByUser.get(settings.id)
      // The same facts every other `resolveTier` caller hands over (TIER-OWNER-01): one owner
      // is only an owner if its callers agree on the inputs.
      const trialInputs = {
        trialStartedAt: settings.trial_started_at,
        trialExtendedAt: settings.trial_extended_at,
        firstReadAt: firstReadByUser.get(settings.id) ?? null,
        firstReadUnavailable: firstReadFailed,
      }
      // 🔴 THE DAY COMES FROM THE WINDOW, NEVER FROM THE SIGNUP STAMP. See `trialDayOfWindow`:
      // "3 days left" is a question about the END, and under the flag the stamp is no longer
      // the start. Identical to the old arithmetic, to the millisecond, while the flag is off.
      const day = trialDayOfWindow(resolveTrialWindow(trialInputs, now), now)
      if (day === null) { skipped++; continue }
      const { tier } = resolveTier({
        isAdmin: settings.is_admin,
        subStatus: sub?.status,
        subPeriodEnd: sub?.current_period_end,
        grantExpiresAt: grant?.expires_at,
        // Named, not spread: the interlock's sweep cannot see a spread, and more to the point
        // neither can a reader deciding whether this caller agrees with the other three.
        trialStartedAt: trialInputs.trialStartedAt,
        trialExtendedAt: trialInputs.trialExtendedAt,
        firstReadAt: trialInputs.firstReadAt,
        firstReadUnavailable: trialInputs.firstReadUnavailable,
      }, now)

      const { needsDay11, needsDay14, needsDay17, needsDay30 } = decideTrialEmails(day, settings, {
        tier,
        hasCharityGrant: !!grant,
        // INTERNAL-ACCOUNTS-01 — 18 of 56 accounts are internal, a third of this list.
        isInternal: !!settings.is_internal,
        // A lapsed subscriber resolves `free`, so without this the day-30 email asks someone
        // who DID subscribe what stopped them subscribing. Same class as `hasCharityGrant`.
        hasEverSubscribed: !!sub,
        // ACT-EMAIL-POSTTRIAL-01 — a civil hour in THEIR day, not ours. The cron is hourly for
        // exactly this reason; on a daily run this would be permanent suppression, not a wait.
        localHour: localHourIn(settings.timezone, now),
      })

      if (!needsDay11 && !needsDay14 && !needsDay17 && !needsDay30) { skipped++; continue }

      // Get user email via admin API (service role only)
      const { data: { user }, error: userErr } = await supabase.auth.admin.getUserById(settings.id)
      if (userErr || !user?.email) { skipped++; continue }

      const email = user.email
      const firstName = (user.user_metadata?.full_name as string | undefined)?.split(' ')[0] ?? null

      // ⚠️ THE POST-TRIAL EMAILS COUNT A WIDER WINDOW THAN THE TRIAL ONES, and the first cut
      // did not. `getRunSummary` scopes to the 14 days from the stamp, which is right for
      // "Fourteen days, N runs read" and wrong three days later: a runner who took the
      // extension and ran on day 15 would have been told "we still have not read a run".
      // For day 17 and day 30 the honest window is the whole time we have known them.
      const run = (needsDay17 || needsDay30)
        ? await getRunSummary(supabase, settings.id, null)
        : await getRunSummary(supabase, settings.id, settings.trial_started_at)

      if (needsDay11) {
        const { subject, html } = buildDay11Email(firstName, run, settings.email_unsubscribe_token)
        // EMAIL-WAVE-0 — `sendToUser` owns suppression and the record. It returns
        // an OUTCOME, not a boolean, so a suppressed send cannot stamp the column:
        // that would silently skip the runner forever the day they resubscribe.
        const outcome = await sendToUser({
          userId: settings.id, to: email,
          id: 'trial_day11', kind: 'transactional', subject, html,
        })
        if (outcome === 'sent') {
          day11Sent++
          await supabase
            .from('user_settings')
            .update({ trial_email_day11_sent_at: now.toISOString() })
            .eq('id', settings.id)
        }
      }

      if (needsDay14) {
        const { subject, html } = buildDay14Email(firstName, run, settings.email_unsubscribe_token)
        const outcome = await sendToUser({
          userId: settings.id, to: email,
          id: 'trial_day14', kind: 'transactional', subject, html,
        })
        if (outcome === 'sent') {
          day14Sent++
          await supabase
            .from('user_settings')
            .update({ trial_email_day14_sent_at: now.toISOString() })
            .eq('id', settings.id)
        }
      }

      // ACT-EMAIL-POSTTRIAL-01 — the two sends that did not exist. Same shape as the two above:
      // `sendToUser` owns suppression and the record, and only a real send stamps the column.
      if (needsDay17) {
        const { subject, html } = buildDay17Email(
          firstName, run, settings.email_unsubscribe_token, !!settings.trial_extended_at)
        const outcome = await sendToUser({
          userId: settings.id, to: email,
          id: 'trial_day17', kind: 'transactional', subject, html,
        })
        if (outcome === 'sent') {
          day17Sent++
          await supabase
            .from('user_settings')
            .update({ trial_email_day17_sent_at: now.toISOString() })
            .eq('id', settings.id)
        }
      }

      if (needsDay30) {
        const { subject, html } = buildDay30Email(firstName, settings.email_unsubscribe_token)
        const outcome = await sendToUser({
          userId: settings.id, to: email,
          id: 'trial_day30', kind: 'transactional', subject, html,
        })
        if (outcome === 'sent') {
          day30Sent++
          await supabase
            .from('user_settings')
            .update({ trial_email_day30_sent_at: now.toISOString() })
            .eq('id', settings.id)
        }
      }
    } catch (err: any) {
      errors.push(`${settings.id}: ${err.message}`)
    }
  }

  console.log(`[email/send-trial] day11=${day11Sent}, day14=${day14Sent}, day17=${day17Sent}, day30=${day30Sent}, skipped=${skipped}, errors=${errors.length}`)
  return NextResponse.json({ day11Sent, day14Sent, day17Sent, day30Sent, skipped, errors: errors.slice(0, 5) })
}
