// W-01 (2026-09-21) — the shared hub for both article kinds.
//
// ⚠️ EXTRACTED RATHER THAN COPIED. `/guides` needed the same page `/comparisons`
// already had: eyebrow, h1, sub, a list of cards, a closing free-plans rail,
// BreadcrumbList JSON-LD. Copying it would have produced a second 90-line
// renderer to keep in step by hand, which is the failure this codebase names
// most often and the reason `articles.ts` exists at all rather than a third
// catalogue.
//
// Presentational and server-rendered: no hooks, no client directive.

import Link from 'next/link'
import { BRAND } from '@/lib/brand'
import { pageMetadata } from '@/lib/marketing/siteMeta'
import { SiteHeader, type SiteSection } from '@/components/marketing/SiteHeader'
import { SiteFooter } from '@/components/marketing/SiteFooter'
import { articlePath, type MarketingArticle } from '@/lib/marketing/articles'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.zonna.run'
const SECTION_MAX = 760

export interface HubCopy {
  slug: string
  eyebrow: string
  h1: string
  sub: string
  metaTitle: string
  metaDescription: string
}

export function ArticleHub({
  hub, articles, section, breadcrumbLabel, youngNote, siblingHub,
  groups,
}: {
  hub: HubCopy
  articles: MarketingArticle[]
  section: SiteSection
  breadcrumbLabel: string
  /** The other content hub. Each section is a dead end without it: a reader
   *  who finishes the guides has no route to the comparisons and vice versa,
   *  and the footer is the only thing joining them today. */
  siblingHub?: { href: string; label: string }
  /** Intent buckets. Passed only when the hub should group (see
   *  `shouldGroupGuides`); omitted or single-bucket renders flat. */
  groups?: { id: string; label: string; articles: MarketingArticle[] }[]
  /** Shown above the cards while the section is still small. Answers the
   *  failure the publish gate used to prevent: a one-card index reads as
   *  abandoned unless it tells you it is deliberate. Omit once the section
   *  stands on its own. */
  youngNote?: string
}) {
  const ld = {
    '@context': 'https://schema.org', '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: APP_URL },
      { '@type': 'ListItem', position: 2, name: breadcrumbLabel, item: `${APP_URL}/${hub.slug}` },
    ],
  }

  return (
    <main style={{ background: 'var(--bg)', color: 'var(--ink)', minHeight: '100vh', fontFamily: 'var(--font-ui)' }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld) }} />

      <SiteHeader current={section} />

      <section style={{ maxWidth: SECTION_MAX, margin: '0 auto', padding: '28px 24px 8px' }}>
        <p style={{ fontFamily: 'var(--font-brand)', fontSize: 'var(--fs-sm)', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--moss-strong)', margin: '0 0 14px' }}>
          {hub.eyebrow}
        </p>
        <h1 style={{ fontFamily: 'var(--font-brand)', fontSize: 'var(--fs-h1)', fontWeight: 800, lineHeight: 1.08, letterSpacing: '-0.02em', color: 'var(--ink)', margin: '0 0 18px' }}>
          {hub.h1}
        </h1>
        <p style={{ fontSize: 'var(--fs-lead-lg)', lineHeight: 1.55, color: 'var(--ink-2)', margin: '0 0 8px', maxWidth: 620 }}>
          {hub.sub}
        </p>
      </section>

      <section style={{ maxWidth: SECTION_MAX, margin: '0 auto', padding: '16px 24px 8px' }}>
        {youngNote && (
          <p style={{
            fontSize: 'var(--fs-body)', lineHeight: 1.55, color: 'var(--mute)',
            margin: '0 0 18px', paddingLeft: 14, borderLeft: '2px solid var(--line)',
            maxWidth: 560,
          }}>
            {youngNote}
          </p>
        )}
        {/* W-01c — grouped by what the reader came to find out, and flat
            until there is enough to group. `groups` is passed only by the
            guide hub, and only once two buckets have something in them: four
            headings over one article advertises three empty rooms, which is
            exactly the "reads as abandoned" objection the hub gate exists
            for. */}
        {groups && groups.length > 1 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 30 }}>
            {groups.map(g => (
              <div key={g.id}>
                <h2 style={{
                  fontFamily: 'var(--font-brand)', fontSize: 'var(--fs-eyebrow)', fontWeight: 700,
                  letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--mute)',
                  margin: '0 0 12px',
                }}>
                  {g.label}
                </h2>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {g.articles.map(a => (
                <Link key={a.slug} href={articlePath(a)} style={{ textDecoration: 'none' }}>
                  <div style={{ background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 14, padding: '18px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16 }}>
                    <div>
                      <div style={{ fontFamily: 'var(--font-brand)', fontSize: 'var(--fs-lead-lg)', fontWeight: 800, color: 'var(--ink)' }}>{a.metaTitle}</div>
                      <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--mute)', marginTop: 3, maxWidth: 520 }}>{a.hubSummary}</div>
                      <div style={{ fontSize: 'var(--fs-caption)', color: 'var(--mute)', marginTop: 6 }}>
                        Updated <time dateTime={a.lastUpdatedISO}>{a.lastUpdated}</time>
                      </div>
                    </div>
                    <span style={{ fontSize: 'var(--fs-lead-lg)', color: 'var(--moss-strong)', flexShrink: 0 }} aria-hidden>→</span>
                  </div>
                </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {articles.map(a => (
            <Link key={a.slug} href={articlePath(a)} style={{ textDecoration: 'none' }}>
              <div style={{ background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 14, padding: '18px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16 }}>
                <div>
                  <div style={{ fontFamily: 'var(--font-brand)', fontSize: 'var(--fs-lead-lg)', fontWeight: 800, color: 'var(--ink)' }}>{a.metaTitle}</div>
                  <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--mute)', marginTop: 3, maxWidth: 520 }}>{a.hubSummary}</div>
                  <div style={{ fontSize: 'var(--fs-caption)', color: 'var(--mute)', marginTop: 6 }}>
                    Updated <time dateTime={a.lastUpdatedISO}>{a.lastUpdated}</time>
                  </div>
                </div>
                <span style={{ fontSize: 'var(--fs-lead-lg)', color: 'var(--moss-strong)', flexShrink: 0 }} aria-hidden>→</span>
              </div>
            </Link>
            ))}
          </div>
        )}
      </section>

      <section style={{ maxWidth: SECTION_MAX, margin: '0 auto', padding: '28px 24px 8px' }}>
        <div style={{ borderLeft: '3px solid var(--moss)', paddingLeft: 18 }}>
          <p style={{ fontSize: 'var(--fs-body-lg)', lineHeight: 1.6, color: 'var(--ink-2)', margin: 0, maxWidth: 620 }}>
            Every plan {BRAND.name} publishes is free to read before you pay anyone for anything.{' '}
            <Link href="/plans" style={{ color: 'var(--moss-strong)', fontWeight: 600, textDecoration: 'none' }}>See the plans &rarr;</Link>
          </p>
          {siblingHub && (
            <p style={{ fontSize: 'var(--fs-body-lg)', lineHeight: 1.6, color: 'var(--ink-2)', margin: '10px 0 0', maxWidth: 620 }}>
              <Link href={siblingHub.href} style={{ color: 'var(--moss-strong)', fontWeight: 600, textDecoration: 'none' }}>
                {siblingHub.label} &rarr;
              </Link>
            </p>
          )}
        </div>
      </section>

      <SiteFooter />
    </main>
  )
}

/** Metadata shared by both hubs, so canonical/OG/Twitter cannot drift apart.
 *  Mirrors `articleMetadata` in ArticlePage, including the restated og:image
 *  (Next replaces the root layout's `openGraph` rather than merging into it). */
export function hubMetadata(hub: HubCopy) {
  return pageMetadata({
    title: hub.metaTitle,
    brandInTitle: hub.metaTitle.includes(BRAND.name),
    description: hub.metaDescription,
    path: `/${hub.slug}`,
    ogTitle: hub.h1,
    ogDescription: hub.metaDescription,
    ogImageTitle: hub.h1,
  })
}
