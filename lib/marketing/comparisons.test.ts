// GTM-SEO-COMPARE-01 — the constraints on this content type, mechanically.
//
// These are SEO and house-style rules that are invisible when broken: a 62-char
// title is not a build error, it is a truncated search result. Eight articles
// will share this catalogue, so the checks are written over the whole list and
// cover pages that do not exist yet.

import { describe, it, expect } from 'vitest'
import { COMPARISON_ARTICLES, type ArticleBlock } from './comparisons'
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
