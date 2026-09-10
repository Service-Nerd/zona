// GTM-08 — Marketing landing page (FREE, public).
//
// Renders a one-page site for unauthenticated visitors; signed-in visitors are
// forwarded to /dashboard server-side so they never see the marketing surface.
//
// ─── Public, gated by env ──────────────────────────────────────────────────
// MARKETING_SITE_ENABLED=true in production (post-launch). When falsy, the
// root route falls back to redirect-to-dashboard — useful as a kill switch.
//
// Copy is sourced from `lib/brand.ts` for the locked brand strings so a rename
// only touches that file. Page-structural marketing prose lives inline here
// (same precedent as the thesis / pillar cards). Tagline placement:
//   • Hero kicker         → BRAND.tagline           (voice leads — names the user)
//   • Hero headline (h1)  → BRAND.marketingH1        (functional, discovery/SEO)
//   • Closing voice line  → BRAND.brandStatement    (personality moment)
//
// ─── Brand-rule note (revisit if challenged) ───────────────────────────────
// CLAUDE.md locks "never mix two taglines on the same surface" and maps the
// landing-page hero to appStoreSubtitle. On a *destination marketing* surface
// (not the App Store), voice should lead — so the tagline is elevated to the
// hero kicker while the <h1> carries the functional, keyword-bearing headline.
// This is the deliberate, documented exception for this surface only.
// Separately: BRAND.voiceAnchor ("Hold the zone.") is product-internal and
// explicitly NOT for marketing copy — it has been removed from this hero.
//
// Product mockups are pure CSS (Warm Slate tokens). Faster than maintaining
// real screenshots through redesigns, and stays on-palette automatically.

import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { BRAND, PRICING } from '@/lib/brand'
import { SiteHeader } from '@/components/marketing/SiteHeader'
import { SiteFooter } from '@/components/marketing/SiteFooter'
import { AppStoreBadge } from '@/components/marketing/AppStoreBadge'
import { PhoneFrame } from '@/components/marketing/PhoneFrame'
import { Wordmark } from '@/components/ui/Wordmark'

export const dynamic = 'force-dynamic'  // auth check must run per-request

// ─── Page-level metadata (overrides layout.tsx defaults for this route) ──────
// Description: 155 chars — rich enough for Google's snippet, honest tone.
// Canonical: prevents /rts-training-hub.vercel.app and /zonna.run indexing
// the same page as duplicates once the custom domain is live.
// NEXT_PUBLIC_APP_URL is deliberately NOT set (GTM-SITE-01) — www is canonical
// and the value lives in the committed default below. See CLAUDE.md.
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.zonna.run'

export const metadata: Metadata = {
  // SEO-01 — keyword-first, brand last. Deliberately NOT `${BRAND.appStoreSubtitle}`:
  // the App Store subtitle is brand-first by design and still drives og:/twitter:
  // below, which are social-share copy where brand-first is correct.
  title: `Running Plans to Stop You Overtraining | ${BRAND.name}`,
  // SEO-01 — 149 chars, inside Google's ~155 snippet budget.
  description: `Training plans for runners who go medium-hard on everything. ${BRAND.name} sets the zone for each session and holds you to it. Built for the day-job runner.`,
  alternates: {
    canonical: APP_URL,
  },
  openGraph: {
    title: `${BRAND.name} — ${BRAND.appStoreSubtitle}`,
    description: `Training plans for runners who overtrain. ${BRAND.name} prescribes the zone for each session — easy when it's easy, hard when it's hard.`,
    url: APP_URL,
    siteName: BRAND.name,
    images: [{ url: `${APP_URL}/api/og`, width: 1200, height: 630, alt: `${BRAND.name} — ${BRAND.appStoreSubtitle}` }],
    type: 'website',
    locale: 'en_GB',
  },
  twitter: {
    card: 'summary_large_image',
    title: `${BRAND.name} — ${BRAND.appStoreSubtitle}`,
    description: `Training plans for runners who go medium-hard on everything. ${BRAND.name} holds you to your zones.`,
    images: [`${APP_URL}/api/og`],
  },
}

const MARKETING_LIVE = process.env.MARKETING_SITE_ENABLED === 'true'

export default async function Home() {
  // Dark-launch gate — until MARKETING_SITE_ENABLED=true, behave like the
  // legacy redirect. Keeps the marketing surface out of production discovery
  // (search engines, share previews) while the codebase lives at /.
  if (!MARKETING_LIVE) redirect('/dashboard')

  // Server-side auth check — signed-in visitors skip the marketing page.
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (user) redirect('/dashboard')

  // ── SEO-01 — SoftwareApplication structured data ──────────────────────────
  // Rendered here rather than in app/layout.tsx: that layout is the ROOT layout
  // and also serves /dashboard and /auth, where this markup would be wrong. There
  // is no marketing-specific layout.
  //
  // NO aggregateRating. There are no ratings yet, and inventing one is a Google
  // manual-action risk (structured-data spam) as well as being untrue.
  //
  // `description` is the same string as the meta description above, deliberately.
  // Price comes from PRICING, never a literal, so a price change cannot leave the
  // rich result stale (CLAUDE.md: pricing is parameterised in lib/brand.ts).
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: BRAND.name,
    description: `Training plans for runners who go medium-hard on everything. ${BRAND.name} sets the zone for each session and holds you to it. Built for the day-job runner.`,
    applicationCategory: 'HealthApplication',
    operatingSystem: 'iOS 16.6 or later',
    url: APP_URL,
    installUrl: BRAND.appStore.url,
    author: { '@type': 'Person', name: 'Russell Shear' },
    offers: {
      '@type': 'Offer',
      price: String(PRICING.monthly.amount),
      priceCurrency: PRICING.currency,
    },
  }

  return (
    <main style={{ background: 'var(--bg)', color: 'var(--ink)', minHeight: '100vh', fontFamily: 'var(--font-ui)' }}>

      {/* SEO-01 — structured data. Next.js recommends this exact pattern for
          JSON-LD in the App Router. Not user-visible. */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* ── Top nav — wordmark + free-plans link ─────────────────────────── */}
      <SiteHeader />

      {/* ── Hero ─────────────────────────────────────────────────────── */}
      <section style={{
        maxWidth: '780px', margin: '0 auto',
        padding: '56px 24px 80px',
        textAlign: 'center',
      }}>
        {/* GTM-SITE-01 — the tagline kicker was REMOVED from this hero.
            brand.md locks three lines and says never mix two on one surface;
            this stacked `BRAND.tagline` directly above `BRAND.marketingH1`, the
            web expression of line #1. Two locked lines, one block.

            brand.md's placement table gives the tagline "Login, loading, OG
            image, meta description" and gives the landing hero to the H1.

            PRECISE about where it still lives, because the first version of this
            comment was wrong: this page sets its OWN description, og:description
            and twitter:description (SEO-01 keyword copy), so the tagline is NOT
            the homepage's meta description — that inheritance only applies to
            pages which set none, i.e. /support, /privacy, /terms. What the
            tagline DOES still own here is the OG IMAGE: app/api/og/route.tsx
            renders it bottom-left, so it appears on every share card. Plus
            login and loading, per the table. None of those is the landing hero.

            Precedent: DIV-020 ("tagline rendered on splash + login +
            orientation... over-use degrades the asset") closed the same way. */}
        
        {/* v2 (design_handoff_v2) — hero type up. clamp(36,6vw,56) → clamp(40,7vw,68)
            with tighter tracking; the marketing H1 is the page's largest statement. */}
        <h1 style={{
          fontFamily: 'var(--font-brand)',
          fontSize: 'clamp(40px, 7vw, 68px)',
          fontWeight: 700, lineHeight: 1.03, letterSpacing: '-0.025em',
          color: 'var(--ink)',
          margin: '0 0 24px',
        }}>
          {/* SEO-01 — its OWN constant, deliberately not BRAND.appStoreSubtitle:
              that one is capped at 30 chars by Apple (currently 30/30) and still
              drives og:/twitter: titles. See lib/brand.ts. */}
          {BRAND.marketingH1}
        </h1>

        <p style={{
          fontSize: '18px', lineHeight: 1.55, color: 'var(--ink-2)',
          maxWidth: '560px', margin: '0 auto 36px',
        }}>
          You&apos;re trying hard. That&apos;s the problem. Most amateur runners go medium-hard on
          everything — never truly recover, never truly push, and wonder why they don&apos;t improve.
          {' '}{BRAND.name} prescribes the zone for each session and holds you to it.
        </p>

        {/* Primary action — App Store download. Single CTA, post-launch. */}
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <AppStoreBadge />
        </div>

        {/* Trial + pricing in owned voice — honest numbers, brand tone. */}
        <p style={{
          marginTop: '22px',
          fontSize: '14px', lineHeight: 1.5, color: 'var(--ink-2)',
        }}>
          Two weeks, full access. After that, keep the plan you built on the free tier, or
          stay on all of it for {PRICING.monthly.display}/month or {PRICING.annual.display}/year.
          We won&apos;t email you to come back.
        </p>

        {/* HR-SYNC-04 — device expectation-setter. Replaces the older, weaker
            "Apple Watch supported" line: zone coaching needs an HR stream, so
            "works best with" sets the right pre-download expectation (voice-
            neutral). Single source: BRAND.hrRecommendation (same line as the
            in-app UpgradeScreen). */}
        <p style={{
          marginTop: '8px',
          fontSize: '13px', color: 'var(--mute)',
        }}>
          {BRAND.hrRecommendation}
        </p>
      </section>

      {/* ── Facts band — MoorHub stat-strip structure, no vanity metrics ──
          v2 (design_handoff_v2). Honest facts only; price from PRICING. */}
      <section style={{ maxWidth: '780px', margin: '0 auto', padding: '0 24px 8px' }}>
        <div style={{
          display: 'flex', flexWrap: 'wrap', justifyContent: 'center',
          gap: '10px 22px',
          fontSize: '13px', fontWeight: 600, color: 'var(--ink-2)',
          letterSpacing: '0.01em',
        }}>
          {['5 zones', 'Mostly easy running', `${PRICING.monthly.display}/month`, '1 notification a day']
            .map((fact, i) => (
              <span key={fact} style={{ display: 'inline-flex', alignItems: 'center', gap: '22px' }}>
                {i > 0 && <span aria-hidden style={{ color: 'var(--line-strong)' }}>·</span>}
                {fact}
              </span>
            ))}
        </div>
      </section>

      {/* ── Device frame — the real Today anatomy, in a phone shell ───────
          v2 (design_handoff_v2) Change 2. Light section only (frame ground
          renders dark on --ground sections — known constraint). */}
      <section style={{ padding: '40px 24px 72px', display: 'flex', justifyContent: 'center' }}>
        <PhoneFrame />
      </section>

      {/* ── Thesis ───────────────────────────────────────────────────── */}
      <section style={{
        background: 'var(--bg-soft)',
        borderTop: '1px solid var(--line)',
        borderBottom: '1px solid var(--line)',
        padding: '72px 24px',
      }}>
        <div style={{ maxWidth: '900px', margin: '0 auto' }}>
          <Eyebrow>The problem</Eyebrow>
          <SectionTitle>Every run ends up in the same grey zone.</SectionTitle>

          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
            gap: '24px',
          }}>
            <ThesisCard
              label="Easy days"
              line="Run a bit too hard. Recover a bit too little."
            />
            <ThesisCard
              label="Hard days"
              line="Already tired. Effort gets diluted."
            />
            <ThesisCard
              label="The result"
              line="Months of training. No real adaptation."
            />
          </div>
        </div>
      </section>

      {/* ── What it does — three pillars + product mockups ───────────── */}
      <section style={{ padding: '80px 24px', maxWidth: '1100px', margin: '0 auto' }}>
        <Eyebrow>The product</Eyebrow>
        <SectionTitle>Three things, done with restraint.</SectionTitle>

        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: '20px', marginBottom: '64px',
        }}>
          <PillarCard
            title="A plan that fits you"
            body="Rule-engine generated from your race, your training history, your week and what you have actually been running — not a one-size template. Pace bands and HR zones derived from your inputs, not guessed."
          />
          <PillarCard
            title="In-the-moment coaching"
            body="Each session knows what it's for and tells you exactly that. Bit keen on an easy day? You'll see it in the post-run line, not buried in a chart."
          />
          <PillarCard
            title="Nothing you don't need"
            body="One job per screen. The plan shows up, you run, the plan adjusts. No noise, no dashboards, nothing competing for the run itself."
          />
        </div>

        {/* Mock product surfaces — pure CSS, Warm Slate tokens */}
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: '20px',
        }}>
          <MockSessionCard />
          <MockReflectCard />
          <MockCoachNoteCard />
        </div>
      </section>

      {/* ── Personalisation mechanic — previews the in-app profile/wizard ── */}
      <section style={{
        background: 'var(--bg-soft)',
        borderTop: '1px solid var(--line)',
        borderBottom: '1px solid var(--line)',
        padding: '80px 24px',
      }}>
        <div style={{ maxWidth: '900px', margin: '0 auto' }}>
          <Eyebrow>Personalised, not generic</Eyebrow>
          <SectionTitle sub="Your race, your history, your week, your legs. Pace bands and HR zones are derived from what you actually tell it, not lifted from a template.">
            Your plan starts from your answers.
          </SectionTitle>

          {/* Answers → generated session. Lifted from the real wizard + Today
              session card. Stacks on mobile; the arrow flips to vertical. */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: '20px', alignItems: 'stretch',
          }}>
            <AnswersCard />
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{
                fontSize: '10px', fontWeight: 700, color: 'var(--moss)',
                textTransform: 'uppercase', letterSpacing: '0.1em',
              }}>
                → Generates
              </div>
              <MockSessionCard />
            </div>
          </div>
        </div>
      </section>

      {/* ── What's not in the app — the restraint, made explicit ───────── */}
      <section style={{ padding: '80px 24px', maxWidth: '900px', margin: '0 auto' }}>
        <Eyebrow>The restraint</Eyebrow>
        <SectionTitle sub="What we left out, on purpose.">
          What&apos;s not in the app.
        </SectionTitle>

        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '0',
          border: '1px solid var(--line)',
          borderRadius: 'var(--radius-lg, 12px)',
          overflow: 'hidden',
          background: 'var(--card)',
        }}>
          {[
            'No streaks.',
            'No leaderboards.',
            'No "crushing it" notifications.',
            'No motivational quotes.',
            'No 30-day challenges.',
            'No social feed.',
            'No virtual coaches in your DMs.',
            'No paywalled VO₂ score.',
            'No badges.',
            'No fire emojis. Ever.',
          ].map((item) => (
            <div key={item} style={{
              padding: '18px 20px',
              borderTop: '1px solid var(--line)',
              borderLeft: '1px solid var(--line)',
              fontSize: '15px', lineHeight: 1.4, color: 'var(--ink-2)',
              fontWeight: 500,
            }}>
              {item}
            </div>
          ))}
        </div>
      </section>

      {/* ── Counter-positioning — who this isn't for ──────────────────── */}
      <section style={{
        background: 'var(--bg-soft)',
        borderTop: '1px solid var(--line)',
        borderBottom: '1px solid var(--line)',
        padding: '72px 24px',
      }}>
        <div style={{ maxWidth: '640px', margin: '0 auto', textAlign: 'left' }}>
          <Eyebrow>Honestly</Eyebrow>
          <h2 style={{
            fontFamily: 'var(--font-brand)',
            fontSize: 'clamp(26px, 4vw, 34px)',
            fontWeight: 600, lineHeight: 1.2,
            color: 'var(--ink)', margin: '0 0 28px',
          }}>
            Probably not for you if&hellip;
          </h2>

          <ul style={{ listStyle: 'none', margin: '0 0 24px', padding: 0, display: 'grid', gap: '14px' }}>
            {[
              'You train six days a week and have a sponsor.',
              'You genuinely believe sleep is for the weak.',
              'You want your phone to applaud you.',
            ].map((line) => (
              <li key={line} style={{
                display: 'flex', gap: '12px', alignItems: 'baseline',
                fontSize: '17px', lineHeight: 1.45, color: 'var(--ink)',
              }}>
                <span aria-hidden style={{ color: 'var(--moss)', fontWeight: 700, flexShrink: 0 }}>—</span>
                <span>{line}</span>
              </li>
            ))}
          </ul>

          <p style={{
            fontSize: '16px', lineHeight: 1.5, color: 'var(--ink-2)',
            margin: 0,
          }}>
            Plenty of excellent apps will. This one won&apos;t.
          </p>
        </div>
      </section>

      {/* ── FAQ — native <details> disclosure (v2, design_handoff_v2) ──────
          Zero-JS, server-rendered, keyboard-accessible; no new interaction
          model. Dry brand voice; prices from PRICING. Free SEO. */}
      <section style={{ padding: '80px 24px', maxWidth: '760px', margin: '0 auto' }}>
        <Eyebrow>Questions</Eyebrow>
        <SectionTitle>The obvious ones.</SectionTitle>
        <div style={{
          border: '1px solid var(--line)', borderRadius: 'var(--radius-lg)',
          background: 'var(--card)', boxShadow: 'var(--shadow-card)', overflow: 'hidden',
        }}>
          {[
            ['Do I need an Apple Watch?',
             `It works best with a heart-rate source — an Apple Watch, or a chest strap that writes to Apple Health. Without one you still get the plan, the paces and the structure. You just don't get heart-rate coaching.`],
            ['Is it free?',
             `Two weeks of everything, then a free tier that keeps the plan you built. ${PRICING.monthly.display}/month or ${PRICING.annual.display}/year if you want the coaching and the reshaping. We won't email you to come back.`],
            ['What distances?',
             `5K, 10K, half and full marathon, and ultra. Every plan is mostly easy running, with each session set to a zone and held there.`],
            ['Will it make me faster?',
             `If your problem is going medium-hard on everything, yes — by making your easy days genuinely easy, so your hard days can be genuinely hard. It won't turn four hours a week into an elite plan, and it won't pretend to.`],
            ['Any streaks, badges or leaderboards?',
             `No. On purpose. The app is built to get out of the way, not to keep you in it.`],
          ].map(([q, a], i) => (
            <details key={q} style={{ borderTop: i === 0 ? 'none' : '1px solid var(--line)' }}>
              <summary style={{
                listStyle: 'none', cursor: 'pointer',
                padding: '18px 20px',
                fontFamily: 'var(--font-brand)', fontSize: '16px', fontWeight: 600,
                color: 'var(--ink)',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px',
              }}>
                {q}
                <span aria-hidden style={{ color: 'var(--mute)', fontWeight: 400, flexShrink: 0 }}>+</span>
              </summary>
              <p style={{
                margin: 0, padding: '0 20px 18px',
                fontSize: '15px', lineHeight: 1.6, color: 'var(--ink-2)', maxWidth: '620px',
              }}>
                {a}
              </p>
            </details>
          ))}
        </div>
      </section>

      {/* ── The receipt — the ONE dark band (v2, design_handoff_v2 Change 1) ──
          A near-black punctuation mark, not a theme (ADR-008 stands). Carries
          the brand statement. Text-only, centred — no device frame here (the
          frame ground renders dark on --ground; known constraint). Sign-off is
          WORDMARK ONLY: pairing BRAND.tagline here would put two of the three
          locked brand lines on one surface, the DIV-021 rule this page just
          fixed. */}
      <section style={{
        background: 'var(--ground)', color: 'var(--on-ground)',
        padding: '112px 24px',
      }}>
        <div style={{ maxWidth: '760px', margin: '0 auto', textAlign: 'center' }}>
          <div style={{
            fontSize: '12px', fontWeight: 700, color: 'var(--moss-on-ground)',
            textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '12px',
          }}>
            The receipt
          </div>

          <p style={{
            fontFamily: 'var(--font-brand)',
            fontSize: 'clamp(32px, 5vw, 48px)',
            fontWeight: 500, lineHeight: 1.15, letterSpacing: '-0.015em',
            color: 'var(--on-ground)',
            fontStyle: 'italic',
            margin: '0 0 28px',
          }}>
            &ldquo;{BRAND.brandStatement}&rdquo;
          </p>

          <p style={{
            fontSize: '17px', lineHeight: 1.6, color: 'var(--on-ground-2)',
            maxWidth: '520px', margin: '0 auto 36px',
          }}>
            Every week, {BRAND.coachName} tells you one true thing about how you actually
            ran &mdash; then shows the numbers behind it. Same effort, lower heart rate.
            That&apos;s the whole game.
          </p>

          {/* CTA — light-on-dark. App Store when live; the free-plan hub until
              then (BRAND.appStore.url is empty pre-approval, like AppStoreBadge). */}
          <Link
            href={BRAND.appStore.url || '/plans'}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '8px',
              fontSize: '15px', fontWeight: 600,
              color: 'var(--ground)', background: 'var(--on-ground)',
              padding: '13px 22px', borderRadius: 'var(--radius-md)',
              textDecoration: 'none',
            }}
          >
            {BRAND.appStore.url ? `Get ${BRAND.name}` : 'See the free plans'}
            <span aria-hidden style={{ opacity: 0.55 }}>&rarr;</span>
          </Link>

          {/* Sign-off — wordmark only (no tagline; see note above) */}
          <div style={{
            marginTop: '48px', display: 'flex', flexDirection: 'column',
            alignItems: 'center', gap: '10px',
          }}>
            <Wordmark size="sm" variant="light" />
          </div>
        </div>
      </section>

      {/* ── Footer ───────────────────────────────────────────────────── */}
      {/* ── Free-plans teaser — routes the not-ready-yet visitor to the SEO hub ── */}
      <section style={{ maxWidth: '780px', margin: '0 auto', padding: '8px 24px 48px' }}>
        <div style={{
          background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 'var(--radius-lg)',
          boxShadow: 'var(--shadow-card)',   // v2 (design_handoff_v2)
          padding: '26px 22px',
        }}>
          <h2 style={{ fontSize: '20px', fontWeight: 800, color: 'var(--ink)', margin: '0 0 8px', letterSpacing: '-0.01em' }}>
            Not ready for the app? Start with a free plan.
          </h2>
          <p style={{ fontSize: '15px', lineHeight: 1.55, color: 'var(--ink-2)', margin: '0 0 16px', maxWidth: '520px' }}>
            5K to marathon, built the same way &mdash; mostly easy running, every run zoned. Read
            any of them free. No signup, no wall.
          </p>
          <Link href="/plans" style={{ fontSize: '15px', fontWeight: 600, color: 'var(--moss)', textDecoration: 'none' }}>
            See the free plans &rarr;
          </Link>
        </div>
      </section>

      {/* Founder note kept: it is real brand content and the only place the
          site says who built it. Moved ABOVE the shared footer rather than
          deleted, so the footer itself can be identical on every page. */}
      <section style={{ padding: '40px 24px 0', maxWidth: '1100px', margin: '0 auto' }}>
        <p style={{ fontSize: '13px', lineHeight: 1.5, color: 'var(--ink-2)', margin: 0 }}>
          Built by Russell. Runs medium-hard on everything. That&apos;s how I know.
        </p>
      </section>
      <SiteFooter />
    </main>
  )
}

// ─── Local presentational components ────────────────────────────────────────

/** Section eyebrow — moss, uppercase, the canonical 0.08em label. */
function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontSize: '12px', fontWeight: 700, color: 'var(--moss)',
      textTransform: 'uppercase', letterSpacing: '0.08em',
      marginBottom: '12px',
    }}>
      {children}
    </div>
  )
}

/** Section title (+ optional sub line). Shared rhythm across all sections. */
function SectionTitle({ children, sub }: { children: React.ReactNode; sub?: string }) {
  return (
    <div style={{ marginBottom: '48px' }}>
      <h2 style={{
        fontFamily: 'var(--font-brand)',
        fontSize: 'clamp(28px, 4vw, 36px)',
        fontWeight: 600, lineHeight: 1.2,
        color: 'var(--ink)', margin: 0,
        maxWidth: '720px',
      }}>
        {children}
      </h2>
      {sub && (
        <p style={{
          fontSize: '16px', lineHeight: 1.55, color: 'var(--ink-2)',
          maxWidth: '600px', margin: '14px 0 0',
        }}>
          {sub}
        </p>
      )}
    </div>
  )
}

function ThesisCard({ label, line }: { label: string; line: string }) {
  return (
    <div style={{
      background: 'var(--card)',
      border: '1px solid var(--line)',
      borderRadius: 'var(--radius-lg, 12px)',
      boxShadow: 'var(--shadow-card)',   // v2 (design_handoff_v2)
      padding: '24px',
    }}>
      <div style={{
        fontSize: '11px', fontWeight: 700, color: 'var(--mute)',
        textTransform: 'uppercase', letterSpacing: '0.08em',
        marginBottom: '12px',
      }}>
        {label}
      </div>
      <div style={{
        fontSize: '17px', lineHeight: 1.4, color: 'var(--ink)',
        fontWeight: 500,
      }}>
        {line}
      </div>
    </div>
  )
}

function PillarCard({ title, body }: { title: string; body: string }) {
  return (
    <div style={{
      background: 'var(--card)',
      border: '1px solid var(--line)',
      borderRadius: 'var(--radius-lg, 12px)',
      boxShadow: 'var(--shadow-card)',   // v2 (design_handoff_v2)
      padding: '28px',
    }}>
      <h3 style={{
        fontFamily: 'var(--font-brand)',
        fontSize: '20px', fontWeight: 600, lineHeight: 1.3,
        color: 'var(--ink)', margin: '0 0 12px',
      }}>
        {title}
      </h3>
      <p style={{
        fontSize: '14px', lineHeight: 1.6, color: 'var(--ink-2)',
        margin: 0,
      }}>
        {body}
      </p>
    </div>
  )
}

/** Wizard answers receipt — lifted from GeneratePlanScreen's core inputs.
 *  Four answered rows: the inputs the rule-engine actually derives from. */
function AnswersCard() {
  // Mirrors the REAL wizard, which asks ~15 questions. The card previously
  // showed four and the section was headed "four answers" — written when the
  // wizard was that short, and never updated through WIZARD-REDESIGN, §79
  // (fitness level), ADR-021 (recent quality training), CB-TERRAIN-01 and the
  // hard-session step.
  //
  // Deliberately shows the INPUTS rather than the count (SLT, this review):
  // Sutherland wanted the depth surfaced as proof of consideration, Wood warned
  // that "15 questions" as a headline reads as friction and suppresses starts.
  // Listing them lets the depth speak without turning it into a number.
  const answers: Array<[string, string]> = [
    ['How far?', 'Half marathon'],
    ['Goal', 'Sub-2:00'],
    ['Weekly volume', '20–40 km'],
    ['Longest run', '15–20 km'],
    ['Training history', '2–5 years'],
    ['Recent hard work', 'Here and there'],
    ['Days you run', 'Tue Thu Sat Sun'],
    ['Age', '38'],
  ]
  return (
    <div style={{
      background: 'var(--card)',
      border: '1px solid var(--line)',
      borderRadius: 'var(--radius-lg, 12px)',
      boxShadow: 'var(--shadow-card)',   // v2 (design_handoff_v2)
      padding: '20px',
      display: 'flex', flexDirection: 'column',
    }}>
      <div style={{
        fontSize: '10px', fontWeight: 700, color: 'var(--mute)',
        textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '14px',
      }}>
        Your answers
      </div>
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {answers.map(([q, a], i) => (
          <div key={q} style={{
            display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
            gap: '16px',
            padding: '12px 0',
            borderTop: i === 0 ? 'none' : '1px solid var(--line)',
          }}>
            <span style={{ fontSize: '13px', color: 'var(--mute)' }}>{q}</span>
            <span style={{
              fontFamily: 'var(--font-brand)',
              fontSize: '15px', fontWeight: 600, color: 'var(--ink)',
              textAlign: 'right',
            }}>
              {a}
            </span>
          </div>
        ))}
      </div>
      <p style={{ fontSize: '12px', lineHeight: 1.45, color: 'var(--mute)', margin: '14px 0 0' }}>
        Plus injury history, terrain, your weekday time cap and a recent race result if you have one.
      </p>
    </div>
  )
}

/** Mock session card — mirrors the Today screen session card pattern.
 *  Pure CSS; no real plan data. Showcases left-accent type bar, structured
 *  metric hierarchy (zone → HR → distance), and a coach note bottom. */
function MockSessionCard() {
  return (
    <div style={{
      background: 'var(--card)',
      border: '1px solid var(--line)',
      borderRadius: 'var(--radius-lg, 12px)',
      boxShadow: 'var(--shadow-card)',   // v2 (design_handoff_v2)
      padding: '20px 20px 20px 24px',
      borderLeft: '3px solid var(--s-easy)',
    }}>
      <div style={{
        fontSize: '10px', fontWeight: 700, color: 'var(--mute)',
        textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '8px',
      }}>
        Today · Easy run
      </div>
      <div style={{
        fontFamily: 'var(--font-brand)',
        fontSize: '20px', fontWeight: 600, color: 'var(--ink)',
        marginBottom: '14px',
      }}>
        Easy run — Zone 2
      </div>
      <div style={{
        display: 'flex', gap: '18px', flexWrap: 'wrap',
        fontSize: '13px', color: 'var(--ink-2)',
        marginBottom: '14px',
      }}>
        <div><strong style={{ color: 'var(--ink)' }}>8 km</strong> · 55 min</div>
        <div><strong style={{ color: 'var(--ink)' }}>&lt; 145 bpm</strong></div>
        <div>6:30–7:00 /km</div>
      </div>
      <div style={{
        fontSize: '13px', lineHeight: 1.5, color: 'var(--mute)',
        borderTop: '1px solid var(--line)', paddingTop: '12px',
        fontStyle: 'italic',
      }}>
        Keep HR below your zone 2 ceiling — walk if needed.
      </div>
    </div>
  )
}

/** Mock reflect view — RPE + voice response. Mirrors getReflectResponse output. */
function MockReflectCard() {
  return (
    <div style={{
      background: 'var(--card)',
      border: '1px solid var(--line)',
      borderRadius: 'var(--radius-lg, 12px)',
      boxShadow: 'var(--shadow-card)',   // v2 (design_handoff_v2)
      padding: '20px',
    }}>
      <div style={{
        fontSize: '10px', fontWeight: 700, color: 'var(--mute)',
        textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '12px',
      }}>
        After your run
      </div>
      <div style={{ marginBottom: '14px' }}>
        <div style={{ fontSize: '12px', color: 'var(--ink-2)', marginBottom: '8px' }}>How hard?</div>
        <div style={{ display: 'flex', gap: '6px' }}>
          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => (
            <div key={n} style={{
              flex: 1, height: '10px', borderRadius: '5px',
              background: n <= 4 ? 'var(--moss)' : 'var(--line)',
            }} />
          ))}
        </div>
      </div>
      <div style={{
        fontFamily: 'var(--font-brand)',
        fontSize: '15px', lineHeight: 1.4,
        color: 'var(--ink)',
        background: 'var(--bg-soft)',
        padding: '14px',
        borderRadius: 'var(--radius-md, 8px)',
        borderLeft: '3px solid var(--moss)',
      }}>
        Kept it under control. That&apos;s the session.
      </div>
    </div>
  )
}

/** Mock coach note — sparkle indicator + weekly check-in. */
function MockCoachNoteCard() {
  return (
    <div style={{
      background: 'var(--card)',
      border: '1px solid var(--line)',
      borderRadius: 'var(--radius-lg, 12px)',
      boxShadow: 'var(--shadow-card)',   // v2 (design_handoff_v2)
      padding: '20px',
      borderLeft: '3px solid var(--moss)',
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: '6px',
        fontSize: '10px', fontWeight: 700, color: 'var(--moss)',
        textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '12px',
      }}>
        <span>✦</span>
        <span>{BRAND.coachName} · this week</span>
      </div>
      <div style={{
        fontSize: '14px', lineHeight: 1.55, color: 'var(--ink)',
        marginBottom: '12px',
      }}>
        HR on Tuesday&apos;s easy run drifted 8 bpm above ceiling. Wednesday looked the same.
        Two easy days in a row above Z2 is the pattern we&apos;re trying to break.
      </div>
      <div style={{
        fontSize: '13px', lineHeight: 1.5, color: 'var(--ink-2)',
        fontStyle: 'italic',
      }}>
        Hold Zone 2 on Thursday. Even if it feels too slow.
      </div>
    </div>
  )
}
