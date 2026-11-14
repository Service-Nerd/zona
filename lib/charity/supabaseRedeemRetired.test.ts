import { describe, it, expect } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { execSync } from 'node:child_process'
import { REDEEM_CODE_PLACEMENTS, REDEEM_CODE_LABEL } from '../subscriptions/redeemCode'

// REDEEM-SCREEN-UNREACHABLE-01 — the Supabase code-entry path is retired, and the gate says so
// in both directions: the dead path stays dead, and the LIVE path still exists.
//
// 🔑 THE FOUNDER RULED THIS FOUR TIMES, the last on 2026-11-02: *"the only code input is through
// Apple code redeem."* And *"we are not using the charity_codes table for this. i keep saying
// this."* It was not an SLT question by the time it was filed as one.
//
// 📐 WHAT ACTUALLY HAPPENED, and the items had it as an orphan rather than a retirement:
// `CHARITY-CODE-CONTROL-01` (Design Board 2026-09-28, on a founder instruction) replaced three
// hand-rolled Supabase code fields with ONE control calling Apple's `presentCodeRedemptionSheet`.
// That retired the Apple 3.1.1 exposure — a field that does not exist cannot violate a guideline
// — and the measurement behind it was stark: **the in-app Supabase field was redeemed ONCE, ever,
// against two Apple offer-code redemptions in a single afternoon.**
//
// ⚠️ AND APPLE'S SHEET CANNOT REDEEM A `charity_codes` ROW. It redeems an Apple offer code. So
// from 2026-09-28 the Supabase mechanism had no entry point at all, which is why the goodwill
// batch issued on 2026-10-07 was revoked the same day with "no redeem path available" — that note
// was correct, nine days after the control shipped.
//
// 🔻 WHAT GOES WITH IT, declared rather than discovered later: `GTM-CHARITY-07` ruled that a seat
// is spent when it was CLAIMED, and its enforcement lived in the deleted route's claim gate
// (`redeemClaimSemantics.test.ts`, removed here). The RULING still holds — `claimed_at` survives
// account deletion by founder decision (`CHARITY-CLAIM-RELEASE-01`) — but **nothing enforces it
// while nothing can redeem.** If the door is ever rebuilt, that gate comes back with it.
const tracked = (): string[] =>
  execSync('git ls-files "app/**/*.tsx" "app/**/*.ts" "components/**/*.tsx"', { encoding: 'utf8' })
    .split('\n').filter(Boolean)

describe('REDEEM-SCREEN-UNREACHABLE-01 — the Supabase code path stays retired', () => {
  it('the screen and the route are gone from the tree, not merely unreferenced', () => {
    expect(existsSync(join(process.cwd(), 'app/dashboard/RedeemCodeScreen.tsx'))).toBe(false)
    expect(existsSync(join(process.cwd(), 'app/api/charity/redeem/route.ts'))).toBe(false)
  })

  it('no screen value can reach it, and no file names one', () => {
    // ⚠️ The TREE, not the diff: the plumbing outlived its door by six weeks precisely because
    // nothing swept for it.
    // ⚠️ CODE SHAPES, NOT THE NAME. `app/auth/login/page.tsx` and `RedeemCodeLink.tsx` both
    // mention `RedeemCodeScreen` in comments that RECORD why it is gone, and a gate that reads
    // the comment about the defect as the defect is `HOOK-RGBA-COMMENTS-01` — which this file's
    // first cut reproduced. Those records must keep passing.
    const CODE_SHAPES = [
      /screen\s*===\s*['"]redeem['"]/,
      /setScreen\(\s*['"]redeem['"]/,
      /\|\s*['"]redeem['"]/,
      /<RedeemCodeScreen\b/,
      /import\(['"]\.\/RedeemCodeScreen['"]\)/,
    ]
    const offenders = tracked().filter(f => {
      const src = readFileSync(join(process.cwd(), f), 'utf8')
      return CODE_SHAPES.some(re => re.test(src))
    })
    expect(offenders, 'a reference to the retired screen survives').toEqual([])
  })

  it('and nothing calls the retired endpoint', () => {
    // Same rule: a FETCH of the endpoint, not a mention of its path.
    const offenders = tracked().filter(f =>
      /['"`][^'"`]*\/api\/charity\/redeem/.test(readFileSync(join(process.cwd(), f), 'utf8')))
    expect(offenders).toEqual([])
  })
})

describe('🔑 the LIVE path is untouched — retiring the dead one must not take the working one', () => {
  it('the code control still has its three declared placements', () => {
    // An empty population would pass every arm above while leaving no way to redeem anything.
    expect(REDEEM_CODE_PLACEMENTS.length).toBe(3)
    for (const p of REDEEM_CODE_PLACEMENTS) {
      expect(existsSync(join(process.cwd(), p.file)), `${p.file} is a declared placement`).toBe(true)
      // ⚠️ ANCHORED. `toContain('RedeemCodeLink')` passed a mutation that renamed the import to
      // `RedeemCodeLinkX` — substring bias, the class this repo has recorded more than any other.
      // When the thing matched is a NAME, anchor it.
      expect(readFileSync(join(process.cwd(), p.file), 'utf8'), `${p.file} renders the control`)
        .toMatch(/<RedeemCodeLink[\s/>]/)
    }
  })

  it('and it is still programme-neutral — Apple’s sheet serves every code type', () => {
    expect(REDEEM_CODE_LABEL).toBe('Have a code?')
    expect(REDEEM_CODE_LABEL.toLowerCase()).not.toContain('charity')
  })
})

describe('the runbook does not send the founder down the retired path', () => {
  const book = () => readFileSync(join(process.cwd(), 'docs/runbooks/charity-codes.md'), 'utf8')

  it('names no in-app door, because there is none', () => {
    // 🔴 It listed THREE by name — "Me screen → Have a charity code?", under the distance tiles,
    // and under Restore on Upgrade — six weeks after all three were replaced. It is the document
    // the founder would follow when a partner calls, which makes it the most expensive false
    // record in the set.
    expect(book()).not.toContain('Have a charity code?')
    expect(book()).not.toMatch(/\|\s*\*\*Me screen\*\*/)
  })

  it('and it says what the live mechanism is', () => {
    expect(book()).toContain('Apple')
  })
})
