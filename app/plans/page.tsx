// GTM-SEO-PLANS-01 — the /plans hub. Lists every free plan; the internal-link
// hub that passes authority to each spoke, and an SEO target in its own right.

import type { Metadata } from 'next'
import Link from 'next/link'
import { BRAND } from '@/lib/brand'
import { Wordmark } from '@/components/ui/Wordmark'
import { MARKETING_PLANS, planCardTitle } from '@/lib/marketing/plans'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://zonna.run'
const SECTION_MAX = 760

export const revalidate = 86400

export const metadata: Metadata = {
  title: `Free Running Training Plans | ${BRAND.name}`,
  description:
    `Free 5K, 10K, half marathon and marathon training plans built to stop you overtraining. Mostly easy running, every run zoned. For the day-job runner.`,
  alternates: { canonical: `${APP_URL}/plans` },
  openGraph: {
    title: `Free running training plans — ${BRAND.name}`,
    description: `5K to marathon. Mostly easy running, every run zoned. Read them free, then get the version that adapts to you.`,
    url: `${APP_URL}/plans`,
    siteName: BRAND.name,
    type: 'website',
  },
}

export default function PlansHubPage() {
  const ld = {
    '@context': 'https://schema.org', '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: APP_URL },
      { '@type': 'ListItem', position: 2, name: 'Plans', item: `${APP_URL}/plans` },
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
          Free training plans
        </p>
        <h1 style={{ fontFamily: 'var(--font-brand)', fontSize: 'clamp(28px, 5.5vw, 44px)', fontWeight: 800, lineHeight: 1.08, letterSpacing: '-0.02em', color: 'var(--ink)', margin: '0 0 18px' }}>
          Running plans that stop you overtraining.
        </h1>
        <p style={{ fontSize: 18, lineHeight: 1.55, color: 'var(--ink-2)', margin: '0 0 8px', maxWidth: 600 }}>
          5K to marathon. Mostly easy running, one quality session a week, every run zoned.
          Read any of them free &mdash; no signup, no wall.
        </p>
      </section>

      {([
        { key: 'distance', label: 'By distance' },
        { key: 'goal', label: 'By goal time' },
      ] as const).map(group => {
        const items = MARKETING_PLANS.filter(p => (p.group ?? 'distance') === group.key)
        if (items.length === 0) return null
        return (
          <section key={group.key} style={{ maxWidth: SECTION_MAX, margin: '0 auto', padding: '16px 24px 8px' }}>
            <h2 style={{ fontFamily: 'var(--font-brand)', fontSize: 12, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--moss)', margin: '0 0 12px' }}>{group.label}</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {items.map(p => (
                <Link key={p.slug} href={`/plans/${p.slug}`} style={{ textDecoration: 'none' }}>
                  <div style={{ background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 14, padding: '18px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16 }}>
                    <div>
                      <div style={{ fontFamily: 'var(--font-brand)', fontSize: 18, fontWeight: 800, color: 'var(--ink)' }}>{planCardTitle(p)}</div>
                      <div style={{ fontSize: 13.5, color: 'var(--mute)', marginTop: 3, maxWidth: 520 }}>{p.whoFor}</div>
                    </div>
                    <span style={{ fontSize: 18, color: 'var(--moss)', flexShrink: 0 }} aria-hidden>→</span>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )
      })}

      <section style={{ maxWidth: SECTION_MAX, margin: '0 auto', padding: '28px 24px 8px' }}>
        <div style={{ borderLeft: '3px solid var(--moss)', paddingLeft: 18 }}>
          <p style={{ fontSize: 15.5, lineHeight: 1.6, color: 'var(--ink-2)', margin: 0, maxWidth: 620 }}>
            Every plan here is the flat version. The app takes the same plan and adapts it &mdash;
            your real heart-rate zones, your week, your race &mdash; and moves the sessions when life
            gets in the way. <a href={BRAND.appStore.url} style={{ color: 'var(--moss)', fontWeight: 600, textDecoration: 'none' }}>Start free in the app →</a>
          </p>
        </div>
      </section>

      <footer style={{ maxWidth: SECTION_MAX, margin: '36px auto 0', padding: '36px 24px 48px', borderTop: '1px solid var(--line)' }}>
        <p style={{ fontFamily: 'var(--font-brand)', fontSize: 15, fontWeight: 700, color: 'var(--ink-2)', margin: '0 0 16px' }}>{BRAND.brandStatement}</p>
        <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', fontSize: 13 }}>
          <Link href="/" style={{ color: 'var(--mute)', textDecoration: 'none' }}>Home</Link>
          <Link href="/support" style={{ color: 'var(--mute)', textDecoration: 'none' }}>Support</Link>
          <Link href="/privacy" style={{ color: 'var(--mute)', textDecoration: 'none' }}>Privacy</Link>
          <Link href="/terms" style={{ color: 'var(--mute)', textDecoration: 'none' }}>Terms</Link>
        </div>
      </footer>
    </main>
  )
}
