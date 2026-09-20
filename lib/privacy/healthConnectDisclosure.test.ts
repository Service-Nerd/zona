import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

/**
 * CONSENT-DISCLOSURE-01 — the disclosure at the Health-connect moment cannot
 * silently disappear.
 *
 * WHAT THE SLT RULED (2026-09-20), and it was ruled TWICE. First: take the
 * disclosure pattern, not the competitor's granular consent screen — Wood used
 * her kill mandate on that version, because a consent screen at onboarding is
 * ceremony, clicked through in two seconds, and it teaches the runner that the
 * first thing this app does is ask them to read something. The Health-connect
 * button is a real decision point with a consequence the runner can feel.
 * Then, second sitting: **the sentence was CUT and only the link remains.**
 * Sutherland — standing at a door marked "Health data" and volunteering "we
 * never send your name to the AI" introduces two concepts nobody asked about
 * at the moment they are deciding to hand over their heart rate.
 *
 * ⚠️ WHY THIS NEEDS A GUARD AT ALL. What survived is a single link in a large
 * component. It carries no visible product function — nothing breaks if it
 * goes, no test failed before this one existed, and the next person tidying
 * that block has no way to know four board seats argued about it. It is also
 * the ONLY place the app→Anthropic transfer is disclosed at a decision point:
 * **iOS's own HealthKit sheet does not cover it.** That permission is
 * device→app; the transfer to a third-party model is the undisclosed leg and
 * no OS prompt mentions it.
 *
 * ⚠️ WHAT THIS DOES NOT PROVE. It is a source-shape assertion: it proves the
 * link is rendered near the connect CTA, not that a human can see it, that it
 * is legible, or that the policy behind it is accurate. Nothing in this repo
 * has ever run on a device.
 */
const SRC = readFileSync('app/dashboard/DashboardClient.tsx', 'utf8')

describe('CONSENT-DISCLOSURE-01 — the Health-connect disclosure holds', () => {
  it('the connect CTA still exists, so the test cannot pass by matching nothing', () => {
    expect(SRC).toContain('Connect Apple Health')
    expect(SRC).toContain('connectHealthKit')
  })

  it('links the privacy policy at the connect moment', () => {
    expect(SRC).toContain('What we share')
    expect(SRC).toMatch(/ExternalLink[^>]*href="\/privacy"/)
  })

  it('uses ExternalLink, not a bare anchor', () => {
    // Inside the Capacitor webview a bare href to a marketing page REPLACES
    // the app and the runner has no way back; SFSafariViewController has its
    // own Done button. Already guarded generally by `externalLink.test.ts` —
    // asserted here too because a privacy link the runner cannot return from
    // is worse than the disclosure being absent.
    const at = SRC.indexOf('What we share')
    expect(at).toBeGreaterThan(-1)
    expect(SRC.slice(Math.max(0, at - 400), at)).toContain('ExternalLink')
  })

  it('the disclosure sits AFTER the CTA, at the decision point, not above it', () => {
    // Placement was the ruling. Above the button it is a preamble the runner
    // reads before they have a decision to make; below it, it annotates the
    // thing they are about to press.
    expect(SRC.indexOf('What we share')).toBeGreaterThan(SRC.indexOf('Connect Apple Health'))
  })

  it('the rejected toggles have not crept back in', () => {
    // ADR-011: we cannot collect GPS routes at all, so a routes toggle would be
    // a lie on a privacy surface. And one analytics event exists in the whole
    // product, so an analytics toggle is consent theatre that would also
    // throttle the instrumentation GTM-CHARITY-06 needs before October.
    const block = SRC.slice(SRC.indexOf('connectHealthKit'), SRC.indexOf('What we share'))
    expect(block).not.toMatch(/GPS routes?/i)
    expect(block).not.toMatch(/usage analytics/i)
  })
})
