import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { BRAND } from '@/lib/brand'
import { pageMetadata, SITE_URL, OG_LOCALE, ogImage } from '@/lib/marketing/siteMeta'

/**
 * SITE-META-01 — every public page carries a complete, page-specific head.
 *
 * ⚠️ WHAT WAS ACTUALLY WRONG, measured in the rendered HTML rather than
 * inferred from the source:
 *   · The root layout set twitter.title and twitter.description, so every
 *     page that did not restate a twitter block shared ONE social card:
 *     /guides, /comparisons, /privacy, /terms, /support and all nine plan
 *     pages. Next resolves an ABSENT twitter.title from the page's own title,
 *     so the fix was deleting two lines, not adding fifteen blocks.
 *   · /privacy, /terms and /support had no canonical and no openGraph at all.
 *   · og:locale was set on four pages out of fifteen.
 *   · /api/og took no request, so one image served the whole site.
 *   · lib/marketing/plans.ts typed the brand name out EIGHTEEN times, against
 *     a CLAUDE.md rule that exists because the product has renamed twice.
 *
 * Next merges metadata SHALLOWLY: a page defining `openGraph` replaces the
 * parent's object outright. Restating five blocks correctly on fifteen pages
 * is not something a reviewer holds in their head, which is why there is one
 * builder and this test guards the way in.
 */

const ROOT = path.resolve(__dirname, '../..')
const read = (f: string) => fs.readFileSync(path.join(ROOT, f), 'utf8')

/**
 * ⚠️ STRIP COMMENTS BEFORE MATCHING SOURCE. Every assertion below is about
 * what the CODE does, and the code is surrounded by prose explaining the very
 * thing being asserted. The first cut of this file failed because the comment
 * saying "NO maximumScale, it refuses pinch zoom" contains the word
 * `maximumScale`. That is the third time in one day in this repo that a check
 * matched its own explanation: the units guard fired on its own comment, and a
 * source-reading test matched its own an hour after that one was fixed.
 */
const code = (f: string) =>
  read(f).replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '')

/** Public, indexable pages. Preview routes are internal and excluded. */
const PAGES = [
  'app/page.tsx', 'app/plans/page.tsx', 'app/plans/[slug]/page.tsx',
  'app/pricing/page.tsx', 'app/about/page.tsx', 'app/charity-runners/page.tsx',
  'app/privacy/page.tsx', 'app/terms/page.tsx', 'app/support/page.tsx',
  'app/guides/page.tsx', 'app/guides/[slug]/page.tsx', 'app/comparisons/page.tsx',
  'app/coopah-vs-runna/page.tsx', 'app/runna-alternatives/page.tsx',
]
/** Pages whose metadata comes from a shared builder that this test checks directly. */
const VIA_BUILDER = [
  'app/guides/page.tsx', 'app/guides/[slug]/page.tsx', 'app/comparisons/page.tsx',
  'app/coopah-vs-runna/page.tsx', 'app/runna-alternatives/page.tsx',
]

describe('marketing metadata', () => {
  it('builds every public page through the single owner', () => {
    const rogue: string[] = []
    for (const f of PAGES) {
      const src = code(f)
      if (VIA_BUILDER.includes(f)) {
        if (!/articleMetadata|hubMetadata/.test(src)) rogue.push(`${f}: no shared builder`)
        continue
      }
      if (!src.includes('pageMetadata(')) rogue.push(`${f}: hand-rolled metadata`)
      // A hand-written openGraph block next to the builder is the shallow-merge
      // trap re-opening: it would replace the builder's object wholesale.
      if (/\n\s{2}openGraph: \{/.test(src)) rogue.push(`${f}: hand-written openGraph`)
    }
    expect(rogue, rogue.join('\n')).toEqual([])
  })

  it('the shared builders go through the owner too', () => {
    expect(read('components/marketing/ArticlePage.tsx')).toContain('pageMetadata(')
    expect(read('components/marketing/ArticleHub.tsx')).toContain('pageMetadata(')
  })

  it('emits locale, canonical, a page-specific og image and a page-specific card', () => {
    const m = pageMetadata({ title: 'Pricing', description: 'd', path: '/pricing' }) as any
    expect(m.openGraph.locale).toBe(OG_LOCALE)
    expect(OG_LOCALE).toBe('en_GB')
    expect(m.alternates.canonical).toBe(`${SITE_URL}/pricing`)
    expect(m.openGraph.images[0].url).toContain('/api/og?title=Pricing')
    expect(m.twitter.title).toBe('Pricing')
    expect(m.twitter.card).toBe('summary_large_image')
  })

  it('does not append the brand to a title that already names it', () => {
    const plain = pageMetadata({ title: 'Pricing', description: 'd', path: '/p' }) as any
    expect(plain.title).toBe('Pricing')
    const named = pageMetadata({
      title: `Coopah vs Runna vs ${BRAND.name}`, brandInTitle: true, description: 'd', path: '/p',
    }) as any
    expect(named.title).toEqual({ absolute: `Coopah vs Runna vs ${BRAND.name}` })
  })

  it('keeps the root layout out of the pages way', () => {
    const layout = code('app/layout.tsx')
    // maximumScale:1 refuses pinch zoom — WCAG 2.1 SC 1.4.4.
    expect(layout).not.toMatch(/maximumScale/)
    // A root twitter title/description overrides every page's.
    const tw = layout.slice(layout.indexOf('twitter: {'), layout.indexOf('appleWebApp'))
    expect(tw).not.toMatch(/title:|description:/)
    expect(layout).toMatch(/template: `%s \| \$\{BRAND\.name\}`/)
    // Two declarations of the iOS status bar that disagreed.
    expect(layout).not.toContain('black-translucent')
    expect(layout).toContain('content="default"')
    expect(layout).toMatch(/statusBarStyle: 'default'/)
  })

  it('never types the brand name into the marketing catalogues', () => {
    for (const f of ['lib/marketing/plans.ts', 'lib/marketing/articles.ts']) {
      expect(code(f), `${f} hardcodes the brand name`).not.toContain(BRAND.name)
    }
  })

  it('the og image is per page and bounded', () => {
    expect(ogImage()).toBe(`${SITE_URL}/api/og`)
    expect(ogImage('Two weeks')).toContain('title=Two%20weeks')
    // A public GET: the length bound lives in the route as well, but a caller
    // that forgets is the common case.
    const long = ogImage('x'.repeat(400))
    expect(decodeURIComponent(long.split('title=')[1]).length).toBe(120)
  })
})
