import { BRAND } from '@/lib/brand'

/**
 * SITE-META-01 — one owner for the site's own URL and for the shape of a
 * marketing page's metadata.
 *
 * ⚠️ WHY A MODULE AND NOT A CONVENTION. The expression
 * `process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.zonna.run'` was written out
 * by hand in FIFTEEN files. CLAUDE.md's own account of GTM-SITE-01 explains
 * how that arose and why the committed default is right: an env var that
 * overrides twelve committed defaults is invisible drift, and keeping the
 * value in git makes local and production agree. Every word of that survives
 * here. What does not survive is the copying: twelve of those files defaulted
 * to the apex and two to `www`, and the disagreement was only findable by
 * reading all of them. The default is still committed, still reviewable, and
 * now stated once.
 *
 * ⚠️ `??` DOES NOT CATCH AN EMPTY STRING, and `new URL('')` throws at build
 * time. An env var set to '' is worse than absent, so it is treated as absent
 * here rather than trusted through a `??` that cannot see it.
 */
const raw = process.env.NEXT_PUBLIC_APP_URL?.trim()
export const SITE_URL = raw && raw.length > 0 ? raw.replace(/\/+$/, '') : 'https://www.zonna.run'

/** Absolute URL for a site-relative path. */
export function absolute(path: string): string {
  return `${SITE_URL}${path.startsWith('/') ? path : `/${path}`}`
}

/**
 * The OG image for a page.
 *
 * Until now every page on the site shared ONE image: `/api/og` took no
 * request and rendered the wordmark plus the tagline, so a guide, a plan, the
 * pricing page and the homepage were indistinguishable in a shared link. The
 * title is the only parameter, deliberately: the value of a per-page card is
 * that it names the page, and every extra knob is another way for the image
 * to disagree with the page.
 */
export function ogImage(title?: string): string {
  if (!title) return absolute('/api/og')
  return absolute(`/api/og?title=${encodeURIComponent(title.slice(0, 120))}`)
}

/** og:locale. Zonna writes British English and prices in GBP. */
export const OG_LOCALE = 'en_GB'

export type PageMetaInput = {
  /** <title>. The brand suffix is appended by the root layout's template. */
  title: string
  description: string
  /** Site-relative, e.g. '/pricing'. Used for canonical AND og:url. */
  path: string
  /** Defaults to `title` when omitted. */
  ogTitle?: string
  /** Defaults to `description` when omitted. */
  ogDescription?: string
  type?: 'website' | 'article'
  /** The headline drawn on the OG image. Defaults to `ogTitle ?? title`. */
  ogImageTitle?: string
  /**
   * The title already contains the brand, so the root layout's `%s | <brand>`
   * template must not append it again. Next's opt-out is `title.absolute`.
   */
  brandInTitle?: boolean
}

/**
 * A complete, consistent metadata object for a marketing page.
 *
 * ⚠️ THE SHALLOW-MERGE RULE IS THE WHOLE REASON THIS EXISTS. Next merges
 * metadata shallowly: a page that defines `openGraph` REPLACES the root
 * layout's object rather than merging into it. So every page that set
 * openGraph silently dropped the site-wide og:image unless it restated it,
 * and `/plans` shipped with no og:image for exactly that reason. The same
 * rule, opposite symptom, applies to `twitter`: a page that omits it inherits
 * the root's generic card, so every article shared one title on social.
 * Restating five blocks correctly on fifteen pages is not something a
 * reviewer can hold; one builder is.
 */
export function pageMetadata(input: PageMetaInput) {
  const url = absolute(input.path)
  const ogTitle = input.ogTitle ?? input.title
  const ogDescription = input.ogDescription ?? input.description
  const image = ogImage(input.ogImageTitle ?? ogTitle)
  return {
    title: input.brandInTitle ? { absolute: input.title } : input.title,
    description: input.description,
    alternates: { canonical: url },
    openGraph: {
      title: ogTitle,
      description: ogDescription,
      url,
      siteName: BRAND.name,
      locale: OG_LOCALE,
      type: input.type ?? ('website' as const),
      images: [{ url: image, width: 1200, height: 630, alt: ogTitle }],
    },
    twitter: {
      card: 'summary_large_image' as const,
      title: ogTitle,
      description: ogDescription,
      images: [image],
    },
  }
}
