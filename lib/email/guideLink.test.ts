/**
 * EMAIL-WAVE-4 — the conditional guide link, built before the pages exist.
 *
 * 🔴 THE FAILURE IT IS DESIGNED AGAINST is one this product already shipped. Every
 * email CTA pointed at the marketing homepage for months because a fallback felt
 * harmless; it cost four steps and two guesses to the single action we ask for.
 * **A link with nothing behind it is worse than no link**, so a missing guide
 * removes the paragraph rather than degrading to a hub.
 *
 * ⚠️ THIS IS THE HALF OF WAVE 4 THAT COULD BE BUILT. The Pattern email itself was
 * NOT built, and the measurement is the reason: it needs ≥3 analysed runs with HR,
 * and the only account that qualifies is `zonna.demo@demo.com` (72 live analyses;
 * the three real users have 3, 2 and 1, two of them with no HR at all). Authoring
 * a coaching pattern set against a corpus of one demo account is how a
 * coincidence becomes a finding.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// ⚠️ THE GATE IS MOCKED, AND THE FIRST VERSION OF THIS FILE WAS HOLLOW WITHOUT IT.
// The gate test read `if (guidesArePublished()) return` — so with the section
// open, which it is, the test returned immediately and asserted NOTHING. Deleting
// the gate from the source left the suite green. Caught by `npm run falsify`, not
// by reading it, and NOT by `hollowTestShapes.test.ts`, which lints specific
// shapes and cannot see a test that skips itself. **Third hollow shape today.**
let published = true
vi.mock('@/lib/marketing/articles', async (orig) => {
  const actual = await orig<typeof import('@/lib/marketing/articles')>()
  return { ...actual, guidesArePublished: () => published }
})

import { guideLinkFor } from './guideLink'
import { guideArticles, guidesArePublished } from '@/lib/marketing/articles'

beforeEach(() => { published = true })

describe('guideLinkFor — present or absent, never a consolation', () => {
  it('returns null for a topic with no guide, rather than a hub link', () => {
    // 'kit' has no guide today. When one ships this flips on its own, which is
    // the whole point of the mechanism.
    const link = guideLinkFor('kit')
    if (link) expect(link.href).toContain('/guide')   // if it ever exists, it is a guide
    else expect(link).toBeNull()
  })

  it('a returned link is ABSOLUTE and points at that guide, never the hub', () => {
    for (const intent of ['easy', 'week', 'wrong', 'kit'] as const) {
      const link = guideLinkFor(intent)
      if (!link) continue
      expect(link.href).toMatch(/^https?:\/\//)
      // The exact shape of the old defect: a bare origin with no path.
      expect(link.href).not.toMatch(/^https:\/\/[^/]+\/?$/)
      expect(link.title.length).toBeGreaterThan(0)
    }
  })

  it('respects the hub gate — no link into a section that is not open', () => {
    // The catalogue HAS a guide with intent 'easy', so this is a real case:
    // resolvable when the gate is open, null when it is shut.
    published = true
    const open = guideLinkFor('easy')
    expect(open, 'fixture must have a resolvable guide, or this proves nothing').not.toBeNull()

    published = false
    for (const intent of ['easy', 'week', 'wrong', 'kit'] as const) {
      expect(guideLinkFor(intent), `${intent} must be null behind a shut gate`).toBeNull()
    }
  })

  it('matches on INTENT, not on a slug — a slug is a URL and URLs get rewritten', () => {
    // Proves the mechanism reads the field the SLT ruling defined (W-01c), which
    // is what makes it survive a rename. Label-based matching is banned (D-17).
    const guides = guideArticles()
    expect(guides.length, 'the catalogue must contain a guide, or this proves nothing').toBeGreaterThan(0)
    const g = guides[0]!
    expect(g.intent, 'every guide must declare an intent').toBeTruthy()
    expect(guideLinkFor(g.intent!)).not.toBeNull()
  })

  it('a NEW guide lights the link up with no template edit — the founder ask', () => {
    // The catalogue is the only source. If a guide exists and the gate is open,
    // the link resolves; nothing in an email template has to change.
    const withIntent = guideArticles().filter(a => a.intent)
    const resolvable = (['easy', 'week', 'wrong', 'kit'] as const).filter(i => guideLinkFor(i))
    expect(resolvable.length).toBe(guidesArePublished() ? withIntent.length : 0)
  })
})
