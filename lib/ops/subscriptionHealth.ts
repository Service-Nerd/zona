// OPS-SUBS-ALERT-01 (2026-09-28) — which ops events mean SOMEBODY PAID AND DID NOT
// GET WHAT THEY PAID FOR.
//
// ── WHY THIS IS A NAMED LIST AND NOT A QUERY IN A PROMPT ─────────────────────
// `OPS-SUBS-TRACE-01` made a failed subscription write queryable. The kinds it
// added only ever fire in one situation: a runner completed a purchase and the
// entitlement did not land in `subscriptions`. `resolveTier` reads that table for
// every tier decision, so that person keeps meeting the paywall they have just
// bought their way past — the GTM-CHARITY-03 symptom with money attached.
//
// ⚠️ IT IS ALSO THE ONE FAILURE THE FOUNDER CANNOT FIND BY USING THE APP. His own
// `subscriptions` row is hand-seeded and `is_admin` resolves him `paid` regardless
// of what either webhook does.
//
// ── WHAT I GOT WRONG WHEN I FILED THIS ──────────────────────────────────────
// The item said "nothing alerts on these rows". That was WRONG and the design
// changed because of it. The daily digest's Q4 is a GENERIC 24-hour feed over
// `ops_events` with no kind filter, so these rows were already reaching it. The
// real defect is narrower:
//
//   1. they land under "engine health: constitutional findings" — the wrong
//      heading for a billing failure;
//   2. Q4's columns are engine-shaped (`source`, `codes`, `reverted_weeks`), so
//      every field the trace records (`provider`, `event_type`, `status`,
//      `message`, `missing`) renders as `-`. THE KIND APPEARS, THE DIAGNOSIS
//      DOES NOT;
//   3. the window is 24 hours, so a Saturday failure is invisible by Monday.
//
// So this ships no probe and no cron. The rows already exist; a probe would only
// re-read them. What was missing is a NAME for the set and a query that looks for
// it properly — and the name belongs in versioned, tested code rather than in a
// prose prompt nothing can check.

import type { OpsEventKind } from '@/lib/ops/recordOpsEvent'

/**
 * The kinds that mean a purchase did not become an entitlement.
 *
 * ⚠️ ORDER IS SEVERITY, not alphabet. `_unusable` is first because it is the one
 * that loses data: a Stripe subscription arriving with no `metadata.user_id` or no
 * `current_period_end` is rejected with a 400, and Stripe retries a 400 only
 * briefly — so there may be no second chance. A `_write_failed` returns 500, which
 * the provider retries properly, so it is recoverable on its own.
 *
 * 🔴 THAT REASONING IS ABOUT STRIPE AND DOES NOT TRANSFER WHOLESALE. RevenueCat's
 * `_unusable` covers one branch that answers **200 by design** and self-heals — the
 * pre-signup offer-code redemption. It is excluded at the ROW level by
 * `isPreSignupRedemption`, not by removing the kind here: a `revenuecat_event_unusable`
 * carrying any other `missing` value is still a real dropped payment, and the kind
 * must stay listed so the completeness test below keeps covering it.
 */
/**
 * Kinds the digest must COUNT and REPORT but never ALERT on.
 *
 * ── WHY, AND IT IS A HOLE IN AN ABSENCE ARGUMENT (OPS-SUBS-UNHANDLED-SEEN-01) ──
 * `revenuecat_event_unhandled` is recorded when the webhook arrives and
 * `toStatus()` returns null — i.e. an event type we deliberately do not map.
 * `CANCELLATION` is exactly that: `SUBS-CANCELLATION-TIER-01` ruled it means
 * "auto-renew switched off", NOT "access ended", so NOT acting on it is correct
 * and alerting on it would be noise (NOISE-GATE-01).
 *
 * 🔴 BUT THE DIGEST'S Q9 SELECTS ONLY `ENTITLEMENT_AT_RISK_KINDS`, SO IT CANNOT SEE
 * THEM AT ALL — and on 2026-10-09 that produced a confident wrong answer: asked
 * whether RevenueCat cancellations were arriving, the honest read of the digest was
 * "no rows, so no events". Measured directly: **3 `revenuecat_event_unhandled` and
 * 17 `revenuecat_event_unusable` in 14 days.** They were arriving the whole time.
 *
 * `webhookTrace.ts`'s own header states the principle this restores: *"ABSENCE OF
 * OPS EVENTS DID NOT PROVE THE WEBHOOKS NEVER FIRED ... a healthy webhook and an
 * unreachable one looked identical."*
 *
 * ⚠️ SAME TREATMENT AS `preSignupRedemptions`, which is the ratified pattern one
 * screen away: counted, reported, never alerted on. A kind is either money-critical
 * or it is observable; silent is not one of the options.
 */
export const ENTITLEMENT_OBSERVED_KINDS: readonly OpsEventKind[] = [
  'revenuecat_event_unhandled',
  'stripe_event_unhandled',
]

export const ENTITLEMENT_AT_RISK_KINDS: readonly OpsEventKind[] = [
  'stripe_event_unusable',
  'revenuecat_event_unusable',
  'stripe_event_write_failed',
  'revenuecat_event_write_failed',
]

/**
 * How far back the digest should look.
 *
 * ⚠️ NOT 24 HOURS, deliberately, and this is the single most important number
 * here. Q4's 24-hour window means a failure on Saturday morning is gone from the
 * digest by Monday — and nobody reads a Sunday digest closely. Seven days is long
 * enough that no single unwatched weekend can hide a lost sale, and short enough
 * that the section is empty in the normal case, which is what keeps it readable
 * (NOISE-GATE-01: a section that always has rows is a section nobody reads).
 */
export const AT_RISK_WINDOW_DAYS = 7

/** One `ops_events` row, as the digest selects it. */
export interface AtRiskRow {
  kind: string
  created_at: string
  user_id?: string | null
  detail?: Record<string, unknown> | null
}

export interface AtRiskVerdict {
  /** Should the digest print a money-critical section at all? */
  alert: boolean
  count: number
  /** The worst kind present, by the severity order of the list above. */
  worst: OpsEventKind | null
  /** Distinct accounts affected. `null` user_id (a Stripe event with no
   *  `metadata.user_id`) counts as one UNKNOWN — it is a lost sale we cannot
   *  even attribute, which is worse than an attributable one, not better. */
  affectedAccounts: number
  unattributable: number
  /** Pre-signup offer-code redemptions seen in the window. Counted, never alerted
   *  on — see `isPreSignupRedemption`. Reported so the path stays VISIBLE while it
   *  stops being read as a lost sale. */
  preSignupRedemptions: number
  /** Events the provider sent that we deliberately do not act on. Counted so
   *  "no rows" can never again be read as "no events". Never raises `alert`. */
  observedNotActioned: number
  headline: string
}

/**
 * The `missing` value the RevenueCat route records for an anonymous `app_user_id`.
 */
export const PRE_SIGNUP_MISSING = 'app_user_id_not_a_user'

/**
 * A redemption that happened BEFORE the runner had a Zonna account — expected, and
 * NOT a lost sale.
 *
 * 🔴 WHY THIS CARVE-OUT EXISTS, BECAUSE A KIND-ONLY RULE GOT IT WRONG ON ITS FIRST
 * REAL DATA. `OPS-SUBS-ALERT-01` classified every `revenuecat_event_unusable` as
 * money-critical and ranked it top severity, reasoning that an `_unusable` row was
 * "rejected with a 400 and providers retry a 400 only briefly". That sentence is
 * true of STRIPE and false of this branch: `CHARITY-OFFER-CODE-01` makes the route
 * answer **200 on purpose**, because an anonymous id never becomes valid on its own
 * and there is nothing to retry. The transaction re-arrives correctly keyed the
 * moment `logIn` aliases it (`TRANSFER`), and `POST /api/subscriptions/reconcile`
 * closes it even if that never comes.
 *
 * ⚠️ AND IT IS THE DESIGNED JOURNEY, NOT AN EDGE CASE. The 500 Make-A-Wish runners
 * are told to redeem by email, THEN install, THEN create an account — so every one
 * of them produces a row here. The offer is also deliberately created with
 * auto-renew OFF so nobody is charged mid-taper, which makes RevenueCat emit a
 * CANCELLATION about two minutes after EVERY redemption: a second row each. Left in
 * the alert, the campaign's launch day would print ~1,000 red "this runner paid and
 * is locked out" lines, on the one section whose value is that it is normally empty
 * (NOISE-GATE-01).
 *
 * ⚠️ COUNTED, NOT DISCARDED. If reconcile genuinely fails the runner IS unentitled —
 * but the evidence for that is an absent `subscriptions` row, not this event, and a
 * pure function over `ops_events` cannot see one. So these are reported on their own
 * line with an instruction to confirm, which is a different claim from silence.
 *
 * ⚠️ NARROW BY CONSTRUCTION. Only this one `missing` value on this one kind. A
 * `revenuecat_event_unusable` carrying any other `missing` is still a real defect and
 * still alerts, which is what keeps `ENTITLEMENT_AT_RISK_KINDS` complete at the KIND
 * level and this carve-out honest at the ROW level.
 */
export function isPreSignupRedemption(row: AtRiskRow): boolean {
  return row.kind === 'revenuecat_event_unusable'
    && (row.detail?.missing ?? null) === PRE_SIGNUP_MISSING
}

/** What to actually do about a pre-signup redemption row. */
export const PRE_SIGNUP_REMEDY =
  'Expected: an offer code redeemed before the account existed. Confirm a subscriptions '
  + 'row now exists for that runner (TRANSFER re-keys it, or /api/subscriptions/reconcile '
  + 'closes it). Escalate ONLY if the row is still absent — the event alone is not a failure.'

/** Is this a kind that means somebody paid and did not get access? */
export function isEntitlementAtRisk(kind: string): boolean {
  return (ENTITLEMENT_AT_RISK_KINDS as readonly string[]).includes(kind)
}

/**
 * The verdict the digest prints.
 *
 * Pure, so the DEFINITION of "money-critical" is unit-tested rather than living
 * in a scheduled prompt where nothing can check it. The digest supplies the rows.
 */
export function judgeEntitlementRisk(rows: readonly AtRiskRow[]): AtRiskVerdict {
  const flagged = rows.filter(r => isEntitlementAtRisk(r.kind))
  const preSignupRedemptions = flagged.filter(isPreSignupRedemption).length
  const at = flagged.filter(r => !isPreSignupRedemption(r))
  // Counted from the SAME rows, so a caller cannot select one set and forget the
  // other — the hole this closes was exactly a query that selected only the first.
  const observedNotActioned = rows.filter(r =>
    (ENTITLEMENT_OBSERVED_KINDS as readonly string[]).includes(r.kind)).length

  const observedNote = observedNotActioned
    ? ` ${observedNotActioned} provider event(s) arrived that we deliberately do not act on`
      + ' (e.g. CANCELLATION = auto-renew off, not access ended). Reported so absence of'
      + ' rows is never read as absence of events.'
    : ''

  const preSignupNote = preSignupRedemptions
    ? ` Separately, ${preSignupRedemptions} pre-signup offer-code redemption(s) were recorded:`
      + ' expected on the redeem-then-install journey, not lost sales. Confirm the entitlement landed.'
    : ''

  if (at.length === 0) {
    return {
      alert: false, count: 0, worst: null,
      affectedAccounts: 0, unattributable: 0, preSignupRedemptions, observedNotActioned,
      headline: 'No subscription write has failed — every purchase became an entitlement.'
        + preSignupNote + observedNote,
    }
  }

  const worst = ENTITLEMENT_AT_RISK_KINDS.find(k => at.some(r => r.kind === k)) ?? null
  const withUser = new Set(at.map(r => r.user_id).filter((u): u is string => !!u))
  const unattributable = at.filter(r => !r.user_id).length

  return {
    alert: true,
    count: at.length,
    worst,
    affectedAccounts: withUser.size,
    unattributable,
    preSignupRedemptions,
    observedNotActioned,
    headline:
      `${at.length} subscription write(s) failed in the last ${AT_RISK_WINDOW_DAYS} days — `
      + `${withUser.size} identified account(s)`
      + (unattributable ? `, ${unattributable} UNATTRIBUTABLE (no user_id — a lost sale we cannot trace)` : '')
      + `. These runners paid and resolveTier still reads them as unentitled.`
      + preSignupNote + observedNote,
  }
}

/**
 * The remedy line, per kind. Written here rather than in the digest prompt so the
 * instruction and the detection cannot drift apart.
 */
export function remedyFor(kind: OpsEventKind): string {
  switch (kind) {
    case 'stripe_event_unusable':
      return 'Stripe sent a subscription with no metadata.user_id or no current_period_end. Stripe retries a 400 only briefly, so check the Stripe dashboard for that subscription and repair the entitlement by hand — this one may have no second chance.'
    case 'revenuecat_event_unusable':
      return 'RevenueCat sent an event mapped to a status but missing a field needed to apply it. Check the RevenueCat customer, then repair the subscriptions row.'
    case 'stripe_event_write_failed':
    case 'revenuecat_event_write_failed':
      return 'apply_subscription_event errored, so the route returned 500 and the provider WILL retry. If the row is still absent after an hour the retry is also failing — read detail.message.'
    default:
      return 'Not an entitlement-risk kind.'
  }
}
