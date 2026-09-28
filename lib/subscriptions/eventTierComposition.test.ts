import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { toStatus } from './revenuecatEvents'
import { resolveTier } from '../trial'
import { stripeToStatus } from './stripeEvents'

// SUBS-CANCELLATION-TIER-01 (2026-09-28) — THE CHECK THAT WAS MISSING, AND THE
// REASON A LIVE TIER DEFECT SURVIVED EVERY GREEN SUITE.
//
// 🔴 BOTH HALVES WERE CORRECT IN ISOLATION AND THE COMPOSITION WAS WRONG.
// `revenuecatEvents.test.ts` asserted `toStatus('CANCELLATION') === 'cancelled'`
// and passed. `tierResolution.test.ts` asserts `resolveTier` grants paid on
// ['trialing','active'] and passes. Nothing anywhere ran the OUTPUT of the first
// through the second, so nobody ever asked the only question that matters:
// **after this event arrives, does the runner still have access?**
//
// That is `/ship`'s own pre-ship gate item 3 — *"two subsystems compose over the
// same data ... there must be a test of the COMPOSED path"* — and it had no
// mechanical enforcement for this pair.
//
// Measured in production for `tester1@test.com`: a £0 one-year offer code granted
// `zonna_premium` to 2027-09-28, and because the offer has auto-renew OFF,
// RevenueCat emitted INITIAL_PURCHASE **and CANCELLATION in the same second**
// (15:39:49). `apply_subscription_event`'s guard is ordering-only, so the newer
// CANCELLATION won and wrote `cancelled`. All 500 Make-A-Wish runners would have
// dropped to free tier roughly two minutes after redeeming.
//
// ⚠️ THE MODEL OF `null` HERE IS THE IMPORTANT PART. A null mapping means the
// webhook writes NOTHING, so the row that was already there survives. So the
// composed path for a null event is "prior status stands", not "no status" — and
// testing it as `subStatus: null` would assert the opposite of what production
// does and quietly pass.

/** Does this event mean the runner's access has ENDED? */
const EVENTS: ReadonlyArray<{ event: string; endsAccess: boolean; why: string }> = [
  { event: 'INITIAL_PURCHASE',      endsAccess: false, why: 'they just bought it' },
  { event: 'RENEWAL',               endsAccess: false, why: 'renewed' },
  { event: 'UNCANCELLATION',        endsAccess: false, why: 'turned auto-renew back on' },
  { event: 'TRIAL_STARTED',         endsAccess: false, why: 'in trial' },
  { event: 'TRIAL_CONVERTED',       endsAccess: false, why: 'now paying' },
  { event: 'NON_RENEWING_PURCHASE', endsAccess: false, why: 'a comp / dashboard grant' },
  { event: 'SUBSCRIPTION_EXTENDED', endsAccess: false, why: 'end date moved out' },
  { event: 'TRANSFER',              endsAccess: false, why: 'destination user now holds it' },
  { event: 'PRODUCT_CHANGE',        endsAccess: false, why: 'switched plan, still subscribed' },

  // The three that look like an ending and are not.
  { event: 'CANCELLATION',          endsAccess: false, why: 'auto-renew OFF; access runs to expires_date' },
  { event: 'BILLING_ISSUE',         endsAccess: false, why: "Apple's grace period; access continues" },
  { event: 'SUBSCRIPTION_PAUSED',   endsAccess: false, why: 'same shape as a billing issue' },

  // The only one that does.
  { event: 'EXPIRATION',            endsAccess: true,  why: 'the entitlement has lapsed' },
]

const FUTURE = new Date('2027-09-28T15:37:29Z')
const PAST   = new Date('2026-01-01T00:00:00Z')
const NOW    = new Date('2026-09-28T16:00:00Z')

/** The composed path: a row that was active, then this event arrives.
 *  A `null` mapping writes nothing, so the prior status survives. */
const tierAfter = (event: string, periodEnd: Date) =>
  resolveTier({
    subStatus: toStatus(event) ?? 'active',
    subPeriodEnd: periodEnd.toISOString(),
  }, NOW)

describe('SUBS-CANCELLATION-TIER-01 — event -> status -> tier, composed', () => {
  it.each(EVENTS)('$event: access continues = $why', ({ event, endsAccess }) => {
    const { tier, reason } = tierAfter(event, FUTURE)
    if (endsAccess) {
      expect(tier, `${event} must not leave the runner entitled`).toBe('free')
    } else {
      expect(tier, `${event} must not revoke access inside a paid-for period`).toBe('paid')
      expect(reason).toBe('subscription')
    }
  })

  // 📐 The safety claim made in `revenuecatEvents.ts`'s CANCELLATION comment,
  // asserted rather than asserted-in-prose: returning null cannot grant access
  // forever, because `resolveTier` independently requires a future period end.
  // So even if EXPIRATION never arrives, the entitlement self-terminates.
  it('nothing grants access once the period has ended, whatever the status', () => {
    for (const { event } of EVENTS) {
      expect(tierAfter(event, PAST).tier, `${event} past its period end`).toBe('free')
    }
  })

  // ⚠️ POPULATION ARM. Four checks in this repo have read clean while pointed at
  // a hand-written list shorter than the real set. This table IS hand-written, so
  // it is reconciled against the event names in `toStatus`'s own switch: a new
  // `case` there fails this test until someone says whether it ends access.
  // 🔴 THE TWIN, FOUND BY THE SWEEP AND NOT BY A REPORT (exit criterion 3).
  //
  // Stripe's mapping had the identical defect: `past_due` returned 'expired',
  // revoking a real paying customer while Stripe was still RETRYING their card.
  // The argument against it was already written down in `revenuecatEvents.ts`'s
  // BILLING_ISSUE comment and had never been carried across to the other provider.
  //
  // ⚠️ It was also structurally untestable where it lived — a private function in
  // `app/api/webhooks/stripe/route.ts`, and `vitest` collects `lib/**` only. It now
  // lives in `lib/subscriptions/stripeEvents.ts` for that reason.
  it.each([
    ['trialing',           false, 'in trial'],
    ['active',             false, 'paying'],
    ['past_due',           false, 'Stripe is RETRYING the card; access continues'],
    ['canceled',           true,  'subscription has ended'],
    ['unpaid',             true,  'retries exhausted'],
    ['incomplete_expired', true,  'first payment never completed'],
  ] as const)('stripe %s: endsAccess=%s (%s)', (state, endsAccess, _why) => {
    const { tier } = resolveTier({
      subStatus: stripeToStatus(state as Parameters<typeof stripeToStatus>[0]) ?? 'active',
      subPeriodEnd: FUTURE.toISOString(),
    }, NOW)
    expect(tier).toBe(endsAccess ? 'free' : 'paid')
  })

  it('every event `toStatus` handles is declared here', () => {
    const src = readFileSync('lib/subscriptions/revenuecatEvents.ts', 'utf8')
    const body = src.slice(src.indexOf('export function toStatus'))
    const cases = Array.from(body.matchAll(/case '([A-Z_]+)':/g), m => m[1])
    expect(cases.length, 'no case labels parsed — the regex has drifted').toBeGreaterThan(8)
    const declared = new Set(EVENTS.map(e => e.event))
    const undeclared = cases.filter(c => !declared.has(c))
    expect(undeclared, 'new event in toStatus: declare whether it ends access').toEqual([])
  })
})
