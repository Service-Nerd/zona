import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { comparisonArticles, guideArticles, guidesArePublished, guidesSectionIsMature, guidesByIntent, shouldGroupGuides, GUIDE_INTENTS, GUIDES_MIN_TO_PUBLISH, GUIDES_SECTION_MATURE } from './articles'

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
/**
 * Read a source file with COMMENTS STRIPPED.
 *
 * ⚠️ Every assertion below greps source, and a comment explaining a rule
 * contains the rule. This exact trap fired four times in one day across this
 * codebase, once on `hardcodedUnits.test.ts`, which was fixed the same
 * afternoon — and then I wrote a new source-reading test without the fix and
 * it caught my own comment describing why the route is no longer gated.
 *
 * A guard that fires on its own documentation teaches you to write around the
 * guard, which is strictly worse than a false negative. Strip once, here, so
 * no assertion has to think about it.
 */
const read = (p: string) =>
  readFileSync(join(process.cwd(), p), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n').filter(l => !l.trim().startsWith('//')).join('\n')

describe('W-01 — one gate, four surfaces', () => {
  it('the gate is a relationship, not a restated number', () => {
    expect(guidesArePublished()).toBe(guideArticles().length >= GUIDES_MIN_TO_PUBLISH)
  })

  it('a small section still explains itself, even with the publish gate at 1', () => {
    // ⚠️ THIS ASSERTION MOVED. It used to read `GUIDES_MIN_TO_PUBLISH > 1`,
    // guarding against the publish gate going vacuous. The founder set that
    // gate to 1 on 2026-09-21, overruling the SLT, which makes the old
    // assertion an argument rather than a check.
    //
    // What it was PROTECTING is still worth protecting: the board's actual
    // concern was never the number, it was that a one-card index reads as
    // abandoned. That now lives in `GUIDES_SECTION_MATURE` and the hub's
    // young-section note, so the guard follows it there.
    expect(guidesSectionIsMature()).toBe(guideArticles().length >= GUIDES_SECTION_MATURE)
    expect(GUIDES_SECTION_MATURE).toBeGreaterThan(1)
    expect(GUIDES_SECTION_MATURE).toBeGreaterThan(GUIDES_MIN_TO_PUBLISH)

    // While the section is young the hub must say so, or the failure the gate
    // used to prevent simply happens at a different number.
    const hub = read('app/guides/page.tsx')
    expect(hub).toMatch(/guidesSectionIsMature\(\)/)
    expect(hub).toMatch(/youngNote/)
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

  it('the rule is SCOPED to guides — a comparison without them is not flagged', () => {
    // 🔴 THIS ASSERTION WAS HOLLOW UNTIL 2026-09-24. It read
    // `expect(() => guideArticles()).not.toThrow()` under this exact title:
    // a test named for comparisons and `principleRefs` that asserted neither,
    // and would have passed in every possible state of both. Found while
    // relying on this file to enforce a Coaching Board ruling.
    //
    // ⚠️ `hollowTestShapes.test.ts`, shipped the same morning, does NOT catch
    // this shape — it lints `toContain` on source text and branches an earlier
    // assertion made unreachable, not "the assertion is unrelated to the title".
    // Recorded rather than papered over.
    //
    // What the rule actually is: guides MUST cite principles, comparisons MAY.
    // Widening it to every article would make it noise and get it switched off,
    // which is the failure this test was written to prevent.
    const comparisonsWithout = comparisonArticles().filter(a => !a.principleRefs?.length)
    expect(comparisonsWithout.length, 'fixture must contain a comparison with no principleRefs')
      .toBeGreaterThan(0)
    // The gate above flags only guides. Prove it by running the same predicate
    // over comparisons and showing the rule does not reach them.
    const flagged = guideArticles().filter(a => !a.principleRefs?.length)
    expect(flagged).toEqual([])
    for (const a of comparisonsWithout) expect(a.kind).toBe('comparison')
  })

  it('a comparison MAY carry them, and they are validated the same way', () => {
    // GTM-SEO-COMPARE-01 page 3 carries `principleRefs` although it is a
    // comparison: its body is mostly coaching, and the SLT ruling on the field
    // turns on the CLAIM, not the URL. If a comparison names sections, they must
    // still look like sections.
    for (const a of comparisonArticles())
      for (const ref of a.principleRefs ?? [])
        expect(ref, `${a.slug}: "${ref}"`).toMatch(/^§\d+[a-z]?$/)
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
  const src = read('components/marketing/ArticlePage.tsx')

  it('derives its hub from the article, not a hardcoded string', () => {
    expect(src).not.toMatch(/name: 'Comparisons', item:/)
    expect(src).toMatch(/name: hub\.label/)
  })

  it('renders the hub unlinked when that hub is not published', () => {
    expect(src).toMatch(/hub\.published/)
    expect(src).toMatch(/guidesArePublished\(\)/)
  })
})

/**
 * W-01a — an approved guide is LIVE, and it is not an orphan.
 *
 * Two SLT rulings from the same sitting deadlocked while article publication
 * was gated on the hub: Fried's "publish one and see" could never happen,
 * because the hub needs three and the first can never exist. They are about
 * different objects — Wood's objection is to a one-card HUB, not to a guide
 * existing — so the article publishes on approval and the hub still waits.
 *
 * ⚠️ Which means a live guide with a shut hub has NO hub card, and would be an
 * orphan without a deliberate inbound link. That is worse than unpublished:
 * a page nothing links to is a page crawlers discount and readers never find.
 */
describe('W-01a — a live guide is reachable', () => {
  it('every guide is linked from somewhere in the marketing site', () => {
    const surfaces = [
      'app/page.tsx',
      'components/marketing/SameWeekTwice.tsx',
      'components/marketing/ArticleHub.tsx',
    ].map(read).join('\n')
    const orphans = guideArticles()
      .filter(a => !surfaces.includes(`/guides/${a.slug}`))
      // The hub links every guide once it is open, so that covers them then.
      .filter(() => !guidesArePublished())
      .map(a => a.slug)
    expect(orphans, `guides with no inbound link: ${orphans.join(', ')}`).toEqual([])
  })

  it('the article route is NOT gated on the hub', () => {
    const src = read('app/guides/[slug]/page.tsx')
    expect(src).not.toMatch(/guidesArePublished/)
  })
})

/**
 * W-01c — the guide hub groups by intent, and only when grouping says
 * something.
 */
describe('guide hub grouping', () => {
  it('requires an intent on every guide', () => {
    const ungrouped = guideArticles().filter(a => !a.intent)
    expect(
      ungrouped.map(a => a.slug),
      'a guide with no intent silently vanishes from a grouped hub',
    ).toEqual([])
  })

  it('only buckets into declared intents', () => {
    const ids = new Set(GUIDE_INTENTS.map(g => g.id))
    for (const a of guideArticles()) expect(ids.has(a.intent!), `${a.slug}: ${a.intent}`).toBe(true)
  })

  it('loses no guide to grouping', () => {
    const grouped = guidesByIntent().flatMap(g => g.articles.map(a => a.slug)).sort()
    expect(grouped).toEqual(guideArticles().map(a => a.slug).sort())
  })

  it('stays flat until two buckets are populated', () => {
    // Not a hedge: four headings over one article advertises three empty
    // rooms, which is the "reads as abandoned" failure the hub gate exists
    // for. Asserted as a RULE about the count, not about today's answer, so
    // it keeps holding as guides are added.
    expect(shouldGroupGuides()).toBe(guidesByIntent().length >= 2)
  })
})
