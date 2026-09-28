import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * P-08(a) — where the code control lives in the wizard, and what keeps it reachable.
 *
 * 🔴 THIS FILE PREVIOUSLY ASSERTED THE OPPOSITE ARRANGEMENT, AND THE REVERSAL IS
 * DELIBERATE AND PRICED. Its header read: *"where the charity code lives in the wizard,
 * and why it does not move to the end … THE FILING PROPOSED MOVING REDEMPTION TO THE LAST
 * WIZARD STEP, at peak intent, copying a competitor. That is rejected, and the evidence is
 * in this file."*
 *
 * The rejection had a real mechanism, not a preference: **Marathon is PAID-locked at the
 * `distance` step**, so a comped runner who has not redeemed cannot select their race, and
 * *"redemption at the END of the wizard makes that strictly worse — the runner cannot have
 * selected marathon to reach the step that would have unlocked it."*
 *
 * ── WHY IT NO LONGER BINDS ──────────────────────────────────────────────────
 * Two things changed on 2026-09-28, and only the second is about taste.
 *
 * 1. 🔴 **THE LOCKED TILE ROUTES TO UPGRADE, AND UPGRADE CARRIES THE CONTROL.**
 *    `locked ? onUpgrade?.() : setDistanceKm(...)`. So a runner blocked at `distance`
 *    is not stranded by a control at the end of the wizard — they are one tap from the
 *    same control on the paywall. **That is the whole answer to the old mechanism, and
 *    the last test in this file now asserts it rather than assuming it.**
 * 2. The main path stopped going through the app at all. Charity access is now an Apple
 *    offer code, redeemed **by URL before the app is installed** — measured twice, both
 *    real redemptions. The in-app control is the exception route, not the route.
 *
 * Ruled CHARITY-CODE-CONTROL-01 (Design Board, 2026-09-28) on a founder instruction:
 * *"at end of wizard for setup but before plan"*. ⚠️ **The rejection above was found by a
 * failing test rather than by the settled-ground scan**, which read the rulings register
 * and the code comments and not the checks. The mechanical layer IS doctrine here.
 */
const WIZ = readFileSync(join(process.cwd(), 'app/dashboard/GeneratePlanScreen.tsx'), 'utf8')
const UPG = readFileSync(join(process.cwd(), 'app/dashboard/UpgradeScreen.tsx'), 'utf8')

const CONTROL = '<RedeemCodeLink'

describe('P-08(a) — the distance gate names both routes out of it', () => {
  it('reads the real wizard', () => {
    expect(WIZ).toContain("case 'distance':")
    expect(WIZ).toContain(CONTROL)
  })

  it('there is exactly ONE redeem control in the wizard', () => {
    // A second control would be a second phrasing of one action, which is how surfaces
    // drift apart. `REDEEM_CODE_LABEL` now makes the string itself mechanical; this arm
    // keeps the COUNT honest, which the constant cannot.
    expect(WIZ.split(CONTROL).length - 1).toBe(1)
  })

  // 🔴 INVERTED ON 2026-09-28. This used to assert the control sat inside
  // `case 'distance':`. It now asserts the opposite, because the founder moved it and the
  // reachability objection is answered by the Upgrade route asserted below.
  it('the control is NOT on the distance step any more', () => {
    // ⚠️ The RENDER switch, not the validation one. There are two `case 'distance':`
    // sites and the first is a one-line guard 780 lines earlier
    // (`return distanceKm !== null`); anchoring on it sliced 49 characters and once
    // reported the door missing from its own screen.
    const start = WIZ.indexOf("case 'distance':\n")
    const next = WIZ.indexOf("\n      case '", start + 10)
    expect(start).toBeGreaterThan(-1)
    expect(next).toBeGreaterThan(start)
    expect(WIZ.slice(start, next), 'step one no longer offers redemption').not.toContain(CONTROL)
  })

  it('the control is anchored to the final CTA, not to a named step', () => {
    // ⚠️ `buildSteps()` appends `hard-sessions`, `terrain` and `injuries` ONLY when
    // `hasPaidAccess`, so the wizard's last step is `injuries` for a trial or paid runner
    // and a DIFFERENT step for a free one. "End of wizard" is not one screen, and a step
    // name would put the control somewhere different depending on tier.
    const at = WIZ.indexOf(CONTROL)
    expect(at).toBeGreaterThan(-1)
    const before = WIZ.slice(Math.max(0, at - 600), at)
    expect(before, 'the control must be gated on isLastStep').toMatch(/\bisLastStep\b/)
  })

  it('the gate sentence still names the code route, not only the trial', () => {
    // A runner who taps the locked tile is navigated to Upgrade before reading anything
    // below it. Both routes must be in the sentence they read BEFORE the tap.
    // ⚠️ No longer /charity code/: the label and this sentence both stopped naming a
    // programme, because the same control now serves ambassador and discount codes.
    const start = WIZ.indexOf('Marathon and longer')
    expect(start).toBeGreaterThan(-1)
    expect(WIZ.slice(start, start + 140)).toMatch(/\bcode\b/i)
    expect(WIZ.slice(start, start + 140)).not.toMatch(/charity/i)
  })

  // 🔴 THE ARM THAT MAKES THE MOVE SAFE, AND IT IS NEW.
  //
  // The old rejection's mechanism was that a runner locked out of marathon can never
  // reach a control at the end of the wizard. That is still true. What defeats it is that
  // the locked tile sends them to Upgrade, and Upgrade carries the same control — so the
  // reachability guarantee is a PAIR of facts, and a check that asserted only the first
  // would pass while the second quietly disappeared.
  it('the locked tile routes to Upgrade AND Upgrade carries the control', () => {
    expect(WIZ, 'the locked tile must still navigate rather than sit inert')
      .toContain('locked ? onUpgrade?.() : setDistanceKm(d.value)')
    expect(UPG, 'removing the Upgrade control strands every locked-out charity runner')
      .toContain(CONTROL)
  })
})
