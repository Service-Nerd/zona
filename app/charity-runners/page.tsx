// GTM-CHARITY-01 — landing page for runners on a charity place.
//
// WHY THIS PAGE EXISTS. A charity partner is referring its runners to Zonna,
// the product's first real referral channel. The SLT ruled on 2026-09-11: do
// NOT bend the homepage toward this audience, give them their own page, the way
// the SEO plan pages already do.
//
// NOT MARATHON-SPECIFIC (founder correction, 2026-09-11). The first version of
// this page was marathon-only in its URL, title, every FAQ and both CTAs. That
// was wrong about the audience: charity places are most often 10K and half
// marathon, with marathons and the occasional ultra on top. A distance-shaped
// page turns most of the people it is written for away at the headline. The
// page now leads with the shared problem and lets the runner pick the distance.
//
// THE AUDIENCE IS NOT THE STATED ICP, AND THAT IS THE POINT OF THE PAGE.
// brand.md defines the audience as "adult runners, 1+ years' experience".
// Charity-place runners skew the other way: often a first race at the distance,
// entered for a cause. The homepage is written for someone who already runs.
// This page is written for someone who may not yet, WITHOUT changing what the
// product claims.
//
// The honest bridge, and the reason this is not a bolt-on: Zonna's core truth
// is "you're trying hard, that's the problem". A charity runner's version of
// that failure is not grey-zoning every easy day, it is heroing sessions early
// with a fundraising page watching, breaking down mid-block, and missing the
// start line. Same mechanism, different surface. So the page leads with the
// injury risk rather than with a promise of speed.
//
// NO PARTNER BRANDING, DELIBERATELY. This page names no charity, carries no
// charity logo, and claims no endorsement. Naming a real organisation implies a
// relationship the page cannot evidence, and co-branding is a founder and legal
// decision made WITH the partner, not a copy decision made here. The page works
// as a generic charity-runner landing page, so it serves the traffic either way.
//
// NO MENTION OF ACCESS CODES. Free app access for charity runners is being
// designed (see backlog) and does not exist yet. The page describes what is
// true TODAY. Add that section when redemption actually ships, not before.
//
// LAYOUT: SECTION_MAX, like every other marketing page. The first version used
// SITE_WIDTH (1100) for its sections while /plans, /comparisons and the plan
// spokes all use 760, so the content column jumped width as you navigated into
// it. Same class of defect GTM-SITE-01 fixed for the header.

import type { Metadata } from 'next'
import Link from 'next/link'
import { BRAND, PRICING } from '@/lib/brand'
import { SiteHeader } from '@/components/marketing/SiteHeader'
import { SiteFooter } from '@/components/marketing/SiteFooter'
import { AppStoreBadge } from '@/components/marketing/AppStoreBadge'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.zonna.run'
const PAGE_URL = `${APP_URL}/charity-runners`

/** The site's content column. Matches PlanPage, ComparisonPage and /plans. */
const SECTION_MAX = 760

export const revalidate = 86400

export const metadata: Metadata = {
  title: `Training Plans for Charity Runners | ${BRAND.name}`,
  description:
    'Free training plans for runners with a charity place, from 10K to marathon. Mostly easy running, every session zoned, built so you reach the start line uninjured.',
  alternates: { canonical: PAGE_URL },
  openGraph: {
    title: `Running for charity? Make the start line. | ${BRAND.name}`,
    description:
      'Most charity runners do not miss their race because they were slow. They miss it because they got injured in training. Here are the free plans that do not do that.',
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
      'Free plans built on easy running, for runners with a charity place and a start line to reach.',
    images: [`${APP_URL}/api/og`],
  },
}

/** The four free plans, by distance. Ultra is deliberately absent: 50K and 100K
 *  have no free static plan on this site, and the page says so rather than
 *  linking somewhere that does not answer the question. */
const DISTANCES = [
  { slug: '5k-12-week',            label: '5K',            weeks: '12 weeks', note: 'A real race distance, and the sanest place to start if this is new.' },
  { slug: '10k-12-week',           label: '10K',           weeks: '12 weeks', note: 'The most common charity place, and far enough to punish a rushed build.' },
  { slug: 'half-marathon-12-week', label: 'Half marathon', weeks: '12 weeks', note: 'Long enough that the easy days stop being optional.' },
  { slug: 'marathon-16-week',      label: 'Marathon',      weeks: '16 weeks', note: 'The one where getting to the start line is most of the job.' },
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
    q: 'I have never raced this distance. Is this for me?',
    a: 'Yes, with one caveat worth saying out loud. These plans assume you can already run about 30 minutes without stopping. If you cannot yet, spend a few weeks building to that first and then start. Beginning a structured block from zero is the single most reliable way to get injured before race day.',
  },
  {
    q: 'Why is so much of it easy? I have a race to train for.',
    a: 'Because that is what works, and because the alternative is what breaks people. Running easy on your easy days is what lets the one hard session a week actually be hard. Charity runners rarely miss the start line through lack of effort. They miss it through too much of it, too early.',
  },
  {
    q: 'How many weeks do I need?',
    a: 'Twelve for a 5K, 10K or half marathon, sixteen for a marathon. Less is workable if you are already running a few times a week. Well under that, the honest answer is to pick a shorter goal race first, or accept that the day becomes about finishing rather than a time. We would rather say that now than sell you a plan that pretends otherwise.',
  },
  {
    q: 'I am doing an ultra. Is there a plan here?',
    a: 'Not as a free plan on this site. The app builds 50K and 100K plans, and those sit inside the trial and the paid tier. If your charity place is an ultra and you have never raced one, the most useful thing on this page is still the advice: most of your week should be easy, and the long run is the session that earns the day.',
  },
  {
    q: 'What if I miss a week? Work, illness, life.',
    a: 'Nothing breaks. Missed sessions are a feature of adult life, not a failure. On the paid tier the plan reshapes around what you actually did. On the free tier the plan stays as generated and you pick it back up. Either way nobody guilt-trips you.',
  },
  {
    q: 'Do I need a watch?',
    a: 'It works best with a heart-rate source, an Apple Watch or a chest strap that writes to Apple Health, because that is what proves your easy days are genuinely easy. Without one you still get the plan, the paces and the structure. You just judge effort yourself.',
  },
  {
    q: 'Is it free?',
    a: `Every plan on this page is free to read, right now, with no signup. In the app you get two weeks of everything, then a free tier that keeps the plan you built. ${PRICING.monthly.display}/month or ${PRICING.annual.display}/year if you want the coaching and the reshaping.`,
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
          You got the place. The job now is making the start line.
        </h1>
        <p style={{ fontSize: '17px', lineHeight: 1.55, color: 'var(--ink-2)', margin: '0 0 26px' }}>
          Whether it is a 10K or a marathon, most people who take a charity place and do
          not make it to race day are not stopped by the distance. They are stopped in the
          middle of the block by a calf or a knee, after training that asked too much too
          early. These are the plans that do not do that to you.
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '14px', alignItems: 'center' }}>
          <a href="#pick" style={{
            display: 'inline-flex', alignItems: 'center', gap: '8px',
            background: 'var(--moss)', color: 'var(--card)',
            fontSize: '15px', fontWeight: 600, textDecoration: 'none',
            padding: '14px 22px', borderRadius: '100px',
          }}>
            Find your free plan <span aria-hidden style={{ opacity: 0.6 }}>&darr;</span>
          </a>
          <AppStoreBadge />
        </div>
        <p style={{ fontSize: '13px', color: 'var(--mute)', margin: '14px 0 0' }}>
          No signup to read them. No wall.
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

      {/* ── Pick your distance ──────────────────────────────────────────── */}
      <section id="pick" style={{ maxWidth: SECTION_MAX, margin: '0 auto', padding: '64px 24px 0', scrollMarginTop: '80px' }}>
        <Eyebrow>Pick your distance</Eyebrow>
        <H2>Free plans, whatever you signed up for.</H2>
        <p style={{ fontSize: '16px', lineHeight: 1.6, color: 'var(--ink-2)', margin: '0 0 24px' }}>
          Every one of these is the real thing the engine builds, laid out week by week and
          free to read in full. No email, no signup.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {DISTANCES.map(d => (
            <Link key={d.slug} href={`/plans/${d.slug}`} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              gap: '16px', textDecoration: 'none',
              background: 'var(--card)', border: '1px solid var(--line)',
              borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-card)',
              padding: '18px 20px',
            }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '17px', fontWeight: 700, color: 'var(--ink)' }}>{d.label}</span>
                  <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--mute)' }}>{d.weeks}</span>
                </div>
                <div style={{ fontSize: '14px', lineHeight: 1.5, color: 'var(--ink-2)', marginTop: '4px' }}>
                  {d.note}
                </div>
              </div>
              <span aria-hidden style={{ color: 'var(--moss)', fontWeight: 700, flexShrink: 0 }}>&rarr;</span>
            </Link>
          ))}
        </div>

        {/* Ultra: say the true thing rather than link somewhere that does not answer it. */}
        <p style={{
          fontSize: '14px', lineHeight: 1.6, color: 'var(--mute)',
          margin: '16px 0 0', borderLeft: '2px solid var(--line-strong)', paddingLeft: '14px',
        }}>
          Doing an ultra? There is no free 50K or 100K plan on this site. The app builds
          them, and that sits inside the trial and the paid tier. The advice on this page
          still holds, and holds harder: the further the race, the more of your week should
          be easy.
        </p>
      </section>

      {/* ── What every plan does ────────────────────────────────────────── */}
      <section style={{ maxWidth: SECTION_MAX, margin: '0 auto', padding: '64px 24px 0' }}>
        <Eyebrow>What you get</Eyebrow>
        <H2>Mostly easy. One hard day. Every run zoned.</H2>
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 330px), 1fr))',
          gap: '14px', marginTop: '24px',
        }}>
          {[
            ['Most of it is easy on purpose',
             'The majority of every plan is run at a conversational effort. That is not the plan being gentle with you, it is the plan working.'],
            ['One quality session a week',
             'From the build phase, one session a week asks something of you. One. The rest protects it.'],
            ['Every run has a zone and a pace band',
             'Derived from your inputs, not guessed, so "easy" is a number you can check rather than a feeling you can talk yourself out of.'],
            ['A long run that builds you up',
             'It climbs steadily and backs off on recovery weeks, instead of getting longer every single week until something gives.'],
          ].map(([title, body]) => (
            <div key={title} style={{
              background: 'var(--card)', border: '1px solid var(--line)',
              borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-card)',
              padding: '20px 18px',
            }}>
              <h3 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--ink)', margin: '0 0 8px' }}>{title}</h3>
              <p style={{ fontSize: '14px', lineHeight: 1.55, color: 'var(--ink-2)', margin: 0 }}>{body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Honest about the paid line. Do not soften this section. ─────── */}
      <section style={{ maxWidth: SECTION_MAX, margin: '0 auto', padding: '48px 24px 0' }}>
        <div style={{
          background: 'var(--card)', border: '1px solid var(--line)',
          borderLeft: '3px solid var(--warn)',
          borderRadius: 'var(--radius-lg)', padding: '24px 22px',
        }}>
          <h3 style={{ fontSize: '17px', fontWeight: 700, color: 'var(--ink)', margin: '0 0 10px' }}>
            What is free and what is not
          </h3>
          <P>
            Every plan linked above is free to read on this site, in full, with no signup.
            You can follow one from a screenshot and never pay us anything.
          </P>
          <P>
            The app is the part that adapts. It sets your real heart-rate zones, moves
            sessions when your week changes, and tells you afterwards whether you actually
            held the zone. New accounts get two weeks of all of it. After that a free tier
            keeps the plan you built.
          </P>
          <p style={{ fontSize: '16px', lineHeight: 1.6, color: 'var(--ink-2)', margin: 0 }}>
            One thing worth knowing before you start rather than after: in the app, 5K, 10K
            and half marathon plans can be built on the free tier. Marathon and ultra plan
            generation sits inside the trial and the paid tier. You keep a plan you built
            during the trial either way.
          </p>
        </div>
      </section>

      {/* ── FAQ ─────────────────────────────────────────────────────────── */}
      <section style={{ maxWidth: SECTION_MAX, margin: '0 auto', padding: '64px 24px 0' }}>
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
            Start with the plan. Decide about the app later.
          </h2>
          <p style={{ fontSize: '15px', lineHeight: 1.6, color: 'var(--ink-2)', margin: '0 0 18px' }}>
            Read the whole thing, see how much of it is easy, and judge for yourself whether
            that looks like training you could actually hold down alongside a job and a
            fundraising target.
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '14px', alignItems: 'center' }}>
            <a href="#pick" style={{
              display: 'inline-flex', alignItems: 'center', gap: '8px',
              background: 'var(--moss)', color: 'var(--card)',
              fontSize: '15px', fontWeight: 600, textDecoration: 'none',
              padding: '13px 20px', borderRadius: '100px',
            }}>
              Pick your distance <span aria-hidden style={{ opacity: 0.6 }}>&uarr;</span>
            </a>
            <Link href="/plans" style={{ fontSize: '15px', fontWeight: 600, color: 'var(--moss)', textDecoration: 'none' }}>
              Or see every free plan &rarr;
            </Link>
          </div>
        </div>
      </section>

      <SiteFooter />
    </main>
  )
}
