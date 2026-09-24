/**
 * CHARITY-REDEEM-RATELIMIT-01 — the comment's claim, made true.
 *
 * `lib/charity/code.ts` justified the 30^8 codespace with "the redeem route is
 * also rate-limited and authenticated". Authenticated was true; **rate-limited
 * was false** on every path since the feature shipped — nothing in the route,
 * nothing in `middleware.ts`, and `AI_ROUTE_LIMITS` covers AI surfaces only and
 * never named charity. Found while writing the route's contract.
 *
 * ⚠️ WHAT THIS FILE CAN AND CANNOT PROVE. `app/**` is outside vitest's collection
 * roots, so the ROUTE cannot be unit-tested here — the same constraint that put
 * `toStatus` in `lib/`. These cases pin the two things that ARE in the tested
 * layer: the limits are sane, and the generic limiter the route calls did not
 * change the AI limiter's behaviour when it was extracted.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { CHARITY_REDEEM_LIMIT, CHARITY_REDEEM_WINDOW_SECONDS } from './code'

const rpc = vi.fn()
vi.mock('@supabase/supabase-js', () => ({ createClient: () => ({ rpc }) }))

describe('CHARITY_REDEEM limits', () => {
  it('permits ordinary mistyping and refuses bulk attempts', () => {
    // A redemption is once per account; this is the typo budget, not a quota.
    expect(CHARITY_REDEEM_LIMIT).toBeGreaterThanOrEqual(5)
    expect(CHARITY_REDEEM_LIMIT).toBeLessThanOrEqual(20)
    expect(CHARITY_REDEEM_WINDOW_SECONDS).toBe(3600)
  })
})

describe('checkRateLimit — the generic owner the route calls', () => {
  beforeEach(() => { rpc.mockReset(); vi.resetModules() })

  it('passes the caller key through verbatim, namespace and all', async () => {
    const { checkRateLimit } = await import('@/lib/ai/rateLimit')
    rpc.mockResolvedValue({ data: true, error: null })
    await checkRateLimit('charity:redeem:user-123', 10, 3600)
    expect(rpc).toHaveBeenCalledWith('check_rate_limit', {
      p_key: 'charity:redeem:user-123', p_limit: 10, p_window_seconds: 3600,
    })
  })

  it('denies when the limiter says the window is spent', async () => {
    const { checkRateLimit } = await import('@/lib/ai/rateLimit')
    rpc.mockResolvedValue({ data: false, error: null })
    expect(await checkRateLimit('charity:redeem:u', 10, 3600)).toBe(false)
  })

  // 🔴 A FALSE DENIAL WITHHOLDS A GIFT. Fail-open is the deliberate trade, and it
  // matters more here than on the AI routes it was written for.
  it('fails OPEN when the limiter itself is broken', async () => {
    const { checkRateLimit } = await import('@/lib/ai/rateLimit')
    rpc.mockResolvedValue({ data: null, error: { message: 'RPC missing' } })
    expect(await checkRateLimit('charity:redeem:u', 10, 3600)).toBe(true)
    rpc.mockRejectedValue(new Error('DB unreachable'))
    expect(await checkRateLimit('charity:redeem:u', 10, 3600)).toBe(true)
  })

  // 🔴 REGRESSION ON THE EXTRACTION. checkAiRateLimit now delegates; the five AI
  // routes must still get the identical `ai:<route>:<user>` key they always had.
  // If the prefix moved or was dropped, every existing AI limit silently re-keys
  // and every user's window resets to empty.
  it('checkAiRateLimit still builds the ai: key exactly as before', async () => {
    const { checkAiRateLimit } = await import('@/lib/ai/rateLimit')
    rpc.mockResolvedValue({ data: true, error: null })
    await checkAiRateLimit('user-7', 'generate-plan', 10, 3600)
    expect(rpc).toHaveBeenCalledWith('check_rate_limit', {
      p_key: 'ai:generate-plan:user-7', p_limit: 10, p_window_seconds: 3600,
    })
  })
})
