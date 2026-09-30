import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getUserFromRequest } from '@/lib/supabase/getUserFromRequest'
import { recordOpsEvent } from '@/lib/ops/recordOpsEvent'
import { readEntitlement, type RevenueCatSubscriber } from '@/lib/subscriptions/entitlement'
import { NON_EXPIRING_GRANT_YEARS } from '@/lib/subscriptions/revenuecatEvents'

// POST /api/subscriptions/reconcile — CHARITY-OFFER-CODE-01 (2026-09-28).
//
// "This runner may hold an entitlement we never recorded. Check with Apple."
//
// ── WHY IT EXISTS ───────────────────────────────────────────────────────────
// The webhook is the normal path and stays the normal path. It cannot cover the
// journey 500 Make-A-Wish runners are about to take:
//
//   code arrives by email -> redeemed in the App Store -> THEN the app is
//   installed -> THEN an account is created
//
// At redemption there is no Zonna account, so the entitlement attaches to an
// anonymous RevenueCat id. The webhook fires carrying that id, the database
// refuses it (`invalid input syntax for type uuid`), and the alias that would
// re-key it fires `SUBSCRIBER_ALIAS`, which RevenueCat marks deprecated and does
// not send to new projects. TRANSFER now covers the case where RevenueCat does
// send one; this route covers the case where nothing arrives at all.
//
// 🔴 THE CLIENT NEVER ASSERTS ENTITLEMENT, AND THAT IS THE WHOLE SECURITY MODEL.
// The obvious shortcut is to let the app read `customerInfo` locally and post
// "I'm entitled" — which is a free subscription for anyone who can call an
// endpoint. The app only ever says "re-check me". THIS ROUTE asks RevenueCat,
// server side, with a secret the client never holds, and believes only that.
//
// ⚠️ IT REFUSES RATHER THAN GRANTS WHEN IT CANNOT VERIFY. No key, or RevenueCat
// unreachable, returns an error and records it. A reconcile that cannot check
// must never hand out access — and the ops row matters because otherwise a
// misconfiguration is indistinguishable from "nobody redeemed a code".

const RC_API = 'https://api.revenuecat.com/v1/subscribers'

export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req)
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const key = process.env.REVENUECAT_SECRET_API_KEY
  if (!key) {
    await recordOpsEvent('revenuecat_reconcile_unconfigured',
      { detail: 'REVENUECAT_SECRET_API_KEY is not set, so entitlement cannot be verified server-side. Offer-code redemptions made before sign-up will NOT be recognised.' },
      user.id)
    return NextResponse.json(
      { error: 'Entitlement check unavailable' }, { status: 503 },
    )
  }

  // Ask RevenueCat about THIS user id. The app user id is the Supabase user id
  // (`CapacitorBoot` configures it that way), so no mapping is needed.
  let payload: RevenueCatSubscriber | null = null
  try {
    const res = await fetch(`${RC_API}/${encodeURIComponent(user.id)}`, {
      headers: { Authorization: `Bearer ${key}` },
      cache: 'no-store',
    })
    // 404 means RevenueCat has never seen this app user — a real answer, not an
    // error: they simply have no entitlement. Anything else is a failure to
    // check, which must not read as "not entitled".
    if (res.status === 404) {
      await recordOpsEvent('revenuecat_reconcile_none',
        { reason: 'unknown_to_revenuecat' }, user.id)
      return NextResponse.json({ entitled: false, reason: 'unknown to RevenueCat' })
    }
    if (!res.ok) {
      await recordOpsEvent('revenuecat_reconcile_failed',
        { reason: 'revenuecat_http', status: res.status }, user.id)
      return NextResponse.json(
        { error: `RevenueCat returned ${res.status}` }, { status: 502 },
      )
    }
    payload = await res.json()
  } catch (err) {
    await recordOpsEvent('revenuecat_reconcile_failed',
      { reason: 'revenuecat_unreachable', detail: (err as Error).message }, user.id)
    return NextResponse.json(
      { error: `RevenueCat unreachable: ${(err as Error).message}` }, { status: 502 },
    )
  }

  // 🔴 EVERY OUTCOME LEAVES A ROW, AND THE ABSENCE OF ONE USED TO BE AMBIGUOUS.
  //
  // This route previously recorded only success and a missing API key. So when
  // `tester1@test.com` ended up on the free tier holding a real one-year
  // entitlement, `ops_events` was EMPTY for that user and there was no way to tell
  // "reconcile never ran" from "reconcile ran and RevenueCat said no" — which are
  // a client bug and a timing bug respectively, with different fixes.
  //
  // ⚠️ `entitled: false` IS THE COMMON AND CORRECT ANSWER for almost every user,
  // so this row is deliberately cheap and carries no detail beyond the reason. It
  // exists to make the offer-code funnel countable, not to flag a problem.
  const read = readEntitlement(payload)
  if (!read.entitled) {
    await recordOpsEvent('revenuecat_reconcile_none',
      { reason: 'no_active_entitlement' }, user.id)
    return NextResponse.json({ entitled: false })
  }

  // A lifetime grant has no expiry; the subscriptions row needs one, so it takes
  // the same open-ended horizon a comped grant does rather than a 30-day default
  // that would cut a charity runner off mid-block.
  const periodEnd = read.expiresAt
    ?? new Date(Date.now() + NON_EXPIRING_GRANT_YEARS * 365 * 24 * 60 * 60 * 1000).toISOString()

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  // Through the SAME ordering guard the webhooks use, so a reconcile cannot move
  // a subscription backwards past a newer event it raced.
  const { error } = await (supabase.rpc as never as (n: string, a: unknown) => Promise<{ error: { message: string } | null }>)(
    'apply_subscription_event', {
      p_user_id:    user.id,
      p_provider:   'revenuecat',
      p_status:     'active',
      p_period_end: periodEnd,
      p_event_at:   new Date().toISOString(),
      // SUBS-COMPED-WRITER-01 — an offer-code entitlement is not a sale. The flag is
      // STICKY in `apply_subscription_event`, so a later renewal carrying no price
      // cannot silently promote a gifted runner into the conversion numerator.
      p_is_comped:  read.comped.is_comped,
    })

  if (error) {
    await recordOpsEvent('revenuecat_reconcile_failed',
      { reason: 'write_failed', detail: error.message }, user.id)
    return NextResponse.json({ error: 'Could not record entitlement' }, { status: 500 })
  }

  // The success case is recorded deliberately: it is the only evidence the
  // offer-code journey worked for a given runner, and `offer_code` is the cohort
  // key — null means "no cohort", never a default one.
  await recordOpsEvent('revenuecat_reconciled', {
    entitlement: read.entitlementId,
    expires_at: read.expiresAt,
    offer_code: read.offerCode,
    // ⚠️ THE EVIDENCE, NOT JUST THE VERDICT. `is_comped` turns on App Store Connect
    // state this repo cannot read (that the product has no introductory offer), so
    // the raw `period_type` and `price_amount` behind every decision are recorded.
    // Without them a mismarked row is unfalsifiable after the fact.
    ...read.comped,
  }, user.id)

  return NextResponse.json({
    entitled: true,
    expiresAt: read.expiresAt,
    offerCode: read.offerCode,
  })
}
