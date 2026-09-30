// OPS-SUBS-TRACE-01 (2026-09-28) — what the subscription webhooks record, decided once.
//
// ── THE DEFECT ───────────────────────────────────────────────────────────────
// Neither subscription webhook left a durable trace of a SUCCESSFUL delivery, and
// neither recorded a FAILED write. Measured in production 2026-09-28: `ops_events`
// held 435 rows across 13 kinds and NOT ONE came from either webhook, while
// `subscriptions` held exactly one row — a hand-seeded `stripe` row for the founder
// with `last_event_at = NULL`. So no RevenueCat event has ever produced a row, and
// the only evidence either route works would be a row appearing.
//
// That matters because of what is downstream: `resolveTier` reads `subscriptions`
// for every tier decision in the app, and `v_trial_conversion` is what the
// 1 January trial-to-paid gate reads. A first real purchase that failed at the RPC
// would return 500 to the provider and leave NOTHING here to find it by.
//
// ⚠️ ABSENCE OF OPS EVENTS DID NOT PROVE THE WEBHOOKS NEVER FIRED, and that is
// precisely the problem being fixed: the only two kinds either route could emit
// (`revenuecat_event_unhandled`, `revenuecat_event_no_timestamp`) are both failure
// branches, so a healthy webhook and an unreachable one looked identical.
//
// ── WHY BOTH PROVIDERS SHARE THIS OWNER ──────────────────────────────────────
// The Stripe route had the identical gap plus two of its own: a subscription with
// no `user_id` metadata and one with no `current_period_end` were each rejected
// with a bare `console.error`, which is a real payment dropped with no durable
// record. Instrumenting only RevenueCat would be TWIN-SWEEP-01 exactly — a remedy
// applied to one twin reads as finished, so nobody looks at the other. One owner
// means the two routes cannot drift apart later either.
//
// ── WHY IT IS PURE AND LIVES HERE ────────────────────────────────────────────
// Same reason as `toStatus` and `eventAtIso` next door: `vitest.config.ts` sets
// `include: ['lib/**/*.test.ts', 'components/**/*.test.ts']`, so a test written
// beside either route would never have run. This module decides WHAT to record;
// the routes only hand the result to `recordOpsEvent`. It performs no I/O.

import type { OpsEventKind } from '@/lib/ops/recordOpsEvent'
import type { SubscriptionStatus } from '@/lib/subscriptions/revenuecatEvents'

export type SubscriptionProvider = 'revenuecat' | 'stripe'

/**
 * The providers, enumerable at runtime.
 *
 * ⚠️ EXPORTED SO A THIRD PROVIDER CANNOT BE ADDED SILENTLY. A TYPE UNION CANNOT BE
 * ITERATED, so a test written against the type would keep passing while a new
 * provider's failure kinds went unclassified — and `subscriptionHealth.ts`'s
 * `ENTITLEMENT_AT_RISK_KINDS` is what decides whether a paid-but-unentitled runner
 * is ever surfaced. `subscriptionHealth.test.ts` walks THIS array, so adding a
 * provider here fails the build until its `_write_failed` and `_unusable` kinds are
 * classified as money-critical. Add the provider to this array in the same edit as
 * the `KINDS` map below.
 */
export const SUBSCRIPTION_PROVIDERS: readonly SubscriptionProvider[] = ['revenuecat', 'stripe']

/** What happened in the route. One variant per branch that must leave a trace. */
export type WebhookOutcome =
  /** The RPC ran. `applied` is the ordering guard's verdict: false = a stale or
   *  out-of-order delivery was correctly suppressed. Recorded either way — a
   *  guard nobody can see firing is one nobody trusts. */
  | { result: 'received'; eventType: string; status: SubscriptionStatus; applied: boolean }
  /** `apply_subscription_event` errored. The provider gets a 500 and will retry. */
  | { result: 'write_failed'; eventType: string; status: SubscriptionStatus; message: string }
  /** No status mapping for this event type. Doing nothing stays CORRECT — guessing
   *  a status would mis-tier a real customer — but it must be visible. */
  | { result: 'unhandled'; eventType: string }
  /** A mapped event we cannot act on: a required field is absent. This is a real
   *  payment being dropped, which is why it is not folded into `unhandled`. */
  | { result: 'unusable'; eventType: string; missing: string }

export interface WebhookTrace {
  kind: OpsEventKind
  detail: Record<string, unknown>
}

const KINDS: Record<SubscriptionProvider, Record<WebhookOutcome['result'], OpsEventKind>> = {
  revenuecat: {
    received:     'revenuecat_event_received',
    write_failed: 'revenuecat_event_write_failed',
    unhandled:    'revenuecat_event_unhandled',
    unusable:     'revenuecat_event_unusable',
  },
  stripe: {
    received:     'stripe_event_received',
    write_failed: 'stripe_event_write_failed',
    unhandled:    'stripe_event_unhandled',
    unusable:     'stripe_event_unusable',
  },
}

/**
 * Which of Apple's / Stripe's two worlds this delivery came from.
 *
 * ⚠️ RECORDED BECAUSE THE DIGEST CANNOT OTHERWISE TELL A TEST FROM A CUSTOMER.
 * `OPS-SUBS-ALERT-01` ranks a failed subscription write above everything else it
 * prints, and it was right to — but every row it had to judge on 2026-09-28 was a
 * founder sandbox redemption, indistinguishable from a lost sale because nothing
 * recorded which world it came from. The providers both say; we simply never asked.
 */
export type WebhookEnvironment = 'sandbox' | 'production'

/**
 * One vocabulary from two provider spellings.
 *
 * ⚠️ STRINGS ONLY, DELIBERATELY. RevenueCat sends `environment: 'SANDBOX' |
 * 'PRODUCTION'`; Stripe carries a `livemode` BOOLEAN whose polarity is the
 * opposite way round from RevenueCat's `is_sandbox` boolean. Accepting booleans
 * here would mean one call site silently inverting the other — the `?? 0` class
 * this repo keeps recording. Each route converts its own boolean at the call site,
 * where the polarity is visible beside the field name.
 *
 * An unrecognised value returns `null`, never a default: "we do not know which
 * world this was" and "this was production" must not collapse into one answer.
 */
export function normaliseEnvironment(raw: unknown): WebhookEnvironment | null {
  if (typeof raw !== 'string') return null
  const v = raw.trim().toLowerCase()
  return v === 'sandbox' || v === 'production' ? v : null
}

/**
 * The ops kind and detail for one webhook outcome.
 *
 * ⚠️ BEHAVIOURAL ONLY, NO PII AND NO PAYLOAD. The event type, the mapped status,
 * the guard's verdict and a truncated error string. Never an email, never a name,
 * never the raw body — these rows are read from a dashboard and `ops_events` is
 * the one user-scoped table that deliberately survives account deletion
 * (anonymised via ON DELETE SET NULL), so anything put here outlives the account.
 */
export function webhookTrace(
  provider: SubscriptionProvider,
  outcome: WebhookOutcome,
  environment?: unknown,
): WebhookTrace {
  const kind = KINDS[provider][outcome.result]
  const detail: Record<string, unknown> = { provider, event_type: outcome.eventType }
  // Omitted rather than recorded as null when unknown: a row with no `environment`
  // predates this field, and that is a different fact from "we asked and could not tell".
  const env = normaliseEnvironment(environment)
  if (env) detail.environment = env

  switch (outcome.result) {
    case 'received':
      // `applied: false` is not an error. It is the SUBS-ORDERING-REVENUECAT-01
      // guard doing its job on a replayed or out-of-order delivery.
      detail.status = outcome.status
      detail.applied = outcome.applied
      break
    case 'write_failed':
      detail.status = outcome.status
      detail.message = truncate(outcome.message)
      break
    case 'unusable':
      detail.missing = outcome.missing
      break
    case 'unhandled':
      break
  }
  return { kind, detail }
}

/** Provider error strings can carry a whole payload. Cap them: this row is
 *  telemetry, not a log sink, and an unbounded string here is how PII arrives
 *  somewhere it was never meant to be. */
function truncate(s: string, max = 300): string {
  return s.length <= max ? s : `${s.slice(0, max)}…`
}
