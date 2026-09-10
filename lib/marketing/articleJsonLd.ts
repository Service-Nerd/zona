// GTM-SEO-COMPARE-01 — schema.org Article JSON-LD.
//
// The one SEO artifact that does NOT fall out of the Next.js metadata API:
// canonical, Open Graph and Twitter tags are all produced from the `metadata`
// export, but structured data has to be emitted as a script tag by the page.
//
// Parameterised so a page passes its own five values in one line. Author and
// publisher are constant across every article on this site, so they live here
// rather than being repeated per page. `publisher.name` still reads from
// `BRAND.name` (CLAUDE.md: never type the brand as a literal) — the fact that a
// value is constant across pages does not make it constant across renames.

import { BRAND } from '@/lib/brand'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://zonna.run'

/** Constant across all articles. Not a parameter on purpose. */
const AUTHOR_NAME = 'Russ Shear'

export interface ArticleJsonLdInput {
  headline: string
  /** ISO yyyy-mm-dd. Fixed at first publish; does NOT move when copy is revised. */
  datePublished: string
  /** ISO yyyy-mm-dd. Must be the SAME value the page's visible "Last updated"
   *  line renders, so the two cannot drift. */
  dateModified: string
  description: string
  /** Absolute URL of the page itself. */
  url: string
}

export function articleJsonLd(input: ArticleJsonLdInput) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: input.headline,
    datePublished: input.datePublished,
    dateModified: input.dateModified,
    author: { '@type': 'Person', name: AUTHOR_NAME },
    publisher: { '@type': 'Organization', name: BRAND.name, url: APP_URL },
    description: input.description,
    mainEntityOfPage: input.url,
  }
}
