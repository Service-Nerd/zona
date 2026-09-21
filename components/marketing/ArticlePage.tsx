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
import { SiteHeader, type SiteSection } from '@/components/marketing/SiteHeader'
import { SiteFooter } from '@/components/marketing/SiteFooter'
import { articlePath, guidesArePublished, marketingArticleJsonLd, COMPARISON_HUB, GUIDE_HUB, type MarketingArticle, type ArticleSpan, type ArticleBlock } from '@/lib/marketing/articles'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.zonna.run'
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

export function ArticlePage({ article }: { article: MarketingArticle }) {
  const url = `${APP_URL}${articlePath(article)}`

  const hub = article.kind === 'guide'
    ? { slug: GUIDE_HUB.slug, label: 'Guides', section: 'guides' as SiteSection, published: guidesArePublished() }
    : { slug: COMPARISON_HUB.slug, label: 'Comparisons', section: 'comparisons' as SiteSection, published: true }

  const breadcrumbLd = {
    '@context': 'https://schema.org', '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: APP_URL },
      // ⚠️ This hardcoded 'Comparisons' and `/comparisons` until 2026-09-21,
      // so a GUIDE's structured data told crawlers it sat under the comparison
      // hub. Worse than the visible breadcrumb being wrong, because nobody
      // looks at it. It follows the article's kind now, like everything else.
      { '@type': 'ListItem', position: 2, name: hub.label, item: `${APP_URL}/${hub.slug}` },
      { '@type': 'ListItem', position: 3, name: article.h1, item: url },
    ],
  }

  // schema.org Article. Built by the shared wiring in comparisons.ts, which
  // reads `dateModified` from the same field as the visible "Last updated" line.
  const articleLd = marketingArticleJsonLd(article)

  return (
    <main style={{ background: 'var(--bg)', color: 'var(--ink)', minHeight: '100vh', fontFamily: 'var(--font-ui)' }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleLd) }} />

      {/* W-01 — the breadcrumb and the active nav item follow the article's
          KIND. A guide reached from search must say it is a guide, not sit
          under Comparisons; that was the first thing to break when this
          renderer stopped serving one hub. */}
      <SiteHeader current={hub.section} />

      {/* GTM-SITE-01 — the plan spokes carried a breadcrumb and the comparison
          articles did not, so a reader arriving from search had no sense of
          where the page sat. Same markup and same type scale as PlanPage. */}
      <nav aria-label="Breadcrumb" style={{ maxWidth: SECTION_MAX, margin: '0 auto', padding: '20px 24px 0' }}>
        <ol style={{ display: 'flex', gap: 8, listStyle: 'none', padding: 0, margin: 0, fontSize: 13, color: 'var(--mute)', flexWrap: 'wrap' }}>
          <li><Link href="/" style={{ color: 'var(--mute)', textDecoration: 'none' }}>Home</Link></li>
          <li aria-hidden>›</li>
          {/* ⚠️ NOT A LINK WHEN THE HUB IS NOT PUBLISHED. The guides hub 404s
              until `GUIDES_MIN_TO_PUBLISH` is met, and on `/guide-preview` —
              which exists precisely so a draft can be read before the gate
              opens — this breadcrumb was pointing at that 404. A crumb that
              leads nowhere is worse than no crumb: it reads as a broken site
              rather than an unopened section. */}
          <li>
            {hub.published
              ? <Link href={`/${hub.slug}`} style={{ color: 'var(--mute)', textDecoration: 'none' }}>{hub.label}</Link>
              : <span style={{ color: 'var(--mute)' }}>{hub.label}</span>}
          </li>
          <li aria-hidden>›</li>
          <li aria-current="page" style={{ color: 'var(--ink-2)' }}>{article.h1}</li>
        </ol>
      </nav>

      <article style={{ maxWidth: SECTION_MAX, margin: '0 auto', padding: '16px 24px 8px' }}>
        <h1 style={{ fontFamily: 'var(--font-brand)', fontSize: 'clamp(28px, 5.5vw, 44px)', fontWeight: 800, lineHeight: 1.08, letterSpacing: '-0.02em', color: 'var(--ink)', margin: '0 0 12px' }}>
          {article.h1}
        </h1>

        <p style={{ fontSize: 13.5, color: 'var(--mute)', margin: '0 0 28px' }}>
          Last updated: <time dateTime={article.lastUpdatedISO}>{article.lastUpdated}</time>
        </p>

        {article.body.map((block, i) => {
          if (block.kind === 'h2') return (
            <h2 key={i} style={{ fontFamily: 'var(--font-brand)', fontSize: 22, fontWeight: 800, letterSpacing: '-0.01em', color: 'var(--ink)', margin: '32px 0 12px' }}>
              {block.text}
            </h2>
          )
          if (block.kind === 'table') return <ArticleTable key={i} block={block} />
          return <p key={i} style={BODY_STYLE}>{renderSpans(block.spans)}</p>
        })}

        <p style={{ fontSize: 13.5, lineHeight: 1.6, color: 'var(--mute)', margin: '32px 0 20px', maxWidth: 640 }}>
          {article.signature}
        </p>

        <p style={{ fontSize: 15.5, margin: '0 0 8px' }}>
          <a href={BRAND.appStore.url} style={LINK_STYLE}>{article.appStoreLinkText}</a>
        </p>
      </article>

      <SiteFooter />
    </main>
  )
}

/** A plain comparison table. No card, no shadow, no new colour: the SEO brief
 *  calls readable in-page cells better than a graphic, and a bordered grid in
 *  the existing tokens is the whole design.
 *
 *  The `overflow-x: auto` wrapper is not optional. A four-column table of
 *  prices does not fit 400px, and CLAUDE.md's responsive rule is that a table
 *  scrolls inside its own container rather than making the page body scroll. */
function ArticleTable({ block }: { block: Extract<ArticleBlock, { kind: 'table' }> }) {
  const cell = {
    padding: '10px 12px',
    borderBottom: '1px solid var(--line)',
    fontSize: 14.5,
    lineHeight: 1.45,
    textAlign: 'left' as const,
    verticalAlign: 'top' as const,
  }
  return (
    <div style={{ overflowX: 'auto', margin: '0 0 24px', maxWidth: '100%' }}>
      {/* `table-layout: fixed` so the three product columns are equal and the
          row-label column cannot eat the width. `min-width` is the point at
          which it starts scrolling instead of crushing: below about 500px the
          cells stop being readable. */}
      <table style={{ borderCollapse: 'collapse', tableLayout: 'fixed', minWidth: 500, width: '100%' }}>
        <colgroup>
          <col style={{ width: '25%' }} />
          {block.head.slice(1).map((_, i) => <col key={i} style={{ width: `${75 / (block.head.length - 1)}%` }} />)}
        </colgroup>
        {/* Named for screen readers and search, not shown: the h2 above already
            titles this block, so a visible caption would just repeat it. */}
        <caption style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)', whiteSpace: 'nowrap' }}>
          {block.caption}
        </caption>
        <thead>
          <tr>
            {block.head.map((h, i) => (
              <th key={i} scope="col" style={{
                ...cell,
                borderBottom: '1px solid var(--ink)',
                fontFamily: 'var(--font-brand)',
                fontSize: 12,
                fontWeight: 700,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                color: 'var(--mute)',
              }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {block.rows.map((row, r) => (
            <tr key={r}>
              {row.map((c, i) => i === 0
                ? <th key={i} scope="row" style={{ ...cell, fontWeight: 600, color: 'var(--ink)' }}>{c}</th>
                : <td key={i} style={{ ...cell, color: 'var(--ink-2)' }}>{c}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/** Metadata builder shared by every comparison route, so the eight pages cannot
 *  drift in canonical/OG shape. Mirrors the /plans `generateMetadata` output. */
export function articleMetadata(article: MarketingArticle) {
  const url = `${APP_URL}${articlePath(article)}`
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
