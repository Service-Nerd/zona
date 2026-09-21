// GTM-SITE-02 — /pricing.
//
// WHY IT EXISTS. There was no pricing page at all. The SLT called that a
// commercial defect rather than a design one: a charity partner deciding
// whether to send us their runners could not find out what free versus paid
// actually means, and neither could anyone else. That is not restraint, it is
// an omission.
//
// It is also the page that makes the charity access code legible. You cannot
// appreciate a gift whose value is unstated (Traynor).
//
// THE CONTENT IS NOT WRITTEN HERE. `lib/marketing/pricing.ts` holds the rows,
// each tagged with the featureGates gate it describes, and `pricing.test.ts`
// fails the build if a PAID gate has no row. A pricing page is prose about a
// rule that lives elsewhere, and this repo has already shipped the drift that
// causes: the homepage claimed "four answers" against a ~15-question wizard and
// survived five wizard changes because nothing connected claim to thing.
//
// PRICES COME FROM BRAND.PRICING. Never a literal, per CLAUDE.md.
//
// DESIGN. Deliberately NOT the competitor's treatment. No gradient card, no
// neon, no rotating trial badge. The paid tier is elevated by a moss rail and
// the ink CTA, which is the documented "type accent, not flood" rule. The free
// column is never made to look sad: "Free Users Are Never Abandoned" is a
// product principle and a pricing page that sneers at the free tier contradicts
// it in public.

import type { Metadata } from 'next'
import Link from 'next/link'
import { BRAND, PRICING } from '@/lib/brand'
import { pageMetadata } from '@/lib/marketing/siteMeta'
import { SiteHeader } from '@/components/marketing/SiteHeader'
import { SiteFooter } from '@/components/marketing/SiteFooter'
import { AppStoreBadge } from '@/components/marketing/AppStoreBadge'
import { FREE_FEATURES, PAID_FEATURES, type TierFeature } from '@/lib/marketing/pricing'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.zonna.run'
const PAGE_URL = `${APP_URL}/pricing`
const SECTION_MAX = 760

export const revalidate = 86400

export const metadata: Metadata = pageMetadata({
  title: `Pricing`,
  description: 'Two weeks of everything, then a free tier that keeps the plan you built. No trial that deletes your work.',
  path: '/pricing',
  ogTitle: `Pricing | ${BRAND.name}`,
  ogDescription: 'Two weeks of everything, then a free tier that keeps the plan you built. No trial that deletes your work.',
  type: 'website',
  ogImageTitle: 'Two weeks of everything. Then you decide.',
})

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontSize: 'var(--fs-caption)', fontWeight: 700, color: 'var(--moss)',
      textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '12px',
    }}>{children}</div>
  )
}

/** A feature row. Name plus a sentence on what it does FOR YOU — the thing the
 *  competitor does well and most pricing tables do not. A bare list of nouns
 *  tells a first-timer nothing. */
function Feature({ f, accent }: { f: TierFeature; accent: string }) {
  return (
    <div style={{ display: 'flex', gap: '14px', padding: '13px 0' }}>
      <span aria-hidden style={{
        width: '3px', alignSelf: 'stretch', borderRadius: '2px',
        background: accent, flexShrink: 0,
      }} />
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 'var(--fs-body-lg)', fontWeight: 700, color: 'var(--ink)', marginBottom: '3px' }}>
          {f.name}
        </div>
        <div style={{ fontSize: 'var(--fs-body)', lineHeight: 1.55, color: 'var(--ink-2)' }}>
          {f.detail}
        </div>
      </div>
    </div>
  )
}

export default function PricingPage() {
  const ld = {
    '@context': 'https://schema.org', '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: APP_URL },
      { '@type': 'ListItem', position: 2, name: 'Pricing', item: PAGE_URL },
    ],
  }

  return (
    <main style={{ background: 'var(--bg)', color: 'var(--ink)', minHeight: '100vh', fontFamily: 'var(--font-ui)' }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld) }} />

      <SiteHeader current="pricing" />

      {/* ── Hero ────────────────────────────────────────────────────────── */}
      <section style={{ maxWidth: SECTION_MAX, margin: '0 auto', padding: 'var(--sect-y-hero) 24px 0' }}>
        <Eyebrow>Pricing</Eyebrow>
        <h1 style={{
          fontFamily: 'var(--font-brand)', fontSize: 'var(--fs-h1)',
          fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1.1,
          margin: '0 0 18px', color: 'var(--ink)',
        }}>
          Two weeks of everything. Then you decide.
        </h1>
        <p style={{ fontSize: 'var(--fs-lead-lg)', lineHeight: 1.55, color: 'var(--ink-2)', margin: 0 }}>
          Every new account gets the full app for two weeks. After that you keep the plan
          you built and drop to the free tier, or you keep the coaching. Nothing is
          deleted and nothing nags you.
        </p>
      </section>

      {/* ── The two tiers ───────────────────────────────────────────────── */}
      <section style={{ maxWidth: SECTION_MAX, margin: '0 auto', padding: 'var(--sect-y) 24px 0' }}>
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 330px), 1fr))',
          gap: '16px',
          // Each card takes its own height. A grid row stretches by default,
          // which left the FREE card carrying ~350px of empty white to match
          // the paid column. The note below is right that free must not look
          // pitiful, but a void does not read as equal weight, it reads as
          // unfinished. A card sized to its content reads deliberate.
          alignItems: 'start',
        }}>

          {/* Free. Given equal weight on purpose: "Free Users Are Never
              Abandoned" is a product principle, and a pricing page that makes
              the free column look pitiful contradicts it in public. */}
          <div style={{
            background: 'var(--card)', border: '1px solid var(--line)',
            borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-card)',
            padding: '24px 22px',
          }}>
            <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 700, color: 'var(--mute)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '10px' }}>
              Free
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', marginBottom: '4px' }}>
              <span style={{ fontFamily: 'var(--font-brand)', fontSize: 'var(--fs-metric-lg)', fontWeight: 800, color: 'var(--ink)', letterSpacing: '-1.5px', lineHeight: 1 }}>
                {PRICING.symbol}0
              </span>
            </div>
            <p style={{ fontSize: 'var(--fs-sm)', lineHeight: 1.5, color: 'var(--mute)', margin: '0 0 8px' }}>
              Forever. No card, no countdown.
            </p>
            <div style={{ borderTop: '1px solid var(--line)', marginTop: '14px', paddingTop: '6px' }}>
              {FREE_FEATURES.map(f => <Feature key={f.name} f={f} accent="var(--line-strong)" />)}
            </div>
          </div>

          {/* Paid. Elevated by a moss rail and the ink CTA, NOT by a gradient
              card. "Type accent, not flood." */}
          <div style={{
            background: 'var(--card)', border: '1px solid var(--line)',
            borderTop: '3px solid var(--moss)',
            borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-card)',
            padding: '24px 22px',
          }}>
            <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 700, color: 'var(--moss)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '10px' }}>
              Full access
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginBottom: '4px' }}>
              <span style={{ fontFamily: 'var(--font-brand)', fontSize: 'var(--fs-metric-lg)', fontWeight: 800, color: 'var(--ink)', letterSpacing: '-1.5px', lineHeight: 1 }}>
                {PRICING.monthly.display}
              </span>
              <span style={{ fontSize: 'var(--fs-body)', color: 'var(--mute)' }}>/ month</span>
            </div>
            <p style={{ fontSize: 'var(--fs-sm)', lineHeight: 1.5, color: 'var(--mute)', margin: '0 0 8px' }}>
              Or {PRICING.annual.display} a year, which works out at about{' '}
              {PRICING.symbol}{PRICING.annual.perMonthEquiv.toFixed(2)} a month. Cancel any time.
            </p>
            <div style={{ borderTop: '1px solid var(--line)', marginTop: '14px', paddingTop: '6px' }}>
              <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 600, color: 'var(--ink-2)', padding: '8px 0 2px' }}>
                Everything in free, plus:
              </div>
              {PAID_FEATURES.map(f => <Feature key={f.name} f={f} accent="var(--moss)" />)}
            </div>
          </div>
        </div>
      </section>

      {/* ── The honest bit about what "free" means after the trial ──────── */}
      <section style={{ maxWidth: SECTION_MAX, margin: '0 auto', padding: 'var(--sect-y) 24px 0' }}>
        <div style={{
          background: 'var(--card)', border: '1px solid var(--line)',
          borderLeft: '3px solid var(--warn)',
          borderRadius: 'var(--radius-lg)', padding: '22px 20px',
        }}>
          <h2 style={{ fontSize: 'var(--fs-lead-lg)', fontWeight: 700, color: 'var(--ink)', margin: '0 0 10px' }}>
            What happens on day fifteen
          </h2>
          <p style={{ fontSize: 'var(--fs-body-lg)', lineHeight: 1.6, color: 'var(--ink-2)', margin: '0 0 12px' }}>
            You keep the plan you built during the trial. Your zones, your paces, the
            coach notes already on your sessions: all of it stays. What stops is the
            ongoing part, the reading of new runs and the reshaping when a week goes
            sideways.
          </p>
          <p style={{ fontSize: 'var(--fs-body-lg)', lineHeight: 1.6, color: 'var(--ink-2)', margin: 0 }}>
            We do not delete your training to make a point. If the free tier is enough
            for you, use the free tier.
          </p>
        </div>
      </section>

      {/* ── Charity runners. The page that makes the code make sense. ───── */}
      <section style={{ maxWidth: SECTION_MAX, margin: '0 auto', padding: 'var(--sect-y) 24px 0' }}>
        <p style={{ fontSize: 'var(--fs-body-lg)', lineHeight: 1.6, color: 'var(--ink-2)', margin: 0 }}>
          Running on a charity place? Some charities cover the full app for their
          runners.{' '}
          <Link href="/charity-runners" style={{ color: 'var(--moss)', fontWeight: 600, textDecoration: 'none' }}>
            How that works &rarr;
          </Link>
        </p>
      </section>

      {/* ── Close ───────────────────────────────────────────────────────── */}
      <section style={{ maxWidth: SECTION_MAX, margin: '0 auto', padding: 'var(--sect-y) 24px var(--sect-y)' }}>
        <div style={{
          background: 'var(--card)', border: '1px solid var(--line)',
          borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-card)',
          padding: '26px 22px',
        }}>
          <h2 style={{ fontSize: 'var(--fs-h4)', fontWeight: 800, color: 'var(--ink)', margin: '0 0 10px', letterSpacing: '-0.01em' }}>
            Start with the two weeks.
          </h2>
          <p style={{ fontSize: 'var(--fs-body-lg)', lineHeight: 1.6, color: 'var(--ink-2)', margin: '0 0 18px' }}>
            Build a plan, run a fortnight of it, and see whether being told to slow down
            is what you were missing.
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '14px', alignItems: 'center' }}>
            <AppStoreBadge />
            <Link href="/plans" style={{ fontSize: 'var(--fs-body-lg)', fontWeight: 600, color: 'var(--moss)', textDecoration: 'none' }}>
              Or read a free plan first &rarr;
            </Link>
          </div>
        </div>
      </section>

      <SiteFooter />
    </main>
  )
}
