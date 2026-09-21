import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { guideArticles, guidesArePublished, GUIDES_MIN_TO_PUBLISH } from './articles'

/**
 * W-01 — the guides shelf is gated in ONE place, and everything follows it.
 *
 * The hub 404s, the sitemap omits the guides and the hub, and the footer link
 * is absent, all until there are `GUIDES_MIN_TO_PUBLISH` guides. That is four
 * surfaces agreeing, which is four chances to disagree.
 *
 * ⚠️ WHY A SOURCE-READING TEST AND NOT JUST A BEHAVIOUR ONE. With zero guides
 * today, a behavioural assertion ("the hub 404s") passes whether the surface
 * reads the gate or hardcodes `false`. The failure this guards is the third
 * guide landing and ONE of the four surfaces not noticing — which nothing
 * would catch, because the other three would look right. So each surface is
 * asserted to READ the gate, not to produce today's answer.
 */
const read = (p: string) => readFileSync(join(process.cwd(), p), 'utf8')

describe('W-01 — one gate, four surfaces', () => {
  it('the gate is a relationship, not a restated number', () => {
    expect(guidesArePublished()).toBe(guideArticles().length >= GUIDES_MIN_TO_PUBLISH)
    expect(GUIDES_MIN_TO_PUBLISH).toBeGreaterThan(1)
  })

  it('the hub route reads the gate rather than deciding for itself', () => {
    const src = read('app/guides/page.tsx')
    expect(src).toMatch(/guidesArePublished\(\)/)
    expect(src).toMatch(/notFound\(\)/)
    // A second copy of "three" anywhere here is the drift this guards.
    expect(src).not.toMatch(/length\s*>=\s*\d/)
  })

  it('the sitemap reads the gate, and never lists a guide through the comparison mapper', () => {
    const src = read('app/sitemap.ts')
    expect(src).toMatch(/guidesArePublished\(\)/)
    expect(src).toMatch(/comparisonArticles\(\)/)
    // Mapping the whole catalogue is what would silently publish an orphan.
    expect(src).not.toMatch(/\.\.\.MARKETING_ARTICLES\.map/)
  })

  it('the footer link is conditional on the same gate', () => {
    const src = read('components/marketing/SiteFooter.tsx')
    expect(src).toMatch(/guidesArePublished\(\)/)
    expect(src).toMatch(/'\/guides'/)
  })

  it('the comparison hub filters by kind, so it cannot list a guide', () => {
    const src = read('app/comparisons/page.tsx')
    expect(src).toMatch(/comparisonArticles\(\)/)
    expect(src).not.toMatch(/articles=\{MARKETING_ARTICLES\}/)
  })
})
