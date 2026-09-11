// GTM-CHARITY-01 — landing page for runners on a charity place.
//
// WHY THIS PAGE EXISTS. A charity partner refers its runners to Zonna, the
// product's first real referral channel. The SLT ruled 2026-09-11: do NOT bend
// the homepage toward this audience, give them their own page, the way the SEO
// plan pages already do. This is very likely the FIRST thing one of their
// runners ever sees of the product.
//
// REWRITTEN 2026-09-11 (second time today, founder call both times):
//   1. It was marathon-only in its URL, title, FAQs and CTAs. Charity places
//      are most often 10K and half marathon, with marathons and the odd ultra
//      on top, so a distance-shaped page turned most of its own audience away
//      at the headline.
//   2. It then led with the free STATIC plans, because when it was written
//      charity runners still had to pay for the app. GTM-CHARITY-04 changed
//      that: they now get the whole product free via a code from their charity.
//      Leading with "here are some free PDFs-in-HTML" buries the actual offer
//      and reads as a downsell. The code is the headline now; the static plans
//      are the honest fallback for someone without one.
//
// THE AUDIENCE IS NOT THE STATED ICP, AND THAT IS THE POINT OF THE PAGE.
// brand.md defines the audience as "adult runners, 1+ years' experience".
// Charity-place runners skew the other way: often a first race at the distance,
// entered for a cause. The homepage is written for someone who already runs.
// This is written for someone who may not yet, WITHOUT changing what the
// product claims.
//
// The honest bridge: Zonna's core truth is "you're trying hard, that's the
// problem". A charity runner's version of that failure is heroing sessions
// early with a fundraising page watching, breaking down mid-block, and missing
// the start line. Same mechanism, different surface. So the page leads with
// injury risk rather than a promise of speed.
//
// NO PARTNER BRANDING, DELIBERATELY. Names no charity, carries no logo, claims
// no endorsement: that would imply a relationship the page cannot evidence, and
// co-branding is a founder and legal decision made WITH the partner. It works
// as a generic charity-runner page, so it serves the traffic either way.
//
// WE DO NOT HAND OUT CODES HERE, and the page must never imply we might. The
// charity issues them, because they are the only party who knows who holds a
// place with them. Every "no code?" path leads to the free plans or the normal
// two-week trial, never to a request form.

import type { Metadata } from 'next'
import Link from 'next/link'
import { BRAND, PRICING } from '@/lib/brand'
import { SiteHeader } from '@/components/marketing/SiteHeader'
import { SiteFooter } from '@/components/marketing/SiteFooter'
import { AppStoreBadge } from '@/components/marketing/AppStoreBadge'
import { PhoneFrame } from '@/components/marketing/PhoneFrame'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.zonna.run'
const PAGE_URL = `${APP_URL}/charity-runners`

/** The site's content column. Matches PlanPage, ComparisonPage and /plans. */
const SECTION_MAX = 760

export const revalidate = 86400

export const metadata: Metadata = {
  title: `Free Coaching for Charity Runners | ${BRAND.name}`,
  description:
    'Running for a charity? Your charity may have covered the full app for you, free. Mostly easy running, every session zoned, built so you reach the start line uninjured.',
  alternates: { canonical: PAGE_URL },
  openGraph: {
    title: `Running for charity? Make the start line. | ${BRAND.name}`,
    description:
      'Most charity runners do not miss their race because they were slow. They miss it because they got injured in training. If your charity gave you a code, the whole app is yours.',
    url: PAGE_URL,
    siteName: BRAND.name,
    images: [{ url: `${APP_URL}/api/og`, width: 1200, height: 630 }],
    type: 'article',
    locale: 'en_GB',
  },
  twitter: {
    card: 'summary_large_image',
    title: `Charity running, without breaking yourself | ${BRAND.name}`,
    description:
      'A coach that tells you to slow down, free for runners whose charity has covered it.',
    images: [`${APP_URL}/api/og`],
  },
}

/** The four free plans, by distance. Ultra is deliberately absent: 50K and 100K
 *  have no free static plan, and the page says so rather than linking somewhere
 *  that does not answer the question. */
const DISTANCES = [
  { slug: '5k-12-week',            label: '5K',            weeks: '12 weeks' },
  { slug: '10k-12-week',           label: '10K',           weeks: '12 weeks' },
  { slug: 'half-marathon-12-week', label: 'Half marathon', weeks: '12 weeks' },
  { slug: 'marathon-16-week',      label: 'Marathon',      weeks: '16 weeks' },
]

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontSize: '12px', fontWeight: 700, color: 'var(--moss)',
      textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '12px',
    }}>{children}</div>
  )
}

function H2({ children }: { children: React.ReactNode }) {
  return (
    <h2 style={{
      fontFamily: 'var(--font-brand)', fontSize: 'clamp(23px, 3.6vw, 30px)',
      fontWeight: 800, color: 'var(--ink)', letterSpacing: '-0.02em',
      lineHeight: 1.15, margin: '0 0 16px',
    }}>{children}</h2>
  )
}

function P({ children }: { children: React.ReactNode }) {
  return (
    <p style={{ fontSize: '16px', lineHeight: 1.6, color: 'var(--ink-2)', margin: '0 0 14px' }}>
      {children}
    </p>
  )
}

const FAQS: { q: string; a: string }[] = [
  {
    q: 'Where do I get a code?',
    a: 'From the charity you are running for. They are given a set number for their runners, and they decide who gets one. We cannot issue codes directly, so if you think you should have one and do not, your charity is the place to ask.',
  },
  {
    q: 'What does the code actually give me?',
    a: 'The whole app, free. Your plan built around your race, real heart-rate zones, the coaching after every run, and the reshaping when a week goes sideways. Not a trial and not a cut-down version: the same thing paying subscribers get.',
  },
  {
    q: 'How long does it last?',
    a: 'Through your training and a week past race day. When you set your race date in the app the access stretches to cover it, so it cannot run out halfway through a block. If you never get round to building a plan it lapses after 90 days, which is fair enough.',
  },
  {
    q: 'I have never raced this distance. Is this for me?',
    a: 'Yes, with one caveat worth saying out loud. The plans assume you can already run about 30 minutes without stopping. If you cannot yet, spend a few weeks building to that first and then start. Beginning a structured block from zero is the most reliable way to get injured before race day.',
  },
  {
    q: 'Why is so much of it easy? I have a race to train for.',
    a: 'Because that is what works, and because the alternative is what breaks people. Running easy on your easy days is what lets the one hard session a week actually be hard. Charity runners rarely miss the start line through lack of effort. They miss it through too much of it, too early.',
  },
  {
    q: 'What if I miss a week? Work, illness, life.',
    a: 'Nothing breaks. Missed sessions are a feature of adult life, not a failure. The plan reshapes around what you actually did rather than leaving you to catch up on a week that has gone. Nobody guilt-trips you.',
  },
  {
    q: 'Do I need a watch?',
    a: 'It works best with a heart-rate source, an Apple Watch or a chest strap that writes to Apple Health, because that is what proves your easy days are genuinely easy. Without one you still get the plan, the paces and the structure. You just judge effort yourself.',
  },
  {
    q: 'I am doing an ultra. Does this cover that?',
    a: 'The app builds 50K and 100K plans and a code covers them like any other distance. There is no free static ultra plan on this site, so if you are without a code the advice on this page still holds, and holds harder: the further the race, the more of your week should be easy.',
  },
  {
    q: 'What happens when the access ends?',
    a: `You keep the plan you built and drop to the free tier. Nothing is deleted and nothing nags you. If you want to keep the coaching and the reshaping it is ${PRICING.monthly.display}/month or ${PRICING.annual.display}/year, and if you do not, that is genuinely fine.`,
  },
]

export default function CharityRunnersPage() {
  const ld = [
    {
      '@context': 'https://schema.org', '@type': 'FAQPage',
      mainEntity: FAQS.map(f => ({
        '@type': 'Question', name: f.q,
        acceptedAnswer: { '@type': 'Answer', text: f.a },
      })),
    },
    {
      '@context': 'https://schema.org', '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: APP_URL },
        { '@type': 'ListItem', position: 2, name: 'Charity runners', item: PAGE_URL },
      ],
    },
  ]

  return (
    <main style={{ background: 'var(--bg)', color: 'var(--ink)', minHeight: '100vh', fontFamily: 'var(--font-ui)' }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld) }} />

      <SiteHeader />

      {/* ── Hero ────────────────────────────────────────────────────────── */}
      <section style={{ maxWidth: SECTION_MAX, margin: '0 auto', padding: '56px 24px 40px' }}>
        <Eyebrow>For charity runners</Eyebrow>
        <h1 style={{
          fontFamily: 'var(--font-brand)', fontSize: 'clamp(30px, 5.5vw, 46px)',
          fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1.1,
          margin: '0 0 18px', color: 'var(--ink)',
        }}>
          You got the place. Your charity may have covered the coaching.
        </h1>
        <p style={{ fontSize: '17px', lineHeight: 1.55, color: 'var(--ink-2)', margin: '0 0 26px' }}>
          Some charities give their runners a code for the full {BRAND.name} app, free for
          the whole training block. If yours did, it takes about a minute to use. If it
          did not, everything below still applies and the plans are free to read anyway.
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '14px', alignItems: 'center' }}>
          {/* Geometry MATCHES AppStoreBadge deliberately: same padding, same
              radius token, same font size, same lineHeight: 1. It previously
              sat beside the badge as a 51px full capsule next to a 38px soft
              rectangle, which read as two unrelated buttons that happened to be
              adjacent. Measured, not eyeballed. If the badge's shape ever
              changes, change this with it. */}
          <a href="#code" style={{
            display: 'inline-flex', alignItems: 'center', gap: '10px',
            background: 'var(--moss)', color: 'var(--card)',
            // lineHeight 18px, not 1: the badge's content box is set by its
            // 18px Apple icon, so matching font size alone still left this 4px
            // shorter (34 vs 38). Matching the CONTENT height is what makes the
            // two boxes agree.
            fontSize: '14px', fontWeight: 600, lineHeight: '18px',
            textDecoration: 'none',
            padding: '10px 18px', borderRadius: 'var(--radius-md, 8px)',
          }}>
            How to use your code <span aria-hidden style={{ opacity: 0.6 }}>&darr;</span>
          </a>
          <AppStoreBadge />
        </div>
      </section>

      {/* ── The product, before the argument ──────────────────────────────
          The page previously showed NOTHING of the app: six stacked sections
          of text and cards, and a first-timer deciding whether to download had
          seen no evidence at all. The device shot is also the only thing on the
          page that is not a rounded rectangle, so it breaks a rhythm that had
          become a template loop.

          Light section only: the frame renders its screen ground dark inside a
          --ground section (known constraint, PhoneFrame header). */}
      <section style={{ padding: '8px 24px 56px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '18px' }}>
        <div className="phone-fit"><PhoneFrame /></div>
        <p style={{
          fontSize: '14px', lineHeight: 1.55, color: 'var(--mute)',
          margin: 0, maxWidth: '420px', textAlign: 'center',
        }}>
          One screen, one job: the run you are doing today and the zone to hold it in.
        </p>
      </section>

      {/* ── The real risk ───────────────────────────────────────────────── */}
      <section style={{
        background: 'var(--bg-soft)',
        borderTop: '1px solid var(--line)', borderBottom: '1px solid var(--line)',
        padding: '64px 24px',
      }}>
        <div style={{ maxWidth: SECTION_MAX, margin: '0 auto' }}>
          <Eyebrow>The thing nobody tells you</Eyebrow>
          <H2>The risk is not that you are too slow. It is that you try too hard.</H2>
          <P>
            You have a cause, a fundraising page and people watching. That is a lot of
            motivation, and motivation is exactly what gets charity runners hurt. Every
            easy run becomes a bit quicker than it should be. Every long run becomes a
            test. Nothing is ever properly easy, so nothing is ever properly recovered,
            and the body files the bill somewhere in the middle of the block.
          </P>
          <P>
            {BRAND.name} exists for that specific problem. It sets a zone for every session
            and holds you to it, which mostly means telling you to slow down on days you
            were planning to prove something. It is not the exciting version of training.
            It is the version that gets you to the start line.
          </P>
        </div>
      </section>

      {/* ── How to use the code. The founder's note: nothing on this page
            told a runner that codes existed or what to do with one. ───── */}
      <section id="code" style={{ maxWidth: SECTION_MAX, margin: '0 auto', padding: '64px 24px 0', scrollMarginTop: '80px' }}>
        <Eyebrow>If you have a code</Eyebrow>
        <H2>Three steps, about a minute.</H2>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '24px' }}>
          {[
            ['Download the app', `${BRAND.name} is on the App Store. Sign up with Apple, Google or an email address.`],
            ['Open Me, then "Have a charity code?"', 'It is at the bottom of the Me tab. Type the code your charity sent you. Case and dashes do not matter.'],
            ['Build your plan', 'Tell it your race and your week. That is when your access stretches to cover race day, so it cannot run out mid-block.'],
          ].map(([title, body], i) => (
            <div key={title} style={{
              display: 'flex', gap: '16px', alignItems: 'flex-start',
              background: 'var(--card)', border: '1px solid var(--line)',
              borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-card)',
              padding: '18px 20px',
            }}>
              <span style={{
                flexShrink: 0, width: '26px', height: '26px', borderRadius: '50%',
                background: 'var(--moss)', color: 'var(--card)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '13px', fontWeight: 800,
              }}>{i + 1}</span>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--ink)', marginBottom: '4px' }}>{title}</div>
                <div style={{ fontSize: '14.5px', lineHeight: 1.55, color: 'var(--ink-2)' }}>{body}</div>
              </div>
            </div>
          ))}
        </div>

        <p style={{
          fontSize: '14px', lineHeight: 1.6, color: 'var(--mute)',
          margin: '16px 0 0', borderLeft: '2px solid var(--line-strong)', paddingLeft: '14px',
        }}>
          Codes come from your charity, not from us, and each one works once. If you think
          you should have one and do not, ask whoever organises your place.
        </p>
      </section>

      {/* ── What the code unlocks ────────────────────────────────────────
          On --bg-soft: the page had exactly ONE tonal break in its whole
          length, so everything after the risk section flattened into an
          undifferentiated run of white cards. A second band re-establishes
          rhythm at the point the page makes its offer.

          Left-accent rows, not a card grid. That is the documented feature-list
          pattern (same visual language as session cards) and it removes four
          more boxes from a middle that had about twenty. */}
      <section style={{
        background: 'var(--bg-soft)',
        borderTop: '1px solid var(--line)', borderBottom: '1px solid var(--line)',
        padding: '64px 24px', marginTop: '56px',
      }}>
        <div style={{ maxWidth: SECTION_MAX, margin: '0 auto' }}>
          <Eyebrow>What you get</Eyebrow>
          <H2>The same app everyone else pays for.</H2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', marginTop: '24px' }}>
            {[
              ['A plan built round your race',
               'Your distance, your date, the days you can actually run. 5K through ultra.'],
              ['Every run has a zone and a pace band',
               'Derived from your numbers, not guessed, so "easy" is something you can check rather than talk yourself out of.'],
              [`${BRAND.coachName} reads every run`,
               'Tells you afterwards whether you actually held the zone. One line, no dashboard.'],
              ['A plan that moves when life does',
               'Miss a week and it reshapes around what you did, instead of leaving you to catch up on a week that has gone.'],
            ].map(([title, body]) => (
              <div key={title} style={{ display: 'flex', gap: '16px', padding: '14px 0' }}>
                <span aria-hidden style={{
                  width: '3px', alignSelf: 'stretch', borderRadius: '2px',
                  background: 'var(--moss)', flexShrink: 0,
                }} />
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--ink)', marginBottom: '3px' }}>{title}</div>
                  <div style={{ fontSize: '14.5px', lineHeight: 1.55, color: 'var(--ink-2)' }}>{body}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── No code. The honest fallback, deliberately AFTER the offer. ── */}
      <section style={{ maxWidth: SECTION_MAX, margin: '0 auto', padding: '56px 24px 0' }}>
        <Eyebrow>No code?</Eyebrow>
        <H2>Then start with a free plan.</H2>
        <p style={{ fontSize: '16px', lineHeight: 1.6, color: 'var(--ink-2)', margin: '0 0 22px' }}>
          Every plan below is the real thing the engine builds, laid out week by week and
          free to read in full. No email, no signup. And every new account gets two weeks
          of the full app regardless, so you can see what the coaching adds.
        </p>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
          {DISTANCES.map(d => (
            <Link key={d.slug} href={`/plans/${d.slug}`} style={{
              display: 'inline-flex', alignItems: 'baseline', gap: '8px',
              textDecoration: 'none',
              background: 'var(--card)', border: '1px solid var(--line)',
              borderRadius: '100px', padding: '10px 18px',
            }}>
              <span style={{ fontSize: '15px', fontWeight: 700, color: 'var(--ink)' }}>{d.label}</span>
              <span style={{ fontSize: '12px', color: 'var(--mute)' }}>{d.weeks}</span>
            </Link>
          ))}
        </div>
      </section>

      {/* ── FAQ ─────────────────────────────────────────────────────────── */}
      <section style={{ maxWidth: SECTION_MAX, margin: '0 auto', padding: '56px 24px 0' }}>
        <Eyebrow>Questions</Eyebrow>
        <H2>The ones charity runners actually ask.</H2>
        <div style={{
          border: '1px solid var(--line)', borderRadius: 'var(--radius-lg)',
          background: 'var(--card)', boxShadow: 'var(--shadow-card)', overflow: 'hidden',
          marginTop: '22px',
        }}>
          {FAQS.map((f, i) => (
            <details key={f.q} style={{ borderTop: i === 0 ? 'none' : '1px solid var(--line)' }}>
              <summary style={{
                listStyle: 'none', cursor: 'pointer', padding: '17px 20px',
                fontFamily: 'var(--font-brand)', fontSize: '15.5px', fontWeight: 600,
                color: 'var(--ink)',
              }}>{f.q}</summary>
              <div style={{
                padding: '0 20px 17px', fontSize: '15px', lineHeight: 1.6,
                color: 'var(--ink-2)',
              }}>{f.a}</div>
            </details>
          ))}
        </div>
      </section>

      {/* ── Close ───────────────────────────────────────────────────────── */}
      <section style={{ maxWidth: SECTION_MAX, margin: '0 auto', padding: '48px 24px 72px' }}>
        <div style={{
          background: 'var(--card)', border: '1px solid var(--line)',
          borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-card)',
          padding: '28px 24px',
        }}>
          <h2 style={{ fontSize: '21px', fontWeight: 800, color: 'var(--ink)', margin: '0 0 10px', letterSpacing: '-0.01em' }}>
            Get to the start line in one piece.
          </h2>
          <p style={{ fontSize: '15px', lineHeight: 1.6, color: 'var(--ink-2)', margin: '0 0 18px' }}>
            That is the job, and it is a harder one than going fast. Download the app,
            put your code in, and let it tell you to slow down.
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '14px', alignItems: 'center' }}>
            <AppStoreBadge />
          </div>
        </div>
      </section>

      <SiteFooter />
    </main>
  )
}
