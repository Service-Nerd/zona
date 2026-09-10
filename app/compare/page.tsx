// GTM-SEO-COMPARE-01 — the /compare hub.
//
// Lists every comparison article. Same job as the /plans hub: the internal-link
// hub that passes authority to each spoke, and a search target in its own right.
// Built off COMPARISON_ARTICLES, so pages 2 through 8 appear here the moment
// they are added to the catalogue and nobody has to remember this file.
//
// This exists because the comparison pages had ZERO inbound internal links.
// They were reachable only by direct URL or from search, which meant no internal
// link equity reached them and nobody already on the site could ever find the
// most commercially direct writing on it.

import type { Metadata } from 'next'
import Link from 'next/link'
import { BRAND } from '@/lib/brand'
import { Wordmark } from '@/components/ui/Wordmark'
import { COMPARISON_ARTICLES, COMPARISON_HUB } from '@/lib/marketing/comparisons'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://zonna.run'
const SECTION_MAX = 760

export const revalidate = 86400

export const metadata: Metadata = {
  title: COMPARISON_HUB.metaTitle,
  description: COMPARISON_HUB.metaDescription,
  alternates: { canonical: `${APP_URL}/${COMPARISON_HUB.slug}` },
  openGraph: {
    title: COMPARISON_HUB.h1,
    description: COMPARISON_HUB.metaDescription,
    url: `${APP_URL}/${COMPARISON_HUB.slug}`,
    siteName: BRAND.name,
    type: 'website',
    // Restated deliberately: Next replaces the root layout's `openGraph` object
    // rather than merging into it, so omitting this drops the site og:image.
    images: [{ url: `${APP_URL}/api/og`, width: 1200, height: 630, alt: COMPARISON_HUB.h1 }],
  },
  twitter: {
    card: 'summary_large_image',
    title: COMPARISON_HUB.h1,
    description: COMPARISON_HUB.metaDescription,
    images: [`${APP_URL}/api/og`],
  },
}

export default function ComparisonHubPage() {
  const ld = {
    '@context': 'https://schema.org', '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: APP_URL },
      { '@type': 'ListItem', position: 2, name: 'Comparisons', item: `${APP_URL}/${COMPARISON_HUB.slug}` },
    ],
  }

  return (
    <main style={{ background: 'var(--bg)', color: 'var(--ink)', minHeight: '100vh', fontFamily: 'var(--font-ui)' }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld) }} />

      <nav style={{ maxWidth: SECTION_MAX, margin: '0 auto', padding: '20px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Link href="/" style={{ textDecoration: 'none' }} aria-label={`${BRAND.name} home`}><Wordmark /></Link>
        <a href={BRAND.appStore.url} style={{ fontSize: 14, fontWeight: 600, color: 'var(--moss)', textDecoration: 'none' }}>Get the app →</a>
      </nav>

      <section style={{ maxWidth: SECTION_MAX, margin: '0 auto', padding: '28px 24px 8px' }}>
        <p style={{ fontFamily: 'var(--font-brand)', fontSize: 13, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--moss)', margin: '0 0 14px' }}>
          {COMPARISON_HUB.eyebrow}
        </p>
        <h1 style={{ fontFamily: 'var(--font-brand)', fontSize: 'clamp(28px, 5.5vw, 44px)', fontWeight: 800, lineHeight: 1.08, letterSpacing: '-0.02em', color: 'var(--ink)', margin: '0 0 18px' }}>
          {COMPARISON_HUB.h1}
        </h1>
        <p style={{ fontSize: 18, lineHeight: 1.55, color: 'var(--ink-2)', margin: '0 0 8px', maxWidth: 620 }}>
          {COMPARISON_HUB.sub}
        </p>
      </section>

      <section style={{ maxWidth: SECTION_MAX, margin: '0 auto', padding: '16px 24px 8px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {COMPARISON_ARTICLES.map(a => (
            <Link key={a.slug} href={`/${a.slug}`} style={{ textDecoration: 'none' }}>
              <div style={{ background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 14, padding: '18px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16 }}>
                <div>
                  <div style={{ fontFamily: 'var(--font-brand)', fontSize: 18, fontWeight: 800, color: 'var(--ink)' }}>{a.metaTitle}</div>
                  <div style={{ fontSize: 13.5, color: 'var(--mute)', marginTop: 3, maxWidth: 520 }}>{a.hubSummary}</div>
                  <div style={{ fontSize: 12.5, color: 'var(--mute)', marginTop: 6 }}>
                    Updated <time dateTime={a.lastUpdatedISO}>{a.lastUpdated}</time>
                  </div>
                </div>
                <span style={{ fontSize: 18, color: 'var(--moss)', flexShrink: 0 }} aria-hidden>→</span>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section style={{ maxWidth: SECTION_MAX, margin: '0 auto', padding: '28px 24px 8px' }}>
        <div style={{ borderLeft: '3px solid var(--moss)', paddingLeft: 18 }}>
          <p style={{ fontSize: 15.5, lineHeight: 1.6, color: 'var(--ink-2)', margin: 0, maxWidth: 620 }}>
            Every plan {BRAND.name} publishes is free to read before you pay anyone for anything.{' '}
            <Link href="/plans" style={{ color: 'var(--moss)', fontWeight: 600, textDecoration: 'none' }}>See the plans →</Link>
          </p>
        </div>
      </section>

      <footer style={{ maxWidth: SECTION_MAX, margin: '36px auto 0', padding: '36px 24px 48px', borderTop: '1px solid var(--line)' }}>
        <p style={{ fontFamily: 'var(--font-brand)', fontSize: 15, fontWeight: 700, color: 'var(--ink-2)', margin: '0 0 16px' }}>{BRAND.brandStatement}</p>
        <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', fontSize: 13 }}>
          <Link href="/" style={{ color: 'var(--mute)', textDecoration: 'none' }}>Home</Link>
          <Link href="/plans" style={{ color: 'var(--mute)', textDecoration: 'none' }}>Plans</Link>
          <Link href="/support" style={{ color: 'var(--mute)', textDecoration: 'none' }}>Support</Link>
          <Link href="/privacy" style={{ color: 'var(--mute)', textDecoration: 'none' }}>Privacy</Link>
          <Link href="/terms" style={{ color: 'var(--mute)', textDecoration: 'none' }}>Terms</Link>
        </div>
      </footer>
    </main>
  )
}
