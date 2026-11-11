import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

/**
 * ACT-RC-ANON-LINK-01 — making an offer-code ORPHAN countable.
 *
 * 🔴 THE ITEM'S PREMISE AS FILED WAS WRONG, AND THE MEASUREMENT IS WHAT CORRECTED IT. It said
 * "20 anonymous RevenueCat purchases never reached Supabase" and that "the TRANSFER event, the
 * anonymous→identified alias signal, is itself unhandled". Neither holds:
 *
 * · `toStatus('TRANSFER')` returns `'active'` and `revenuecatEvents.ts` carries a long note on
 *   why — it is the event that re-keys a purchase made before the runner had an account.
 * · The webhook DECLINING an anonymous id is deliberate, documented and answers 200 on purpose:
 *   `$RCAnonymousID:…` is not a uuid, every retry would fail identically, and
 *   `POST /api/subscriptions/reconcile` is the path that closes it server-side.
 * · 📐 Measured 2026-11-11: **20** anonymous `INITIAL_PURCHASE` events declined, **21 users
 *   reconciled** across 27 events, **24 subscriptions, all comped**. The mechanism works.
 *
 * ⚠️ WHAT WAS ACTUALLY MISSING IS THE BRIEF'S OWN METRIC: "offer-code redemptions linked to an
 * account — 0 orphans" was NOT COMPUTABLE. The webhook stores a 24-character prefix of the
 * anonymous id; the reconcile stored nothing about it. So "redeemed and never signed in" and
 * "signed in and the link failed" were indistinguishable — and only the second is a defect.
 */
const ROUTE = readFileSync('app/api/subscriptions/reconcile/route.ts', 'utf8')
const IFACE = readFileSync('lib/subscriptions/entitlement.ts', 'utf8')
const EVENTS = readFileSync('lib/subscriptions/revenuecatEvents.ts', 'utf8')
// 🔴 LINE COMMENTS FIRST, THEN BLOCK COMMENTS, AND THE ORDER IS NOT COSMETIC.
// `revenuecatEvents.ts` line 5 contains the glob `lib` + a double star inside a `//` comment,
// which reads as a block-comment OPENER. Stripping block comments first runs from there to the
// next closer 107 lines later and swallows the entire `toStatus` switch, so an arm asserting
// `case 'TRANSFER'` failed against a file that contains it. Same class as HOOK-RGBA-COMMENTS-01:
// a pattern matched inside a comment.
// ⚠️ AND THIS NOTE HAD TO BE WRITTEN WITH `//`, because spelling the two delimiters inside a
// block comment CLOSES IT EARLY — the explanation of the trap tripped the trap.
const strip = (s: string) => s.replace(/\/\/[^\n]*/g, ' ').replace(/\/\*[\s\S]*?\*\//g, ' ')

describe('ACT-RC-ANON-LINK-01 — the orphan join', () => {
  it('a successful reconcile records the id RevenueCat first knew the customer by', () => {
    expect(strip(ROUTE)).toMatch(/original_app_user_id:\s*payload\?\.subscriber\?\.original_app_user_id\s*\?\?\s*null/)
  })

  it('it is recorded on the SUCCESS event, which is the only one an orphan can be joined against', () => {
    const s = strip(ROUTE)
    const at = s.indexOf("recordOpsEvent('revenuecat_reconciled'")
    expect(at, 'the reconciled event is gone').toBeGreaterThan(-1)
    const block = s.slice(at, at + 700)
    expect(block, 'original_app_user_id is recorded somewhere else, not on the reconciled event')
      .toMatch(/original_app_user_id/)
  })

  it('absence is recorded as null, never dropped — a signed-in purchase has no anonymous ancestor', () => {
    expect(strip(ROUTE)).toMatch(/\?\?\s*null/)
    expect(IFACE).toMatch(/original_app_user_id\?:\s*string\s*\|\s*null/)
  })
})

describe('ACT-RC-ANON-LINK-01 — the premises that were wrong stay wrong', () => {
  it('TRANSFER is handled, so nobody re-files it as a gap', () => {
    expect(strip(EVENTS)).toMatch(/case\s+'TRANSFER':[\s\S]{0,40}?return\s+'active'/)
  })

  it('CANCELLATION is deliberately NOT mapped, and that is doctrine, not an omission', () => {
    // SUBS-CANCELLATION-TIER-01: in Apple's vocabulary CANCELLATION means auto-renew OFF, not
    // access ended. Mapping it to `cancelled` demoted runners still inside a period they had
    // paid for — and an offer code created with auto-renew off emits CANCELLATION ~2 minutes
    // after purchase, so all 500 Make-A-Wish runners would have dropped to free.
    // `resolveTier` independently requires `current_period_end > now`, so access still
    // self-terminates. The 8 `revenuecat_event_unhandled` rows are the system working.
    // ⚠️ IT IS AN EXPLICIT `case … return null`, NOT AN ABSENT ONE, and the first cut of this
    // arm asserted the case was missing — which would have passed if someone DELETED the case
    // and let it fall through, losing the recorded reasoning. Assert the mapping.
    expect(strip(EVENTS), 'CANCELLATION must map to null — read SUBS-CANCELLATION-TIER-01 first')
      .toMatch(/case\s+'CANCELLATION':[\s\S]{0,40}?return\s+null/)
    expect(EVENTS).toMatch(/SUBS-CANCELLATION-TIER-01/)
  })
})
