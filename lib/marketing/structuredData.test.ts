import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { BRAND, PRICING } from '@/lib/brand'
import { articleJsonLd } from '@/lib/marketing/articleJsonLd'
import sitemap from '@/app/sitemap'
import { guideArticles, comparisonArticles, articlePath, guidesArePublished } from '@/lib/marketing/articles'

/**
 * SITE-SCHEMA-01 — the structured data says what the product actually is.
 *
 * ⚠️ TWO OF THE FOUR THINGS ASKED FOR WERE ALREADY TRUE, and the honest
 * outcome of an audit includes what it did not have to change:
 *   · Article + Person author was already on all three articles.
 *   · The sitemap already listed the guide hub and the guide.
 * Both are asserted here anyway. An audit's value is partly in pinning what
 * is already right, because nothing was watching either of them.
 *
 * What was actually wrong:
 *   · SoftwareApplication, the general type, on an iOS app whose own
 *     `operatingSystem` field said "iOS 16.6 or later".
 *   · ONE Offer, the monthly one. The annual plan is the better-value price
 *     and a price-aware result showed the higher number and hid the lower.
 *   · The founder appeared under TWO names: "Russell Shear" as the app's
 *     author and on /about, "Russ Shear" as every article's author. To a
 *     crawler those are two people.
 */

const ROOT = path.resolve(__dirname, '../..')
const src = (f: string) =>
  fs.readFileSync(path.join(ROOT, f), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '')

describe('structured data', () => {
  it('describes the app as a MobileApplication', () => {
    const home = src('app/page.tsx')
    expect(home).toContain("'@type': 'MobileApplication'")
    expect(home).not.toContain("'@type': 'SoftwareApplication'")
  })

  it('offers both prices, read from PRICING and never typed', () => {
    const home = src('app/page.tsx')
    expect(home).toContain('String(PRICING.monthly.amount)')
    expect(home).toContain('String(PRICING.annual.amount)')
    expect(home).not.toContain(String(PRICING.monthly.amount))
    expect(home).not.toContain(String(PRICING.annual.amount))
  })

  it('names one author everywhere, from BRAND.founder', () => {
    const article = articleJsonLd({
      headline: 'h', datePublished: '2026-01-01', dateModified: '2026-01-01',
      description: 'd', url: 'https://example.test/x',
    })
    expect(article['@type']).toBe('Article')
    expect(article.author).toEqual({ '@type': 'Person', name: BRAND.founder.name })
    expect(article.publisher.name).toBe(BRAND.name)

    // The byline must not be typed out anywhere that emits an author.
    for (const f of ['app/page.tsx', 'app/about/page.tsx', 'lib/marketing/articleJsonLd.ts']) {
      expect(src(f), `${f} types the founder's name`).not.toContain(BRAND.founder.name)
      expect(src(f), `${f} types the founder's legal name`).not.toContain(BRAND.founder.legalName)
    }
  })

  it('uses the LEGAL name only on the legal pages, and parameterised', () => {
    for (const f of ['app/privacy/page.tsx', 'app/terms/page.tsx']) {
      expect(src(f)).toContain('BRAND.founder.legalName')
      expect(src(f)).not.toContain(BRAND.founder.legalName)
    }
  })

  it('lists every live guide and comparison in the sitemap', () => {
    const urls = new Set(sitemap().map(e => e.url.replace(/^https?:\/\/[^/]+/, '') || '/'))
    for (const a of [...guideArticles(), ...comparisonArticles()]) {
      expect(urls.has(articlePath(a)), `sitemap is missing ${articlePath(a)}`).toBe(true)
    }
    // The guide HUB is gated separately from the articles: listing a hub that
    // 404s would advertise a dead page to a crawler.
    expect(urls.has('/guides')).toBe(guidesArePublished())
  })

  it('puts a BreadcrumbList on every page below the root', () => {
    const missing = [
      'app/plans/page.tsx', 'app/pricing/page.tsx', 'app/about/page.tsx',
      'app/charity-runners/page.tsx',
      'components/marketing/PlanPage.tsx', 'components/marketing/ArticlePage.tsx',
      'components/marketing/ArticleHub.tsx',
    ].filter(f => !src(f).includes('BreadcrumbList'))
    expect(missing, `no BreadcrumbList in:\n${missing.join('\n')}`).toEqual([])
    // The homepage is the root of the trail and correctly has none.
    expect(src('app/page.tsx')).not.toContain('BreadcrumbList')
  })
})
