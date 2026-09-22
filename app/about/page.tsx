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
import { Section } from '@/components/marketing/Section'
import Link from 'next/link'
import { BRAND } from '@/lib/brand'
import { pageMetadata } from '@/lib/marketing/siteMeta'
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

export const metadata: Metadata = pageMetadata({
  title: `About`,
  description: 'Built by a runner who went medium-hard on everything, and got tired of wondering why nothing improved.',
  path: '/about',
  ogTitle: `Why ${BRAND.name} exists`,
  ogDescription: 'Built by a runner who went medium-hard on everything, and got tired of wondering why nothing improved.',
  type: 'article',
  ogImageTitle: `Why ${BRAND.name} exists`,
})

function P({ children }: { children: React.ReactNode }) {
  return (
    <p style={{ fontSize: 'var(--fs-lead-lg)', lineHeight: 1.65, color: 'var(--ink-2)', margin: '0 0 16px' }}>
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
      about: { '@type': 'Person', name: BRAND.founder.name },
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
      {/* SITE-WAVE-1a-ii — adopted the shared Section 2026-09-22 (Design Board
          sitting one). ZERO VISUAL DELTA is this wave's contract: width="full"
          + rhythm="none" hand the inner div exactly the maxWidth, margin and
          padding the raw element had. The win is that `surface=` now EXISTS on
          this page, so wave 1b can spend a ground here.
          ⚠️ FOR WAVE 1B — SITE-MEASURE-THIRD-01: SECTION_MAX is 760, a THIRD
          measure beside --measure-page 1100 and --measure-read 720. Preserved,
          not endorsed. */}
      <Section width="full" rhythm="none"
        innerStyle={{ maxWidth: SECTION_MAX, margin: '0 auto', padding: 'var(--sect-y-hero) 24px 0' }}>
        <div style={{
          fontSize: 'var(--fs-caption)', fontWeight: 700, color: 'var(--moss-strong)',
          textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 'var(--space-3)',
        }}>
          Why {BRAND.name} exists
        </div>

        <h1 style={{
          fontFamily: 'var(--font-brand)', fontSize: 'var(--fs-h1)',
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
              borderRadius: 'var(--radius-lg)', marginBottom: 'var(--space-5)',
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
            width: '3px', borderRadius: '2px', background: 'var(--moss-strong)',
          }} />
          <p style={{
            fontFamily: 'var(--font-brand)', fontSize: 'var(--fs-h4)', fontWeight: 700,
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
      </Section>

      {/* ── The bit a charity actually wants to know ────────────────────── */}
      {/* ⚠️ FOR WAVE 1B — SITE-GROUND-ABOUT-01: this spends --bg-soft as a PAGE
          GROUND, and brand.md says in those words that "inset is not a page
          ground". Preserved exactly (1a-ii changes nothing visible) and
          flagged, because a warm band alternating against --bg is what W-08
          killed on the homepage. */}
      <Section surface="inset" width="full" rhythm="none"
        style={{ borderTop: '1px solid var(--line)', borderBottom: '1px solid var(--line)', marginTop: 'var(--space-7)' }}
        innerStyle={{ padding: '56px 24px' }}>
        <div style={{ maxWidth: SECTION_MAX, margin: '0 auto' }}>
          <div style={{
            fontSize: 'var(--fs-caption)', fontWeight: 700, color: 'var(--moss-strong)',
            textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 'var(--space-3)',
          }}>
            Who you are dealing with
          </div>
          <h2 style={{
            fontFamily: 'var(--font-brand)', fontSize: 'var(--fs-h3)',
            fontWeight: 800, color: 'var(--ink)', letterSpacing: '-0.02em',
            lineHeight: 1.15, margin: '0 0 16px',
          }}>
            One person, still using it.
          </h2>
          <P>
            {BRAND.name} is built and run by {BRAND.founder.name}. Not a team, not a content farm,
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
      </Section>

      {/* ── Close ───────────────────────────────────────────────────────── */}
      <Section width="full" rhythm="none"
        innerStyle={{ maxWidth: SECTION_MAX, margin: '0 auto', padding: 'var(--sect-y) 24px var(--sect-y)' }}>
        <div style={{ height: '1px', background: 'var(--line)', margin: '0 0 20px' }} />
        <div style={{ fontSize: 'var(--fs-body)', fontWeight: 600, color: 'var(--ink)', marginBottom: '4px' }}>
          {BRAND.founder.name} &middot; Founder
        </div>
        <a
          href="mailto:russ@zonna.run"
          style={{
            display: 'inline-flex', alignItems: 'center', minHeight: '44px',
            fontSize: 'var(--fs-body)', color: 'var(--moss-strong)', fontWeight: 600,
            textDecoration: 'underline', textUnderlineOffset: '3px',
          }}
        >
          russ@zonna.run
        </a>

        <p style={{ fontSize: 'var(--fs-body-lg)', lineHeight: 1.6, color: 'var(--ink-2)', margin: '20px 0 0' }}>
          Running on a charity place?{' '}
          <Link href="/charity-runners" style={{ color: 'var(--moss-strong)', fontWeight: 600, textDecoration: 'none' }}>
            Start here &rarr;
          </Link>
        </p>
      </Section>

      <SiteFooter />
    </main>
  )
}
