// GTM-SEO-COMPARE-01 — shared renderer for every competitor-comparison article.
//
// Plain long-form prose: H1, a muted "Last updated" line, body copy with H2
// section breaks, a one-line signature, and a single plain-text App Store link.
//
// DELIBERATELY ABSENT, and not an oversight: no author avatar, no tags or
// category chips, no reading-time badge, no related-posts strip, no share
// buttons, no hero image. Those read as content-marketing tooling and work
// against the register this site holds. If a future article needs one, that is a
// decision to take on purpose, not by adding a prop here.
//
// Layout primitives (nav, section width, footer, type scale) are lifted from the
// /plans pages so this content type carries the same visual weight as the rest
// of the marketing site. Colour and type come from globals.css tokens only.

import Link from 'next/link'
import { BRAND } from '@/lib/brand'
import { Wordmark } from '@/components/ui/Wordmark'
import { comparisonArticleJsonLd, type ComparisonArticle, type ArticleSpan } from '@/lib/marketing/comparisons'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://zonna.run'
const SECTION_MAX = 760

/** Inline text links only. No button or CTA styling in this content type. */
const LINK_STYLE = { color: 'var(--moss)', fontWeight: 600, textDecoration: 'underline' } as const

const BODY_STYLE = {
  fontSize: 17,
  lineHeight: 1.65,
  color: 'var(--ink-2)',
  margin: '0 0 20px',
  maxWidth: 640,
} as const

function renderSpans(spans: ArticleSpan[]) {
  return spans.map((span, i) => {
    if (typeof span === 'string') return <span key={i}>{span}</span>
    // Internal routes go through next/link (the repo's internal-nav pattern);
    // anything absolute stays a plain anchor.
    return span.href.startsWith('/')
      ? <Link key={i} href={span.href} style={LINK_STYLE}>{span.text}</Link>
      : <a key={i} href={span.href} style={LINK_STYLE}>{span.text}</a>
  })
}

export function ComparisonPage({ article }: { article: ComparisonArticle }) {
  const url = `${APP_URL}/${article.slug}`

  const breadcrumbLd = {
    '@context': 'https://schema.org', '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: APP_URL },
      { '@type': 'ListItem', position: 2, name: article.h1, item: url },
    ],
  }

  // schema.org Article. Built by the shared wiring in comparisons.ts, which
  // reads `dateModified` from the same field as the visible "Last updated" line.
  const articleLd = comparisonArticleJsonLd(article)

  return (
    <main style={{ background: 'var(--bg)', color: 'var(--ink)', minHeight: '100vh', fontFamily: 'var(--font-ui)' }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleLd) }} />

      <nav style={{ maxWidth: SECTION_MAX, margin: '0 auto', padding: '20px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Link href="/" style={{ textDecoration: 'none' }} aria-label={`${BRAND.name} home`}><Wordmark /></Link>
        <a href={BRAND.appStore.url} style={{ fontSize: 14, fontWeight: 600, color: 'var(--moss)', textDecoration: 'none' }}>Get the app →</a>
      </nav>

      <article style={{ maxWidth: SECTION_MAX, margin: '0 auto', padding: '28px 24px 8px' }}>
        <h1 style={{ fontFamily: 'var(--font-brand)', fontSize: 'clamp(28px, 5.5vw, 44px)', fontWeight: 800, lineHeight: 1.08, letterSpacing: '-0.02em', color: 'var(--ink)', margin: '0 0 12px' }}>
          {article.h1}
        </h1>

        <p style={{ fontSize: 13.5, color: 'var(--mute)', margin: '0 0 28px' }}>
          Last updated: <time dateTime={article.lastUpdatedISO}>{article.lastUpdated}</time>
        </p>

        {article.body.map((block, i) =>
          block.kind === 'h2' ? (
            <h2 key={i} style={{ fontFamily: 'var(--font-brand)', fontSize: 22, fontWeight: 800, letterSpacing: '-0.01em', color: 'var(--ink)', margin: '32px 0 12px' }}>
              {block.text}
            </h2>
          ) : (
            <p key={i} style={BODY_STYLE}>{renderSpans(block.spans)}</p>
          ),
        )}

        <p style={{ fontSize: 13.5, lineHeight: 1.6, color: 'var(--mute)', margin: '32px 0 20px', maxWidth: 640 }}>
          {article.signature}
        </p>

        <p style={{ fontSize: 15.5, margin: '0 0 8px' }}>
          <a href={BRAND.appStore.url} style={LINK_STYLE}>{article.appStoreLinkText}</a>
        </p>
      </article>

      <footer style={{ maxWidth: SECTION_MAX, margin: '36px auto 0', padding: '36px 24px 48px', borderTop: '1px solid var(--line)' }}>
        <p style={{ fontFamily: 'var(--font-brand)', fontSize: 15, fontWeight: 700, color: 'var(--ink-2)', margin: '0 0 16px' }}>{BRAND.brandStatement}</p>
        <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', fontSize: 13 }}>
          <Link href="/" style={{ color: 'var(--mute)', textDecoration: 'none' }}>Home</Link>
          <Link href="/plans" style={{ color: 'var(--mute)', textDecoration: 'none' }}>Plans</Link>
          <Link href="/compare" style={{ color: 'var(--mute)', textDecoration: 'none' }}>Comparisons</Link>
          <Link href="/support" style={{ color: 'var(--mute)', textDecoration: 'none' }}>Support</Link>
          <Link href="/privacy" style={{ color: 'var(--mute)', textDecoration: 'none' }}>Privacy</Link>
          <Link href="/terms" style={{ color: 'var(--mute)', textDecoration: 'none' }}>Terms</Link>
        </div>
      </footer>
    </main>
  )
}

/** Metadata builder shared by every comparison route, so the eight pages cannot
 *  drift in canonical/OG shape. Mirrors the /plans `generateMetadata` output. */
export function comparisonMetadata(article: ComparisonArticle) {
  const url = `${APP_URL}/${article.slug}`
  return {
    title: article.metaTitle,
    description: article.metaDescription,
    alternates: { canonical: url },
    openGraph: {
      title: article.ogTitle,
      description: article.ogDescription,
      url,
      siteName: BRAND.name,
      type: 'article' as const,
      // Next merges metadata SHALLOWLY: a page that defines `openGraph` replaces
      // the root layout's object outright rather than merging into it, so the
      // site-wide og:image is dropped unless it is restated. Verified in the
      // prerendered HTML — /plans has no og:image for exactly this reason.
      images: [{ url: `${APP_URL}/api/og`, width: 1200, height: 630, alt: article.h1 }],
    },
    // Same shallow-merge rule, opposite symptom: without this block the page
    // inherits the root layout's GENERIC twitter card, so every comparison page
    // would share one title and description on social regardless of subject.
    twitter: {
      card: 'summary_large_image' as const,
      title: article.ogTitle,
      description: article.ogDescription,
      images: [`${APP_URL}/api/og`],
    },
  }
}
