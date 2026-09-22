// GTM-SEO-PLANS-01 — the /plans hub. Lists every free plan; the internal-link
// hub that passes authority to each spoke, and an SEO target in its own right.

import type { Metadata } from 'next'
import { Section } from '@/components/marketing/Section'
import Link from 'next/link'
import { BRAND } from '@/lib/brand'
import { pageMetadata } from '@/lib/marketing/siteMeta'
import { SiteHeader } from '@/components/marketing/SiteHeader'
import { SiteFooter } from '@/components/marketing/SiteFooter'
import { MARKETING_PLANS, planCardTitle } from '@/lib/marketing/plans'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.zonna.run'
const SECTION_MAX = 760

export const revalidate = 86400

export const metadata: Metadata = pageMetadata({
  title: `Free Running Training Plans`,
  description:
    `Free 5K, 10K, half marathon and marathon training plans built to stop you overtraining. Mostly easy running, every run zoned. For the day-job runner.`,
  path: '/plans',
  ogTitle: `Free running training plans | ${BRAND.name}`,
  ogDescription: `5K to marathon. Mostly easy running, every run zoned. Read them free, then get the version that adapts to you.`,
  ogImageTitle: 'Free running training plans',
})

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

      <SiteHeader current="plans" />

      {/* SITE-WAVE-1a-ii — adopted <Section> 2026-09-22 (Design Board sitting
          one). ZERO VISUAL DELTA is this wave's contract: `width="full"` +
          `rhythm="none"` hand the inner div exactly the maxWidth, margin and
          padding the raw <section> had, and the outer band declares the `--bg`
          it was already inheriting from <main>.
          The point is not tidiness — it is that `surface=` now EXISTS on this
          page, so wave 1b can spend a ground here. It could not before.
          ⚠️ FOR WAVE 1B: the rhythm below is preserved, not endorsed. */}
      <Section width="full" rhythm="none"
        innerStyle={{ maxWidth: SECTION_MAX, margin: '0 auto', padding: '28px 24px 8px' }}>
        <p style={{ fontFamily: 'var(--font-brand)', fontSize: 'var(--fs-sm)', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--moss-strong)', margin: '0 0 14px' }}>
          Free training plans
        </p>
        <h1 style={{ fontFamily: 'var(--font-brand)', fontSize: 'var(--fs-h1)', fontWeight: 800, lineHeight: 1.08, letterSpacing: '-0.02em', color: 'var(--ink)', margin: '0 0 18px' }}>
          Running plans that stop you overtraining.
        </h1>
        <p style={{ fontSize: 'var(--fs-lead-lg)', lineHeight: 1.55, color: 'var(--ink-2)', margin: '0 0 8px', maxWidth: 600 }}>
          5K to marathon. Mostly easy running, one quality session a week, every run zoned.
          Read any of them free. No signup, no wall.
        </p>
      </Section>

      {([
        { key: 'distance', label: 'By distance' },
        { key: 'goal', label: 'By goal time' },
      ] as const).map(group => {
        const items = MARKETING_PLANS.filter(p => (p.group ?? 'distance') === group.key)
        if (items.length === 0) return null
        return (
          <Section key={group.key} width="full" rhythm="none"
            innerStyle={{ maxWidth: SECTION_MAX, margin: '0 auto', padding: '16px 24px 8px' }}>
            <h2 style={{ fontFamily: 'var(--font-brand)', fontSize: 'var(--fs-caption)', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--moss-strong)', margin: '0 0 12px' }}>{group.label}</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {items.map(p => (
                <Link key={p.slug} href={`/plans/${p.slug}`} style={{ textDecoration: 'none' }}>
                  <div style={{ background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 14, padding: '18px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16 }}>
                    <div>
                      <div style={{ fontFamily: 'var(--font-brand)', fontSize: 'var(--fs-lead-lg)', fontWeight: 800, color: 'var(--ink)' }}>{planCardTitle(p)}</div>
                      <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--mute)', marginTop: 3, maxWidth: 520 }}>{p.whoFor}</div>
                    </div>
                    <span style={{ fontSize: 'var(--fs-lead-lg)', color: 'var(--moss-strong)', flexShrink: 0 }} aria-hidden>→</span>
                  </div>
                </Link>
              ))}
            </div>
          </Section>
        )
      })}

      <Section width="full" rhythm="none"
        innerStyle={{ maxWidth: SECTION_MAX, margin: '0 auto', padding: '28px 24px 8px' }}>
        <div style={{ borderLeft: '3px solid var(--moss)', paddingLeft: 18 }}>
          <p style={{ fontSize: 'var(--fs-body-lg)', lineHeight: 1.6, color: 'var(--ink-2)', margin: 0, maxWidth: 620 }}>
            Every plan here is the flat version. The app takes the same plan and adapts it:
            your real heart-rate zones, your week, your race, and moves the sessions when life
            gets in the way. <a href={BRAND.appStore.url} style={{ color: 'var(--moss-strong)', fontWeight: 600, textDecoration: 'none' }}>Start free in the app →</a>
          </p>
        </div>
      </Section>

      {/* GTM-CHARITY-01 — internal link so the charity landing page is not an
          SEO orphan. It is deliberately NOT in the site nav: that stays two
          items by SLT ruling, and this is a referral landing page rather than a
          content section people browse to. */}
      <Section width="full" rhythm="none"
        innerStyle={{ maxWidth: SECTION_MAX, margin: '0 auto', padding: '18px 24px 8px' }}>
        <p style={{ fontSize: 'var(--fs-body-lg)', lineHeight: 1.6, color: 'var(--ink-2)', margin: 0, maxWidth: 620 }}>
          Running on a charity place? The risk is not the distance, it is getting hurt
          before race day.{' '}
          <Link href="/charity-runners" style={{ color: 'var(--moss-strong)', fontWeight: 600, textDecoration: 'none' }}>
            Read this first &rarr;
          </Link>
        </p>
      </Section>

      <Section width="full" rhythm="none"
        innerStyle={{ maxWidth: SECTION_MAX, margin: '0 auto', padding: '18px 24px 8px' }}>
        <p style={{ fontSize: 'var(--fs-body-lg)', lineHeight: 1.6, color: 'var(--ink-2)', margin: 0, maxWidth: 620 }}>
          Weighing up apps rather than plans? The comparisons are honest about where {BRAND.name} is
          the wrong answer.{' '}
          <Link href="/comparisons" style={{ color: 'var(--moss-strong)', fontWeight: 600, textDecoration: 'none' }}>
            Compare the options &rarr;
          </Link>
        </p>
      </Section>

      <SiteFooter />
    </main>
  )
}
