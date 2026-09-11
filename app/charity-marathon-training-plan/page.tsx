// GTM-CHARITY-01 — landing page for charity-place marathon runners.
//
// WHY THIS PAGE EXISTS. A charity partner is referring its runners to Zonna,
// which is the product's first real referral channel. The SLT reviewed it on
// 2026-09-11 and ruled: do NOT bend the homepage toward this audience, give
// them their own page. Bending the ICP hero toward a non-ICP audience is how
// positioning dissolves (Traynor); the pattern already exists in the SEO plan
// pages, so use it.
//
// THE AUDIENCE IS NOT THE STATED ICP, AND THAT IS THE POINT OF THE PAGE.
// brand.md defines the audience as "adult runners, 1+ years' experience".
// Charity-place runners skew hard the other way: first marathon, entered for a
// cause, often with no structured training behind them. The homepage is written
// for someone who already runs. This page is written for someone who does not
// yet, WITHOUT changing what the product claims.
//
// The honest bridge, and the reason this is not a bolt-on: Zonna's core truth
// is "you're trying hard, that's the problem." A first-timer's version of that
// failure is not going medium-hard on every easy day, it is heroing sessions
// early, breaking down in the middle of the block, and missing the start line.
// Same mechanism, different surface. So the page leads with the injury risk
// rather than with a promise of speed, which is both on-brand and true.
//
// NO PARTNER BRANDING, DELIBERATELY. This page names no charity, carries no
// charity logo, and claims no endorsement. Naming a real organisation implies a
// relationship the page cannot evidence, and co-branding is a founder and legal
// decision made WITH the partner, not a copy decision made here. The page works
// as a generic charity-runner landing page, so it serves the referral traffic
// either way.
//
// TIER HONESTY IS LOAD-BEARING HERE. MARATHON has free_tier_available: false
// (PLAN_SIGNATURES), so a charity runner can only GENERATE a marathon plan
// during the 14-day trial or on the paid tier. Under Option A they keep the
// plan afterwards but cannot regenerate it. That is stated plainly below rather
// than discovered after signup, which for this audience is the difference
// between a referral channel and a complaint.

import type { Metadata } from 'next'
import Link from 'next/link'
import { BRAND, PRICING } from '@/lib/brand'
import { SiteHeader, SITE_WIDTH } from '@/components/marketing/SiteHeader'
import { SiteFooter } from '@/components/marketing/SiteFooter'
import { AppStoreBadge } from '@/components/marketing/AppStoreBadge'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.zonna.run'
const PAGE_URL = `${APP_URL}/charity-marathon-training-plan`
const READ_MAX = 760

export const revalidate = 86400

export const metadata: Metadata = {
  title: `Charity Marathon Training Plan | ${BRAND.name}`,
  description:
    'A free 16-week marathon training plan for charity-place runners. Mostly easy running, every session zoned, built so you reach the start line uninjured.',
  alternates: { canonical: PAGE_URL },
  openGraph: {
    title: `Running a marathon for charity? Make the start line. | ${BRAND.name}`,
    description:
      'Most charity runners do not miss their marathon because they were slow. They miss it because they got injured in training. Here is the free plan that does not do that.',
    url: PAGE_URL,
    siteName: BRAND.name,
    images: [{ url: `${APP_URL}/api/og`, width: 1200, height: 630 }],
    type: 'article',
    locale: 'en_GB',
  },
  twitter: {
    card: 'summary_large_image',
    title: `Charity marathon training, without breaking yourself | ${BRAND.name}`,
    description:
      'A free 16-week plan built on easy running, for runners with a charity place and a start line to reach.',
    images: [`${APP_URL}/api/og`],
  },
}

const FAQS: { q: string; a: string }[] = [
  {
    q: 'I have never run a marathon. Is this for me?',
    a: 'Yes, with one caveat worth saying out loud. This plan assumes you can already run about 30 minutes without stopping. If you cannot yet, spend a few weeks building to that first and come back. Starting a 16-week marathon block from zero is the single most reliable way to get injured.',
  },
  {
    q: 'Why is so much of it easy? I have a marathon to train for.',
    a: 'Because that is what works, and because the alternative is what breaks people. Running easy on your easy days is what lets the one hard session a week actually be hard. Charity runners rarely miss the start line through lack of effort. They miss it through too much of it, too early.',
  },
  {
    q: 'How many weeks do I need?',
    a: 'Sixteen is the plan below. Twelve is workable if you are already running a few times a week. Under that, the honest answer is to pick a shorter goal race first, or accept that the marathon becomes about finishing rather than a time. We would rather say that now than sell you a plan that pretends otherwise.',
  },
  {
    q: 'What if I miss a week? Work, illness, life.',
    a: 'Nothing breaks. Missed sessions are a feature of adult life, not a failure. On the paid tier the plan reshapes around what you actually did. On the free tier the plan stays as generated and you pick it back up. Either way nobody guilt-trips you.',
  },
  {
    q: 'Do I need a watch?',
    a: `It works best with a heart-rate source, an Apple Watch or a chest strap that writes to Apple Health, because that is what proves your easy days are genuinely easy. Without one you still get the plan, the paces and the structure. You just judge effort yourself.`,
  },
  {
    q: 'Is it free?',
    a: `The 16-week plan on this page is free to read, right now, with no signup. In the app you get two weeks of everything, then a free tier that keeps the plan you built. ${PRICING.monthly.display}/month or ${PRICING.annual.display}/year if you want the coaching and the reshaping. One thing to know up front: marathon plan generation sits inside the trial and the paid tier, so if you want the app to build and adapt your marathon plan, that is the part you are paying for.`,
  },
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
      fontFamily: 'var(--font-brand)', fontSize: 'clamp(24px, 4vw, 32px)',
      fontWeight: 800, color: 'var(--ink)', letterSpacing: '-0.02em',
      lineHeight: 1.15, margin: '0 0 16px',
    }}>{children}</h2>
  )
}

function P({ children }: { children: React.ReactNode }) {
  return (
    <p style={{
      fontSize: '16px', lineHeight: 1.6, color: 'var(--ink-2)',
      margin: '0 0 14px', maxWidth: `${READ_MAX}px`,
    }}>{children}</p>
  )
}

export default function CharityMarathonPage() {
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
        { '@type': 'ListItem', position: 2, name: 'Charity marathon training', item: PAGE_URL },
      ],
    },
  ]

  return (
    <main style={{ background: 'var(--bg)', color: 'var(--ink)', minHeight: '100vh', fontFamily: 'var(--font-ui)' }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld) }} />

      <SiteHeader />

      {/* ── Hero ────────────────────────────────────────────────────────── */}
      <section style={{ maxWidth: `${SITE_WIDTH}px`, margin: '0 auto', padding: '64px 24px 40px' }}>
        <div style={{ maxWidth: `${READ_MAX}px` }}>
          <Eyebrow>For charity runners</Eyebrow>
          <h1 style={{
            fontFamily: 'var(--font-brand)', fontSize: 'clamp(32px, 6vw, 52px)',
            fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1.08,
            margin: '0 0 20px', color: 'var(--ink)',
          }}>
            You got the place. The job now is making the start line.
          </h1>
          <p style={{ fontSize: '18px', lineHeight: 1.55, color: 'var(--ink-2)', margin: '0 0 28px' }}>
            Most people who take a charity place and do not make it to race day are not
            stopped by the distance. They are stopped in week nine, by a calf or a knee
            or an IT band, after a training block that asked too much too early. This is
            the plan that does not do that to you.
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '14px', alignItems: 'center' }}>
            <Link href="/plans/marathon-16-week" style={{
              display: 'inline-flex', alignItems: 'center', gap: '8px',
              background: 'var(--moss)', color: 'var(--card)',
              fontSize: '15px', fontWeight: 600, textDecoration: 'none',
              padding: '14px 22px', borderRadius: '100px',
            }}>
              Read the free 16-week plan <span aria-hidden style={{ opacity: 0.6 }}>&rarr;</span>
            </Link>
            <AppStoreBadge />
          </div>
          <p style={{ fontSize: '13px', color: 'var(--mute)', margin: '14px 0 0' }}>
            No signup to read it. No wall.
          </p>
        </div>
      </section>

      {/* ── The real risk ───────────────────────────────────────────────── */}
      <section style={{
        background: 'var(--bg-soft)',
        borderTop: '1px solid var(--line)', borderBottom: '1px solid var(--line)',
        padding: '72px 24px',
      }}>
        <div style={{ maxWidth: `${SITE_WIDTH}px`, margin: '0 auto' }}>
          <Eyebrow>The thing nobody tells you</Eyebrow>
          <H2>The risk is not that you are too slow. It is that you try too hard.</H2>
          <P>
            You have a cause, a fundraising page and people watching. That is a lot of
            motivation, and motivation is exactly what gets first-time marathon runners
            hurt. Every easy run becomes a bit quicker than it should be. Every long run
            becomes a test. Nothing is ever properly easy, so nothing is ever properly
            recovered, and the body files the bill somewhere around week nine.
          </P>
          <P>
            {BRAND.name} exists for that specific problem. It sets a zone for every
            session and holds you to it, which mostly means telling you to slow down on
            days you were planning to prove something. It is not the exciting version of
            training. It is the version that gets you to the start line.
          </P>
        </div>
      </section>

      {/* ── What the plan actually does ─────────────────────────────────── */}
      <section style={{ maxWidth: `${SITE_WIDTH}px`, margin: '0 auto', padding: '72px 24px' }}>
        <Eyebrow>What you get</Eyebrow>
        <H2>Sixteen weeks, mostly easy, one hard day.</H2>
        {/* 360px min, not 260px: at the 1100px site width a 260px min fits
            THREE columns, which leaves the fourth card orphaned on its own row.
            360 forces a clean 2x2 on desktop. min(100%, ...) keeps it to a
            single column on a phone instead of overflowing. */}
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 360px), 1fr))',
          gap: '18px', marginTop: '28px',
        }}>
          {[
            ['Most of it is easy on purpose',
             'The majority of the plan is run at a conversational effort. That is not the plan being gentle with you, it is the plan working.'],
            ['One quality session a week',
             'From the build phase, one session a week asks something of you. One. The rest protects it.'],
            ['Every run has a zone and a pace band',
             'Derived from your inputs, not guessed, so "easy" is a number you can check rather than a feeling you can talk yourself out of.'],
            ['A long run that builds you up',
             'The long run climbs steadily and backs off on recovery weeks, instead of getting longer every single week until something gives.'],
          ].map(([title, body]) => (
            <div key={title} style={{
              background: 'var(--card)', border: '1px solid var(--line)',
              borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-card)',
              padding: '22px 20px',
            }}>
              <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--ink)', margin: '0 0 8px' }}>{title}</h3>
              <p style={{ fontSize: '14px', lineHeight: 1.55, color: 'var(--ink-2)', margin: 0 }}>{body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Honest about the paid line. Do not soften this section. ─────── */}
      <section style={{ maxWidth: `${SITE_WIDTH}px`, margin: '0 auto', padding: '0 24px 72px' }}>
        <div style={{
          background: 'var(--card)', border: '1px solid var(--line)',
          borderLeft: '3px solid var(--warn)',
          borderRadius: 'var(--radius-lg)', padding: '26px 24px', maxWidth: `${READ_MAX}px`,
        }}>
          <h3 style={{ fontSize: '17px', fontWeight: 700, color: 'var(--ink)', margin: '0 0 10px' }}>
            What is free and what is not
          </h3>
          <P>
            The 16-week plan is free to read on this site, in full, with no signup. You
            can follow it from a screenshot and never pay us anything.
          </P>
          <P>
            The app is the part that adapts. It sets your real heart-rate zones, moves
            sessions when your week changes, and tells you afterwards whether you
            actually held the zone. New accounts get two weeks of all of it. After that a
            free tier keeps the plan you built.
          </P>
          <p style={{ fontSize: '16px', lineHeight: 1.6, color: 'var(--ink-2)', margin: 0 }}>
            One thing worth knowing before you start rather than after: marathon plan
            generation sits inside the trial and the paid tier. You keep a marathon plan
            you built during the trial, but building a new one is a paid feature. We
            would rather you knew that on this page.
          </p>
        </div>
      </section>

      {/* ── FAQ ─────────────────────────────────────────────────────────── */}
      <section style={{ maxWidth: `${SITE_WIDTH}px`, margin: '0 auto', padding: '0 24px 72px' }}>
        <Eyebrow>Questions</Eyebrow>
        <H2>The ones charity runners actually ask.</H2>
        <div style={{
          border: '1px solid var(--line)', borderRadius: 'var(--radius-lg)',
          background: 'var(--card)', boxShadow: 'var(--shadow-card)', overflow: 'hidden',
          maxWidth: `${READ_MAX}px`, marginTop: '24px',
        }}>
          {FAQS.map((f, i) => (
            <details key={f.q} style={{ borderTop: i === 0 ? 'none' : '1px solid var(--line)' }}>
              <summary style={{
                listStyle: 'none', cursor: 'pointer', padding: '18px 20px',
                fontFamily: 'var(--font-brand)', fontSize: '16px', fontWeight: 600,
                color: 'var(--ink)',
              }}>{f.q}</summary>
              <div style={{
                padding: '0 20px 18px', fontSize: '15px', lineHeight: 1.6,
                color: 'var(--ink-2)',
              }}>{f.a}</div>
            </details>
          ))}
        </div>
      </section>

      {/* ── Close ───────────────────────────────────────────────────────── */}
      <section style={{ maxWidth: `${SITE_WIDTH}px`, margin: '0 auto', padding: '0 24px 80px' }}>
        <div style={{
          background: 'var(--card)', border: '1px solid var(--line)',
          borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-card)',
          padding: '30px 26px', maxWidth: `${READ_MAX}px`,
        }}>
          <h2 style={{ fontSize: '22px', fontWeight: 800, color: 'var(--ink)', margin: '0 0 10px', letterSpacing: '-0.01em' }}>
            Start with the plan. Decide about the app later.
          </h2>
          <p style={{ fontSize: '15px', lineHeight: 1.6, color: 'var(--ink-2)', margin: '0 0 18px' }}>
            Read all sixteen weeks, see how much of it is easy, and judge for yourself
            whether that looks like training you could actually hold down alongside a job
            and a fundraising target.
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '14px', alignItems: 'center' }}>
            <Link href="/plans/marathon-16-week" style={{
              display: 'inline-flex', alignItems: 'center', gap: '8px',
              background: 'var(--moss)', color: 'var(--card)',
              fontSize: '15px', fontWeight: 600, textDecoration: 'none',
              padding: '13px 20px', borderRadius: '100px',
            }}>
              Read the free 16-week plan <span aria-hidden style={{ opacity: 0.6 }}>&rarr;</span>
            </Link>
            <Link href="/plans" style={{ fontSize: '15px', fontWeight: 600, color: 'var(--moss)', textDecoration: 'none' }}>
              Or a shorter distance first &rarr;
            </Link>
          </div>
        </div>
      </section>

      <SiteFooter />
    </main>
  )
}
