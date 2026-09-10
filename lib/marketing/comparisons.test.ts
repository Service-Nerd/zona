// GTM-SEO-COMPARE-01 — the constraints on this content type, mechanically.
//
// These are SEO and house-style rules that are invisible when broken: a 62-char
// title is not a build error, it is a truncated search result. Eight articles
// will share this catalogue, so the checks are written over the whole list and
// cover pages that do not exist yet.

import { describe, it, expect } from 'vitest'
import { COMPARISON_ARTICLES, COMPARISON_HUB, comparisonArticleJsonLd, type ArticleBlock } from './comparisons'
import { BRAND } from '@/lib/brand'

const copyOf = (block: ArticleBlock): string =>
  block.kind === 'h2'
    ? block.text
    : block.spans.map(s => (typeof s === 'string' ? s : s.text)).join('')

const allCopy = (): string[] =>
  COMPARISON_ARTICLES.flatMap(a => [
    a.metaTitle, a.metaDescription, a.ogTitle, a.ogDescription,
    a.h1, a.lastUpdated, a.signature, a.appStoreLinkText,
    ...a.body.map(copyOf),
  ])

describe('comparison articles — SEO limits', () => {
  it.each(COMPARISON_ARTICLES.map(a => [a.slug, a] as const))(
    '%s: meta title is under 60 characters', (_slug, a) => {
      expect(a.metaTitle.length).toBeLessThan(60)
    })

  it.each(COMPARISON_ARTICLES.map(a => [a.slug, a] as const))(
    '%s: meta description is under 155 characters', (_slug, a) => {
      expect(a.metaDescription.length).toBeLessThan(155)
    })

  it('slugs are unique and URL-clean', () => {
    const slugs = COMPARISON_ARTICLES.map(a => a.slug)
    expect(new Set(slugs).size).toBe(slugs.length)
    for (const s of slugs) expect(s).toMatch(/^[a-z0-9-]+$/)
  })

  it('every article carries a machine-readable last-updated date', () => {
    for (const a of COMPARISON_ARTICLES) expect(a.lastUpdatedISO).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
})

describe('comparison articles — house style', () => {
  it('no em dashes anywhere in the copy', () => {
    // Deliberate for this content type; the source copy is written without them.
    const offenders = allCopy().filter(s => s.includes('—'))
    expect(offenders).toEqual([])
  })

  it('the brand name is interpolated, never typed as a literal', () => {
    // CLAUDE.md: never hardcode a brand name. These articles name the product
    // repeatedly, so a rename that missed them would advertise a dead brand.
    const src = readSource()
    expect(src.includes(`'${BRAND.name}'`)).toBe(false)
    expect(src.includes(`"${BRAND.name}"`)).toBe(false)
    // The rendered copy still says it, via interpolation.
    expect(allCopy().some(s => s.includes(BRAND.name))).toBe(true)
  })

  it('internal links are root-relative and external links are absolute', () => {
    for (const a of COMPARISON_ARTICLES) {
      for (const b of a.body) {
        if (b.kind !== 'p') continue
        for (const span of b.spans) {
          if (typeof span === 'string') continue
          expect(span.href.startsWith('/') || span.href.startsWith('https://')).toBe(true)
        }
      }
    }
  })
})

function readSource(): string {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { readFileSync } = require('node:fs') as typeof import('node:fs')
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { join } = require('node:path') as typeof import('node:path')
  return readFileSync(join(process.cwd(), 'lib/marketing/comparisons.ts'), 'utf8')
}

describe('comparison articles — Article JSON-LD', () => {
  it.each(COMPARISON_ARTICLES.map(a => [a.slug, a] as const))(
    '%s: dateModified is the SAME date the page displays', (_slug, a) => {
      // The whole point of the wiring. If someone revises the copy and bumps the
      // visible "Last updated" line without touching the structured data, Google
      // is told one date while the reader sees another. One field feeds both, so
      // this cannot happen — this test is what keeps it that way.
      expect(comparisonArticleJsonLd(a).dateModified).toBe(a.lastUpdatedISO)
    })

  it.each(COMPARISON_ARTICLES.map(a => [a.slug, a] as const))(
    '%s: datePublished is independent of dateModified', (_slug, a) => {
      // Distinct FIELDS, even where they hold the same value at first publish.
      // Deriving datePublished from lastUpdatedISO would make every revision
      // look like a brand-new article.
      expect(comparisonArticleJsonLd(a).datePublished).toBe(a.publishedISO)
      expect(a.publishedISO <= a.lastUpdatedISO).toBe(true)
    })

  it.each(COMPARISON_ARTICLES.map(a => [a.slug, a] as const))(
    '%s: headline and description match the page meta exactly', (_slug, a) => {
      const ld = comparisonArticleJsonLd(a)
      expect(ld.headline).toBe(a.metaTitle)
      expect(ld.description).toBe(a.metaDescription)
      expect(ld.mainEntityOfPage).toBe(`https://zonna.run/${a.slug}`)
    })

  it('carries the constant author and publisher, with the brand interpolated', () => {
    const ld = comparisonArticleJsonLd(COMPARISON_ARTICLES[0])
    expect(ld['@context']).toBe('https://schema.org')
    expect(ld['@type']).toBe('Article')
    expect(ld.author).toEqual({ '@type': 'Person', name: 'Russ Shear' })
    expect(ld.publisher).toEqual({ '@type': 'Organization', name: BRAND.name, url: 'https://zonna.run' })
  })

  it('the helper is not hardcoded per page — every article produces valid output', () => {
    // Guards the "pages 2 through 8 inherit this" promise: a new entry gets
    // complete JSON-LD with no extra wiring.
    for (const a of COMPARISON_ARTICLES) {
      const ld = comparisonArticleJsonLd(a)
      for (const k of ['headline', 'datePublished', 'dateModified', 'description', 'mainEntityOfPage'] as const) {
        expect(String(ld[k]).length).toBeGreaterThan(0)
      }
    }
  })
})

describe('comparison hub — /compare', () => {
  it('obeys the same SEO limits as the articles', () => {
    expect(COMPARISON_HUB.metaTitle.length).toBeLessThan(60)
    expect(COMPARISON_HUB.metaDescription.length).toBeLessThan(155)
  })

  it('has no em dashes, and names the brand by interpolation', () => {
    const copy = [COMPARISON_HUB.metaTitle, COMPARISON_HUB.metaDescription,
                  COMPARISON_HUB.h1, COMPARISON_HUB.sub, COMPARISON_HUB.eyebrow]
    expect(copy.filter(c => c.includes('—'))).toEqual([])
    expect(copy.some(c => c.includes(BRAND.name))).toBe(true)
  })

  it('every article can be rendered as a hub card', () => {
    // The hub is driven off COMPARISON_ARTICLES, so pages 2-8 list themselves.
    // `hubSummary` is required precisely so a new article cannot ship with a
    // blank card, which is the failure mode of a derived-summary hub.
    for (const a of COMPARISON_ARTICLES) {
      expect(a.hubSummary.length).toBeGreaterThan(0)
      expect(a.hubSummary).not.toBe(a.metaDescription)
      expect(a.lastUpdated.length).toBeGreaterThan(0)
    }
  })
})
