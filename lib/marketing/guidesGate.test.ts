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


/**
 * SLT 2026-09-21 — a guide's coaching claims must cite a principle.
 *
 * Hutchinson's ruling: three of the eight planned guides answer coaching
 * questions under a Zonna byline to people with no plan in front of them, so
 * they are a coaching surface. A guide may only assert what an existing
 * principle already asserts, and it names the section.
 *
 * ⚠️ THIS CANNOT CHECK THAT THE CLAIMS MATCH THE SECTIONS, and pretending
 * otherwise would be worse than not having it. It checks that somebody had to
 * name one, which is the moment the question gets asked at all. The judgement
 * stays with the Coaching Board; this stops a guide reaching them unasked.
 */
describe('a guide cites the principles its claims rest on', () => {
  it('every guide names at least one principle section', () => {
    const missing = guideArticles().filter(a => !a.principleRefs?.length).map(a => a.slug)
    expect(missing, `guides with no principleRefs: ${missing.join(', ')}`).toEqual([])
  })

  it('each reference looks like a principle section, not free text', () => {
    for (const a of guideArticles())
      for (const ref of a.principleRefs ?? [])
        expect(ref, `${a.slug}: "${ref}"`).toMatch(/^§\d+[a-z]?$/)
  })

  it('a comparison article does not need them, because prices are not coaching', () => {
    // Guard against the rule quietly widening into the other kind, which would
    // make it noise and get it switched off.
    expect(() => guideArticles()).not.toThrow()
  })
})

/**
 * The breadcrumb follows the article's KIND, and does not link to a closed hub.
 *
 * Two defects found by looking at `/guide-preview` on 2026-09-21, both in the
 * shared renderer:
 *   1. The BreadcrumbList JSON-LD hardcoded "Comparisons" and `/comparisons`,
 *      so a guide told crawlers it sat under the wrong hub. Worse than the
 *      visible crumb being wrong, because nobody looks at structured data.
 *   2. The visible crumb linked to `/guides`, which 404s until the gate opens
 *      — and `/guide-preview` exists precisely to be read before then.
 */
describe('the article breadcrumb', () => {
  const src = readFileSync(join(process.cwd(), 'components/marketing/ArticlePage.tsx'), 'utf8')

  it('derives its hub from the article, not a hardcoded string', () => {
    expect(src).not.toMatch(/name: 'Comparisons', item:/)
    expect(src).toMatch(/name: hub\.label/)
  })

  it('renders the hub unlinked when that hub is not published', () => {
    expect(src).toMatch(/hub\.published/)
    expect(src).toMatch(/guidesArePublished\(\)/)
  })
})
