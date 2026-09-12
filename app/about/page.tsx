// GTM-SITE-02 — /about. Who built this, and why.
//
// WHY IT EXISTS. Hutchinson ranked this ABOVE the visual work at the SLT: every
// app in this category claims an expert, and ours has a named person who admits
// he runs medium-hard on everything. A charity vetting who gets in front of its
// fundraisers is doing due diligence, and a real name with an honest paragraph
// does more for that than any amount of colour.
//
// RELATIONSHIP TO THE IN-APP FOUNDER NOTE. `FounderNoteScreen` carries the same
// story and deliberately has NO photograph: its own note says "voice is the
// asset, not the face". That call was right for an in-app surface a paying
// runner reaches from Me. It does not govern here. This page is read by someone
// deciding whether to trust a stranger with their fundraisers' training, which
// is a different question, and a face answers it.
//
// PHOTO SLOT. Deliberately built so the page reads COMPLETE without one. An
// empty frame is worse than no frame, so there is no placeholder: when a
// photograph exists, set FOUNDER_PHOTO and the layout takes it. Spec in the
// constant below.
//
// Copy is the in-app note's narrative, re-punctuated for the no-em-dash rule
// and extended with the bit a charity actually wants to know: that the thing
// was built by someone who needed it, and that he is still using it.

import type { Metadata } from 'next'
import Link from 'next/link'
import { BRAND } from '@/lib/brand'
import { FOUNDER_STORY } from '@/lib/marketing/founderStory'
import { SiteHeader } from '@/components/marketing/SiteHeader'
import { SiteFooter } from '@/components/marketing/SiteFooter'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.zonna.run'
const PAGE_URL = `${APP_URL}/about`
const SECTION_MAX = 760

/**
 * Set when a photograph exists. Until then the page renders without a frame
 * rather than with an empty one.
 *
 * Spec: a real training photo, not a studio portrait. Landscape, at least
 * 1200px wide, put in /public/about/. Mid-run or post-run beats posed: the
 * brand's whole claim is that this was built by someone with the problem, and
 * a polished headshot argues the opposite.
 */
const FOUNDER_PHOTO: { src: string; alt: string } | null = null

export const revalidate = 86400

export const metadata: Metadata = {
  title: `About | ${BRAND.name}`,
  description:
    `Who built ${BRAND.name} and why. A runner whose easy days were never easy, a plateau that would not move, and the tool that came out of it.`,
  alternates: { canonical: PAGE_URL },
  openGraph: {
    title: `Why ${BRAND.name} exists`,
    description: 'Built by a runner who went medium-hard on everything, and got tired of wondering why nothing improved.',
    url: PAGE_URL,
    siteName: BRAND.name,
    images: [{ url: `${APP_URL}/api/og`, width: 1200, height: 630 }],
    type: 'article',
    locale: 'en_GB',
  },
}

function P({ children }: { children: React.ReactNode }) {
  return (
    <p style={{ fontSize: '17px', lineHeight: 1.65, color: 'var(--ink-2)', margin: '0 0 16px' }}>
      {children}
    </p>
  )
}

export default function AboutPage() {
  const ld = [
    {
      '@context': 'https://schema.org', '@type': 'AboutPage',
      name: `About ${BRAND.name}`,
      url: PAGE_URL,
      // Person, not Organization: the honest claim here is one named human.
      about: { '@type': 'Person', name: 'Russell Shear' },
    },
    {
      '@context': 'https://schema.org', '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: APP_URL },
        { '@type': 'ListItem', position: 2, name: 'About', item: PAGE_URL },
      ],
    },
  ]

  return (
    <main style={{ background: 'var(--bg)', color: 'var(--ink)', minHeight: '100vh', fontFamily: 'var(--font-ui)' }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld) }} />

      <SiteHeader />

      {/* ── The story ───────────────────────────────────────────────────── */}
      <section style={{ maxWidth: SECTION_MAX, margin: '0 auto', padding: '56px 24px 0' }}>
        <div style={{
          fontSize: '12px', fontWeight: 700, color: 'var(--moss)',
          textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '14px',
        }}>
          Why {BRAND.name} exists
        </div>

        <h1 style={{
          fontFamily: 'var(--font-brand)', fontSize: 'clamp(30px, 5vw, 44px)',
          fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1.1,
          margin: '0 0 24px', color: 'var(--ink)',
        }}>
          {FOUNDER_STORY.opener}
        </h1>

        {FOUNDER_PHOTO && (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={FOUNDER_PHOTO.src}
            alt={FOUNDER_PHOTO.alt}
            style={{
              width: '100%', height: 'auto', display: 'block',
              borderRadius: 'var(--radius-lg)', marginBottom: '28px',
            }}
          />
        )}

        {/* GTM-SITE-03 — narrative from the single owner. The TREATMENT here
            (the photograph above) stays divergent from the in-app note on
            purpose: a charity vetting a stranger needs a face. */}
        {FOUNDER_STORY.paragraphs.map((para, i) => <P key={i}>{para}</P>)}

        {/* Thesis. 3px moss rail, the same vocabulary the in-app note uses. */}
        <div style={{ position: 'relative', padding: '6px 0 6px 20px', margin: '28px 0' }}>
          <span aria-hidden style={{
            position: 'absolute', left: 0, top: '4px', bottom: '4px',
            width: '3px', borderRadius: '2px', background: 'var(--moss)',
          }} />
          <p style={{
            fontFamily: 'var(--font-brand)', fontSize: '21px', fontWeight: 700,
            lineHeight: 1.35, color: 'var(--ink)', margin: 0, letterSpacing: '-0.01em',
          }}>
            {BRAND.coreTruth}
          </p>
        </div>

        <P>
          That is the whole product. {BRAND.name} sets a zone for every session and holds
          you to it, which mostly means telling you to slow down on the days you were
          planning to prove something. It is not the exciting version of training. It is
          the version that keeps working.
        </P>
      </section>

      {/* ── The bit a charity actually wants to know ────────────────────── */}
      <section style={{
        background: 'var(--bg-soft)',
        borderTop: '1px solid var(--line)', borderBottom: '1px solid var(--line)',
        padding: '56px 24px', marginTop: '48px',
      }}>
        <div style={{ maxWidth: SECTION_MAX, margin: '0 auto' }}>
          <div style={{
            fontSize: '12px', fontWeight: 700, color: 'var(--moss)',
            textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '14px',
          }}>
            Who you are dealing with
          </div>
          <h2 style={{
            fontFamily: 'var(--font-brand)', fontSize: 'clamp(23px, 3.6vw, 30px)',
            fontWeight: 800, color: 'var(--ink)', letterSpacing: '-0.02em',
            lineHeight: 1.15, margin: '0 0 16px',
          }}>
            One person, still using it.
          </h2>
          <P>
            {BRAND.name} is built and run by Russ Shear. Not a team, not a content farm,
            not a white-labelled plan library with a logo on it. The coaching logic is
            written down, argued over and checked against what the app actually does,
            because the person writing it is also the person following it.
          </P>
          <P>
            That matters most if you are a charity deciding whether to put this in front
            of your fundraisers. You are not being asked to trust a brand. You are being
            asked to trust someone who will answer the email himself.
          </P>
        </div>
      </section>

      {/* ── Close ───────────────────────────────────────────────────────── */}
      <section style={{ maxWidth: SECTION_MAX, margin: '0 auto', padding: '48px 24px 72px' }}>
        <div style={{ height: '1px', background: 'var(--line)', margin: '0 0 20px' }} />
        <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--ink)', marginBottom: '4px' }}>
          Russ Shear &middot; Founder
        </div>
        <a
          href="mailto:russ@zonna.run"
          style={{
            display: 'inline-flex', alignItems: 'center', minHeight: '44px',
            fontSize: '14px', color: 'var(--moss)', fontWeight: 600,
            textDecoration: 'underline', textUnderlineOffset: '3px',
          }}
        >
          russ@zonna.run
        </a>

        <p style={{ fontSize: '15px', lineHeight: 1.6, color: 'var(--ink-2)', margin: '20px 0 0' }}>
          Running on a charity place?{' '}
          <Link href="/charity-runners" style={{ color: 'var(--moss)', fontWeight: 600, textDecoration: 'none' }}>
            Start here &rarr;
          </Link>
        </p>
      </section>

      <SiteFooter />
    </main>
  )
}
