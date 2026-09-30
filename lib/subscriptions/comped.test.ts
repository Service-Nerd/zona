import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { execSync } from 'node:child_process'
import { isCompedPurchase, priceAmount, compedEvidence, compedFromSubscriber } from './comped'
import { readEntitlement } from './entitlement'

// SUBS-COMPED-WRITER-01 — the gate for "gifted, or paid for?"

// 📐 THE REAL PAYLOAD, COPIED FROM PRODUCTION 2026-09-30 via
// `GET /v1/subscribers/{id}` for both genuine 2026-09-28 offer-code redemptions.
// ⚠️ A fixture invented from the docs would have used the WEBHOOK casing ("TRIAL")
// and a bare number price, and passed while the real subscriber shape failed — the
// recorded "fixtures must use the PRODUCT's values" class.
const REAL_REDEMPTION = {
  expires_date: '2027-09-28T16:35:10Z',
  period_type: 'trial',
  price: { amount: 0, currency: 'GBP' },
  store: 'app_store',
  ownership_type: 'PURCHASED',
}

/** What a genuine annual subscriber reads. No real one exists yet to copy. */
const PAYING = { expires_date: '2027-09-28T00:00:00Z', period_type: 'normal', price: { amount: 24.99, currency: 'GBP' } }

describe('isCompedPurchase — measured against the real payload', () => {
  it('the two real redemptions read as comped', () => {
    expect(isCompedPurchase(REAL_REDEMPTION.period_type, REAL_REDEMPTION.price)).toBe(true)
  })

  it('a paying subscriber does not', () => {
    expect(isCompedPurchase(PAYING.period_type, PAYING.price)).toBe(false)
  })

  // ⚠️ The webhook enum is UPPERCASE per RevenueCat's docs and price is a bare number.
  // Unverified against a captured body, which is why both shapes are accepted.
  it('accepts the webhook shape too — uppercase enum, bare numeric price', () => {
    expect(isCompedPurchase('TRIAL', 0)).toBe(true)
    expect(isCompedPurchase('NORMAL', 0)).toBe(false)
    expect(isCompedPurchase('PROMOTIONAL', 0)).toBe(true)
  })

  // 🔴 BOTH CONDITIONS REQUIRED. This is the whole safety margin against the
  // intro-trial dependency: if an introductory offer is ever re-added in App Store
  // Connect, a paying subscriber's first period reads `trial` — and is still not
  // marked comped, because the price is not zero.
  it('a free PERIOD TYPE with a real price is NOT comped', () => {
    expect(isCompedPurchase('trial', { amount: 24.99 })).toBe(false)
  })

  // 🔴 UNKNOWN IS NOT FREE. `?? 0` here would assert a missing field means "cost
  // nothing" — the class this repo has paid for four times.
  it('an absent or unparseable price is never comped', () => {
    expect(priceAmount(undefined)).toBeNull()
    expect(priceAmount({})).toBeNull()
    expect(priceAmount('0')).toBeNull()
    expect(priceAmount(NaN)).toBeNull()
    expect(isCompedPurchase('trial', undefined)).toBe(false)
    expect(isCompedPurchase('trial', {})).toBe(false)
  })

  it('a missing period type is never comped', () => {
    expect(isCompedPurchase(undefined, 0)).toBe(false)
    expect(isCompedPurchase(null, { amount: 0 })).toBe(false)
  })

  it('carries the raw evidence beside the verdict', () => {
    expect(compedEvidence('trial', { amount: 0 }))
      .toEqual({ is_comped: true, period_type: 'trial', price_amount: 0 })
    expect(compedEvidence(undefined, undefined))
      .toEqual({ is_comped: false, period_type: null, price_amount: null })
  })
})

describe('compedFromSubscriber — picking the right product', () => {
  it('reads the entitlement’s own product when named', () => {
    const subs = { zonna_premium_annual: REAL_REDEMPTION, other: PAYING }
    expect(compedFromSubscriber(subs, 'zonna_premium_annual').is_comped).toBe(true)
    expect(compedFromSubscriber(subs, 'other').is_comped).toBe(false)
  })

  it('falls back only when exactly one subscription exists', () => {
    expect(compedFromSubscriber({ a: REAL_REDEMPTION }, undefined).is_comped).toBe(true)
    // Two products and no product match: there is no non-guessing answer, so the
    // safe direction wins — a gift counted as a sale under-states conversion, which
    // is the direction a commercial number should fail in.
    expect(compedFromSubscriber({ a: REAL_REDEMPTION, b: PAYING }, undefined).is_comped).toBe(false)
  })

  it('an empty payload is not comped', () => {
    expect(compedFromSubscriber(undefined, undefined).is_comped).toBe(false)
  })
})

// 🔴 THE COMPOSED PATH, because neither half above proves the system does anything.
// `revenuecatEvents.test.ts` asserted `toStatus('CANCELLATION')` correctly and
// `tierResolution.test.ts` asserted `resolveTier` correctly, and the defect lived
// between them (SUBS-CANCELLATION-TIER-01). This walks the REAL payload through the
// real reader to the flag the writer passes.
describe('the composed path — real payload → readEntitlement → the flag', () => {
  it('a real redemption arrives at the writer as comped', () => {
    const read = readEntitlement({
      subscriber: {
        entitlements: { zonna_premium: {
          expires_date: '2027-09-28T16:35:10Z', product_identifier: 'zonna_premium_annual' } },
        subscriptions: { zonna_premium_annual: REAL_REDEMPTION },
      },
    }, new Date('2026-09-30T00:00:00Z'))
    expect(read.entitled).toBe(true)
    expect(read.comped.is_comped).toBe(true)
    expect(read.comped.period_type).toBe('trial')
    expect(read.comped.price_amount).toBe(0)
  })

  it('a paying subscriber arrives as not comped', () => {
    const read = readEntitlement({
      subscriber: {
        entitlements: { zonna_premium: {
          expires_date: '2027-09-28T00:00:00Z', product_identifier: 'zonna_premium_annual' } },
        subscriptions: { zonna_premium_annual: PAYING },
      },
    }, new Date('2026-09-30T00:00:00Z'))
    expect(read.entitled).toBe(true)
    expect(read.comped.is_comped).toBe(false)
  })

  it('an unentitled read still carries evidence rather than undefined', () => {
    expect(readEntitlement(null).comped)
      .toEqual({ is_comped: false, period_type: null, price_amount: null })
  })
})

// 🔴 THE POPULATION ARM. Every writer of `apply_subscription_event` must decide the
// flag, and the set is DERIVED from the code rather than hand-typed — because a
// hand-typed list of call sites is precisely how `sheetClose.test.ts` stayed green
// while missing the four sheets that mattered. A third writer added later fails here
// until someone states what it means.
describe('every subscription writer decides the flag', () => {
  const EXEMPT: Record<string, string> = {
    // Stripe is always a real payment: there is no Stripe path that gifts access, so
    // the migration's `default false` is the correct answer and passing it explicitly
    // would add a value nobody reads. If a Stripe coupon or 100%-off path is ever
    // added, DELETE this line — the arm then demands the flag.
    'app/api/webhooks/stripe/route.ts': 'Stripe writes are always paid; default false is correct',
  }

  // 🔴 THIS FILTER WAS WRONG ON ITS FIRST WRITE AND FALSIFICATION IS WHAT FOUND IT.
  // It was `/\.rpc[\s\S]{0,80}apply_subscription_event/` — a CHARACTER-DISTANCE window.
  // `reconcile/route.ts` casts the rpc through a long inline function type, so the gap
  // between `.rpc` and the literal is far more than 80 characters, and the file was
  // NEVER IN THE POPULATION. Deleting `p_is_comped` from it left all 16 tests green.
  //
  // ⚠️ Tenth instance of "the population excludes the cases at risk", committed inside
  // the arm written to prevent it, and the third time a CHARACTER BUDGET has been the
  // cause. **A region measured in bytes is not a region.** The predicate is now
  // structural: comments stripped, then BOTH `.rpc` and the quoted literal must appear.
  const code = (src: string) => src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n').filter(l => !l.trim().startsWith('//')).join('\n')

  const writers = execSync(
    "git grep -l \"apply_subscription_event\" -- 'app/**/*.ts' 'lib/**/*.ts'",
    { encoding: 'utf8' }).trim().split('\n')
    .filter(f => f && !f.includes('.test.'))
    // A file that only NAMES the rpc in prose (the ops/health modules) is not a writer.
    .filter(f => {
      const c = code(readFileSync(f, 'utf8'))
      return c.includes('.rpc') && /['\`]apply_subscription_event['\`]/.test(c)
    })

  it('the derived population holds every writer, and is not short', () => {
    // An empty set passes every assertion below it — the quietest way a gate dies.
    // ⚠️ AND A NON-EMPTY SET CAN STILL BE SHORT, which is what actually happened: the
    // webhook was found, reconcile was not, and "not empty" was satisfied. So the
    // known writers are named here as a FLOOR — not as the population itself.
    for (const known of [
      'app/api/webhooks/revenuecat/route.ts',
      'app/api/subscriptions/reconcile/route.ts',
      'app/api/webhooks/stripe/route.ts',
    ]) expect(writers, `${known} fell out of the derived population`).toContain(known)
  })

  it('each writer passes p_is_comped, or is declared exempt with a reason', () => {
    const missing = writers
      .filter(f => !(f in EXEMPT))
      .filter(f => !readFileSync(f, 'utf8').includes('p_is_comped'))
    expect(missing, 'a subscription writer does not decide is_comped:\n' + missing.join('\n')).toEqual([])
  })

  // ⚠️ FAILS THE OTHER WAY TOO. A stale exemption is a hole that reads as a decision.
  it('no exemption names a file that is not a writer, or that now passes the flag', () => {
    const stale = Object.keys(EXEMPT).filter(f =>
      !writers.includes(f) || readFileSync(f, 'utf8').includes('p_is_comped'))
    expect(stale, 'a declared exemption is no longer true:\n' + stale.join('\n')).toEqual([])
  })
})

// 🔴 THE ARM FOR THE UNVERIFIED SHAPE. The webhook event's field names come from
// RevenueCat's docs and have never been read off a captured body, while the subscriber
// reader is proven against two real redemptions. For a runner who redeems while ALREADY
// signed in the webhook is the only write, so a negative must be re-checked against the
// verified reader — and that re-check must never be able to cost them access.
describe('the webhook re-checks a negative against the verified reader', () => {
  const SRC = () => readFileSync('app/api/webhooks/revenuecat/route.ts', 'utf8')
  const code = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n').filter(l => !l.trim().startsWith('//')).join('\n')

  it('falls back to readEntitlement when the event says not comped', () => {
    const c = code(SRC())
    // ⚠️ `toContain` here would also pass against `readEntitlementX` — caught by
    // `hollowTestShapes.test.ts`, which is the substring-bias class this repo tracks.
    expect(c, 'the webhook no longer consults the verified reader')
      .toMatch(/\breadEntitlement\b/)
    expect(c, 'the fallback is not gated on a negative — it would fire on every renewal')
      .toMatch(/if\s*\(!comped\.is_comped/)
  })

  it('the fallback cannot break the write', () => {
    const c = code(SRC())
    const at = c.indexOf('if (!comped.is_comped')
    expect(at).toBeGreaterThan(-1)
    // Bounded by the block, not by a character budget — the mistake this file already
    // made once. Walk braces from the `if` to its matching close.
    let depth = 0, end = at
    for (let i = c.indexOf('{', at); i < c.length; i++) {
      if (c[i] === '{') depth++
      else if (c[i] === '}' && --depth === 0) { end = i; break }
    }
    const block = c.slice(at, end)
    expect(block, 'an unguarded fetch here can 500 the webhook and deny a real purchase')
      .toContain('try {')
    expect(block, 'the fallback must not throw out of the block').toContain('} catch')
    expect(block, 'a non-ok response must not be parsed as a payload').toContain('res.ok')
  })

  it('records which reader decided', () => {
    expect(code(SRC())).toMatch(/verified_via:\s*'subscriber'/)
  })
})
