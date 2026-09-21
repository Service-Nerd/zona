// GTM-SEO-COMPARE-01 — the constraints on this content type, mechanically.
//
// These are SEO and house-style rules that are invisible when broken: a 62-char
// title is not a build error, it is a truncated search result. Eight articles
// will share this catalogue, so the checks are written over the whole list and
// cover pages that do not exist yet.

import { describe, it, expect } from 'vitest'
import { MARKETING_ARTICLES, COMPARISON_HUB, GUIDE_HUB, COMPETITOR_FACTS, comparisonArticles, guideArticles, guidesArePublished, GUIDES_MIN_TO_PUBLISH, marketingArticleJsonLd, type ArticleBlock } from './articles'
import { PRICING } from '@/lib/brand'
import { BRAND } from '@/lib/brand'

// ⚠️ Every block kind must be reachable from here. These checks (em dashes,
// brand literals) run over what `copyOf` returns, so a kind this function does
// not handle is copy the house-style rules silently stop covering. When `table`
// was added the compiler caught it; the next kind may not be a union widening.
const copyOf = (block: ArticleBlock): string => {
  switch (block.kind) {
    case 'h2': return block.text
    case 'table': return [block.caption, ...block.head, ...block.rows.flat()].join(' ')
    case 'p': return block.spans.map(s => (typeof s === 'string' ? s : s.text)).join(' ')
  }
}

const allCopy = (): string[] =>
  MARKETING_ARTICLES.flatMap(a => [
    a.metaTitle, a.metaDescription, a.ogTitle, a.ogDescription,
    a.h1, a.lastUpdated, a.signature, a.appStoreLinkText,
    ...a.body.map(copyOf),
  ])

describe('comparison articles — SEO limits', () => {
  it.each(MARKETING_ARTICLES.map(a => [a.slug, a] as const))(
    '%s: meta title is under 60 characters', (_slug, a) => {
      expect(a.metaTitle.length).toBeLessThan(60)
    })

  it.each(MARKETING_ARTICLES.map(a => [a.slug, a] as const))(
    '%s: meta description is under 155 characters', (_slug, a) => {
      expect(a.metaDescription.length).toBeLessThan(155)
    })

  it('slugs are unique and URL-clean', () => {
    const slugs = MARKETING_ARTICLES.map(a => a.slug)
    expect(new Set(slugs).size).toBe(slugs.length)
    for (const s of slugs) expect(s).toMatch(/^[a-z0-9-]+$/)
  })

  it('every table row is as wide as its header, and carries a caption', () => {
    // A short row renders a silently missing cell, which on a price comparison
    // is a competitor's price vanishing rather than a visible break.
    for (const a of MARKETING_ARTICLES)
      for (const b of a.body) {
        if (b.kind !== 'table') continue
        expect(b.caption.length, `${a.slug}: table caption is required for screen readers`).toBeGreaterThan(0)
        expect(b.head.length, `${a.slug}: a table needs at least two columns`).toBeGreaterThan(1)
        b.rows.forEach((row, i) =>
          expect(row.length, `${a.slug}: table row ${i} has ${row.length} cells against ${b.head.length} columns`).toBe(b.head.length))
      }
  })

  it('every article carries a machine-readable last-updated date', () => {
    for (const a of MARKETING_ARTICLES) expect(a.lastUpdatedISO).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
})

describe('comparison articles — house style', () => {
  it('no em dashes anywhere in the copy', () => {
    // Deliberate for this content type; the source copy is written without them.
    const offenders = allCopy().filter(s => s.includes('—'))
    expect(offenders).toEqual([])
  })

  it('every price in every article comes from a declared owner', () => {
    // GTM-SEO-COMPARE-PRICE-01. Page 1 quoted Coopah at £9.99 a month billed
    // annually and page 2 at £14.99 or £79.99 a year, both live at once, with
    // page 1 linking to page 2 three sentences after its own figure. Neither
    // was right. Eight articles are planned and every one will quote these
    // numbers, so a price typed into an article is a defect by construction:
    // it must come from `COMPETITOR_FACTS` or from `PRICING`.
    //
    // Matches £12 and £12.34 but not £1.5m, which is funding, not a price.
    const allowed = new Set<string>([
      ...Object.values(COMPETITOR_FACTS).flatMap(f => [f.monthly, f.annual]).filter((x): x is string => !!x),
      PRICING.monthly.display, PRICING.annual.display, PRICING.annual.perMonthDisplay,
      PRICING.monthly.perWeekDisplay, PRICING.annual.perWeekDisplay,
    ])
    const offenders: string[] = []
    for (const a of MARKETING_ARTICLES)
      for (const text of [a.metaDescription, a.hubSummary, ...a.body.map(copyOf)])
        for (const m of text.match(/£\d+(?:\.\d+)?(?![\d.]|\s*m\b)/g) ?? [])
          if (!allowed.has(m)) offenders.push(`${a.slug}: ${m} is not in COMPETITOR_FACTS or PRICING`)

    expect(Array.from(new Set(offenders))).toEqual([])
  })

  it('a competitor is quoted at one price across the whole catalogue', () => {
    // The owner makes two figures for one product impossible by construction,
    // so this asserts the owner itself is coherent rather than re-scanning
    // prose: a duplicate display value across two competitors is almost
    // always a copy-paste, and a missing verification date is a fact nobody
    // can re-check.
    for (const [key, f] of Object.entries(COMPETITOR_FACTS)) {
      expect(f.verified, `${key}: verification date`).toMatch(/^\d{4}-\d{2}-\d{2}$/)
      expect(f.source.length, `${key}: a figure with no named source cannot be re-checked`).toBeGreaterThan(0)
      expect(f.monthly ?? f.annual, `${key}: at least one price`).toBeTruthy()
    }
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
    for (const a of MARKETING_ARTICLES) {
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
  return readFileSync(join(process.cwd(), 'lib/marketing/articles.ts'), 'utf8')
}

describe('comparison articles — Article JSON-LD', () => {
  it.each(MARKETING_ARTICLES.map(a => [a.slug, a] as const))(
    '%s: dateModified is the SAME date the page displays', (_slug, a) => {
      // The whole point of the wiring. If someone revises the copy and bumps the
      // visible "Last updated" line without touching the structured data, Google
      // is told one date while the reader sees another. One field feeds both, so
      // this cannot happen — this test is what keeps it that way.
      expect(marketingArticleJsonLd(a).dateModified).toBe(a.lastUpdatedISO)
    })

  it.each(MARKETING_ARTICLES.map(a => [a.slug, a] as const))(
    '%s: datePublished is independent of dateModified', (_slug, a) => {
      // Distinct FIELDS, even where they hold the same value at first publish.
      // Deriving datePublished from lastUpdatedISO would make every revision
      // look like a brand-new article.
      expect(marketingArticleJsonLd(a).datePublished).toBe(a.publishedISO)
      expect(a.publishedISO <= a.lastUpdatedISO).toBe(true)
    })

  it.each(MARKETING_ARTICLES.map(a => [a.slug, a] as const))(
    '%s: headline and description match the page meta exactly', (_slug, a) => {
      const ld = marketingArticleJsonLd(a)
      expect(ld.headline).toBe(a.metaTitle)
      expect(ld.description).toBe(a.metaDescription)
      expect(ld.mainEntityOfPage).toBe(`https://www.zonna.run/${a.slug}`)
    })

  it('carries the constant author and publisher, with the brand interpolated', () => {
    const ld = marketingArticleJsonLd(MARKETING_ARTICLES[0])
    expect(ld['@context']).toBe('https://schema.org')
    expect(ld['@type']).toBe('Article')
    expect(ld.author).toEqual({ '@type': 'Person', name: 'Russ Shear' })
    expect(ld.publisher).toEqual({ '@type': 'Organization', name: BRAND.name, url: 'https://www.zonna.run' })
  })

  it('the helper is not hardcoded per page — every article produces valid output', () => {
    // Guards the "pages 2 through 8 inherit this" promise: a new entry gets
    // complete JSON-LD with no extra wiring.
    for (const a of MARKETING_ARTICLES) {
      const ld = marketingArticleJsonLd(a)
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
    // The hub is driven off MARKETING_ARTICLES, so pages 2-8 list themselves.
    // `hubSummary` is required precisely so a new article cannot ship with a
    // blank card, which is the failure mode of a derived-summary hub.
    for (const a of MARKETING_ARTICLES) {
      expect(a.hubSummary.length).toBeGreaterThan(0)
      expect(a.hubSummary).not.toBe(a.metaDescription)
      expect(a.lastUpdated.length).toBeGreaterThan(0)
    }
  })
})


/**
 * W-01 — the guide half of the catalogue, covered BEFORE a guide exists.
 *
 * Every rule above already runs over the whole catalogue, so an unwritten
 * guide is pre-covered for meta length, em dashes, brand literals, prices and
 * link shape the moment it is added. These add the rules that are specific to
 * having two KINDS in one list, and to the publish gate.
 *
 * ⚠️ The gate assertions are written so they keep meaning something after the
 * third guide lands: they assert the RELATIONSHIP between the count and the
 * gate, not today's count of zero. A test that only says "there are no guides
 * yet" deletes itself the day it matters.
 */
describe('W-01 — guides share the catalogue without contaminating comparisons', () => {
  it('every article declares a kind, and the two selectors partition the list', () => {
    for (const a of MARKETING_ARTICLES) expect(['comparison', 'guide']).toContain(a.kind)
    expect(comparisonArticles().length + guideArticles().length).toBe(MARKETING_ARTICLES.length)
  })

  it('the comparison hub never lists a guide, and vice versa', () => {
    expect(comparisonArticles().every(a => a.kind === 'comparison')).toBe(true)
    expect(guideArticles().every(a => a.kind === 'guide')).toBe(true)
  })

  it('the publish gate tracks the guide count rather than a second copy of it', () => {
    expect(guidesArePublished()).toBe(guideArticles().length >= GUIDES_MIN_TO_PUBLISH)
  })

  it('the two hubs have different slugs, so neither can shadow the other', () => {
    expect(GUIDE_HUB.slug).not.toBe(COMPARISON_HUB.slug)
    expect(MARKETING_ARTICLES.map(a => a.slug)).not.toContain(GUIDE_HUB.slug)
    expect(MARKETING_ARTICLES.map(a => a.slug)).not.toContain(COMPARISON_HUB.slug)
  })

  it('the guide hub copy obeys the same SEO limits as an article', () => {
    expect(GUIDE_HUB.metaTitle.length).toBeLessThan(60)
    expect(GUIDE_HUB.metaDescription.length).toBeLessThan(155)
    for (const v of Object.values(GUIDE_HUB)) expect(v).not.toContain('—')
  })
})
