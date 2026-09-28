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
 */
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
  headline: string
}

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
  const at = rows.filter(r => isEntitlementAtRisk(r.kind))
  if (at.length === 0) {
    return {
      alert: false, count: 0, worst: null,
      affectedAccounts: 0, unattributable: 0,
      headline: 'No subscription write has failed — every purchase became an entitlement.',
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
    headline:
      `${at.length} subscription write(s) failed in the last ${AT_RISK_WINDOW_DAYS} days — `
      + `${withUser.size} identified account(s)`
      + (unattributable ? `, ${unattributable} UNATTRIBUTABLE (no user_id — a lost sale we cannot trace)` : '')
      + `. These runners paid and resolveTier still reads them as unentitled.`,
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
