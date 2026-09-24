import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * P-08(a) — where the charity code lives in the wizard, and why it does not
 * move to the end.
 *
 * ⚠️ THE FILING PROPOSED MOVING REDEMPTION TO THE LAST WIZARD STEP, at peak
 * intent, copying a competitor. **That is rejected, and the evidence is in
 * this file.** `GTM-CHARITY-08` (P1) requires runners to redeem BEFORE
 * choosing a distance, because Marathon is PAID-locked: a comped runner who
 * picks their race first meets a paywall as the first thing the product says
 * to them. Redemption at the END of the wizard makes that strictly worse —
 * the runner cannot have selected marathon to reach the step that would have
 * unlocked it.
 *
 * ⚠️ THE FILED DESCRIPTION WAS ALSO STALE. It said the code link "sits on step
 * 1 of the wizard (GeneratePlanScreen.tsx:1527)". There is exactly ONE
 * `onOpenRedeem` door in the wizard and it is inside `case 'distance'` — the
 * same screen as the lock. Better than filed, and the reason the current
 * placement is defensible rather than merely inherited.
 *
 * What remained was real: tapping the locked tile calls `onUpgrade` and
 * navigates AWAY, past the code link. Fixed as a WORDING change, which is what
 * the filing itself prescribed.
 */
const WIZ = readFileSync(join(process.cwd(), 'app/dashboard/GeneratePlanScreen.tsx'), 'utf8')

describe('P-08(a) — the distance gate names both routes out of it', () => {
  it('reads the real wizard', () => {
    expect(WIZ).toContain("case 'distance':")
    expect(WIZ).toMatch(/\bonOpenRedeem\b/)
  })

  it('there is exactly ONE redeem door in the wizard', () => {
    // A second door would be a second phrasing of one action, which is how
    // surfaces drift apart — the existing door reuses the other two doors'
    // string for exactly that reason.
    const doors = WIZ.split('onClick={onOpenRedeem}').length - 1
    expect(doors).toBe(1)
  })

  it('the door is on the DISTANCE step, where the lock bites', () => {
    // ⚠️ The RENDER switch, not the validation one. There are two
    // `case 'distance':` sites and the first is a one-line guard 780 lines
    // earlier (`return distanceKm !== null`); anchoring on it sliced 49
    // characters and reported the door missing from its own screen.
    const start = WIZ.indexOf("case 'distance':\n")
    // ⚠️ Anchored on the INDENTED case label. A bare `indexOf('case ')` matched
    // an earlier occurrence inside the block and truncated the slice before the
    // door — the same mis-anchored-slice class that went wrong three times in
    // refusalOffer.markup.test.ts.
    const next  = WIZ.indexOf("\n      case '", start + 10)
    const step  = WIZ.slice(start, next)
    expect(step, 'the redeem door must sit on the screen that locks marathon').toContain('onOpenRedeem')
  })

  it('the gate sentence names the code, not only the trial', () => {
    // A charity runner who taps the locked tile is navigated to Upgrade before
    // reading the link below. Both routes must be in the sentence they read
    // BEFORE the tap.
    const start = WIZ.indexOf('Marathon and longer')
    expect(start).toBeGreaterThan(-1)
    expect(WIZ.slice(start, start + 140)).toMatch(/charity code/i)
  })

  it('it is a wording fix: no second redeem button was added', () => {
    expect(WIZ.split('onClick={onOpenRedeem}').length - 1).toBe(1)
  })

  it('the locked tile still routes to Upgrade, which is right for everyone else', () => {
    // Making the tile inert would break the majority case (no code, Upgrade
    // IS the remedy) to serve 500 runners in October.
    expect(WIZ).toContain('locked ? onUpgrade?.() : setDistanceKm(d.value)')
  })
})
