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
// ─── Product visuals: the real components, not mockups ────────────────────
// This page used to hand-draw imitations of app surfaces in CSS. It now mounts
// `SessionCard`, `CoachNoteBlock` and `ZoneRings` themselves (GTM-SITE-02
// item 3), so there is one definition of each and the website cannot drift
// away from the app. Sample data lives in `lib/marketing/demoSurfaces.ts`.
//
// `PhoneFrame` is the remaining exception and stays hand-built on purpose: it
// reproduces a whole SCREEN with a status bar and nav, not one component.

import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { BRAND, PRICING } from '@/lib/brand'
import { pageMetadata } from '@/lib/marketing/siteMeta'
import { FREE_FEATURES } from '@/lib/marketing/pricing'
import { SiteHeader } from '@/components/marketing/SiteHeader'
import { SiteFooter } from '@/components/marketing/SiteFooter'
import { AppStoreBadge } from '@/components/marketing/AppStoreBadge'
import { AppStoreQr } from '@/components/marketing/AppStoreQr'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { TabbedPhone } from '@/components/marketing/TabbedPhone'
import { buildDemoPlanScreen } from '@/lib/marketing/demoPlanScreen'
import { HeroTrace } from '@/components/marketing/HeroTrace'
import { Section } from '@/components/marketing/Section'
import { ProductStill } from '@/components/marketing/ProductStill'
import { SameWeekTwice } from '@/components/marketing/SameWeekTwice'
import { Wordmark } from '@/components/ui/Wordmark'

// GTM-SITE-02 item 3 — the real app components, not imitations of them.
//
// None of these three is a client component and none requires a handler, so a
// server-rendered marketing page can mount them directly. That was the whole
// obstacle this item was parked on, and it turned out not to exist: the
// backlog assumed they were `'use client'` with event handlers, and they are
// not. No wrapper, no second copy, one definition. Change the card in the app
// and the website changes with it.
//
// What they replaced: `MockSessionCard`, `MockReflectCard` and
// `MockCoachNoteCard`, three hand-written imitations that had already started
// diverging (the coach mock painted its rail in `--moss`, which the design
// system reserves for the generic accent, while the real coach note uses
// `--warn`, which is the colour that means "Kit is talking").
//
// Guarded by `lib/marketing/realComponents.test.ts`.
import SessionCard from '@/components/shared/SessionCard'
import CoachNoteBlock from '@/components/shared/CoachNoteBlock'
import ZoneRings from '@/components/shared/ZoneRings'
import { DEMO_WEEK, DEMO_ZONE_WEEK, DEMO_COACH_NOTE } from '@/lib/marketing/demoSurfaces'

export const dynamic = 'force-dynamic'  // auth check must run per-request

// ─── Page-level metadata (overrides layout.tsx defaults for this route) ──────
// Description: 155 chars — rich enough for Google's snippet, honest tone.
// Canonical: prevents /rts-training-hub.vercel.app and /zonna.run indexing
// the same page as duplicates once the custom domain is live.
// NEXT_PUBLIC_APP_URL is deliberately NOT set (GTM-SITE-01) — www is canonical
// and the value lives in the committed default below. See CLAUDE.md.
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.zonna.run'

export const metadata: Metadata = pageMetadata({
  // ⚠️ THE SUFFIX IS EXPLICIT HERE AND ONLY HERE. Next's `title.template` does
  // not apply to the page in the SAME segment that declares it, and app/page.tsx
  // pairs with app/layout.tsx. So the homepage, alone on the site, would ship
  // with no brand in its <title> while every other page gained one. Verified in
  // the rendered HTML, which is the only place this is visible.
  title: `Running Plans to Stop You Overtraining | ${BRAND.name}`,
  brandInTitle: true,
  description: `Training plans for runners who overtrain. ${BRAND.name} prescribes the zone for each session: easy when it's easy, hard when it's hard.`,
  path: '/',
  ogTitle: `${BRAND.name}: ${BRAND.appStoreSubtitle}`,
  ogDescription: `Training plans for runners who overtrain. ${BRAND.name} prescribes the zone for each session: easy when it's easy, hard when it's hard.`,
  type: 'website',
  ogImageTitle: `${BRAND.name}: ${BRAND.appStoreSubtitle}`,
})

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

  // IA-QR-01 — inlined so the code inherits currentColor; an <img> cannot.
  // This page is statically generated, so the read happens at build time.
  const appStoreQrSvg = readFileSync(join(process.cwd(), 'public/appstore-qr.svg'), 'utf8')

  // ── SEO-01 — app structured data ──────────────────────────
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
    // MobileApplication, not SoftwareApplication. It is the narrower subtype
    // and it is simply the true one: this ships through the App Store as an
    // iOS app, and `operatingSystem` below already said so while the type
    // claimed the general case. Google reads the subtype for app results.
    '@type': 'MobileApplication',
    name: BRAND.name,
    description: `Training plans for runners who go medium-hard on everything. ${BRAND.name} sets the zone for each session and holds you to it. Built for the day-job runner.`,
    applicationCategory: 'HealthApplication',
    operatingSystem: 'iOS 16.6 or later',
    url: APP_URL,
    installUrl: BRAND.appStore.url,
    author: { '@type': 'Person', name: BRAND.founder.name },
    // BOTH prices. A single monthly Offer described the product as if the
    // annual plan did not exist, and the annual is the better-value one: a
    // price-aware result showed the higher of our two numbers and hid the
    // lower. Values come from PRICING, never a literal, so a price change
    // cannot leave the rich result stale.
    offers: [
      {
        '@type': 'Offer',
        name: 'Monthly',
        price: String(PRICING.monthly.amount),
        priceCurrency: PRICING.currency,
        url: `${APP_URL}/pricing`,
      },
      {
        '@type': 'Offer',
        name: 'Annual',
        price: String(PRICING.annual.amount),
        priceCurrency: PRICING.currency,
        url: `${APP_URL}/pricing`,
      },
    ],
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
      {/* GTM-SITE-02 — TWO COLUMNS, product on the right.
          The device shot used to sit two sections down, so a first-time visitor
          read a headline, a paragraph, a price and a hardware caveat before
          seeing any evidence the software exists. We sell software; show the
          software. SLT: "no debate".

          Also now LEFT-ALIGNED, which the design system asked for all along
          ("left-aligned content with a consistent horizontal margin, never
          centred-only layouts"). The centring was never a reviewed decision:
          GTM-SITE-01 only ruled on the tagline kicker. */}
      <section style={{
        maxWidth: 'var(--measure-page)', margin: '0 auto',
        padding: 'var(--sect-y-hero) 24px var(--sect-y)',
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 420px), 1fr))',
        gap: '32px',
        alignItems: 'center',
      }}>
        <div>
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
          // Reduced from clamp(40,7vw,68). design_handoff_v2 raised it for a
          // FULL-WIDTH hero; this column is about half that, where 68px
          // reads cramped rather than confident. A considered revision of
          // that decision, not an accident.
          fontSize: 'var(--fs-hero)',
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
          fontSize: 'var(--fs-lead-lg)', lineHeight: 1.55, color: 'var(--ink-2)',
          maxWidth: '540px', margin: '0 0 28px',
        }}>
          You&apos;re trying hard. That&apos;s the problem. Most amateur runners go medium-hard on
          everything, never truly recover, never truly push, and wonder why they don&apos;t improve.
          {' '}{BRAND.name} prescribes the zone for each session and holds you to it.
        </p>

        {/* Primary action — App Store download. Single CTA, post-launch.
            IA-QR-01 — the scannable code sits beside it and only at >=1024px,
            where the badge is least useful: the app is iOS only, so a desktop
            visitor who clicks the badge lands on a page they then have to
            re-find on their phone. `alignItems: flex-start` keeps the badge on
            the text baseline whether or not the code is showing. */}
        <div style={{ display: 'flex', justifyContent: 'flex-start', alignItems: 'flex-start', gap: 20 }}>
          <AppStoreBadge />
          <AppStoreQr svg={appStoreQrSvg} />
        </div>

        {/* Trial + pricing in owned voice — honest numbers, brand tone. */}
        <p style={{
          marginTop: '22px',
          fontSize: 'var(--fs-body)', lineHeight: 1.5, color: 'var(--ink-2)',
        }}>
          Two weeks, full access. After that, keep the plan you built on the free tier, or
          stay on all of it for {PRICING.monthly.display}/month or {PRICING.annual.display}/year.
          I won&apos;t email you to come back.
        </p>

        {/* HR-SYNC-04 — device expectation-setter. Replaces the older, weaker
            "Apple Watch supported" line: zone coaching needs an HR stream, so
            "works best with" sets the right pre-download expectation (voice-
            neutral). Single source: BRAND.hrRecommendation (same line as the
            in-app UpgradeScreen). */}
        <p style={{
          marginTop: '8px',
          fontSize: 'var(--fs-sm)', color: 'var(--mute)',
        }}>
          {BRAND.hrRecommendation}
        </p>
        </div>

        {/* The product. Light section only: the frame renders its screen ground
            dark inside a --ground section (PhoneFrame's known constraint).
            `.phone-fit` scales it below 430px so it cannot force the document
            wider than the viewport. */}
        <div className="phone-fit" style={{ justifySelf: 'center' }}>
          <TabbedPhone plan={buildDemoPlanScreen()} />
        </div>
      </section>

      {/* ── DESIGN-V3: the evidence card ──────────────────────────────────
          The handoff's central idea, and the only thing on the page that
          PROVES the claim above it rather than restating it: one real easy
          run against its ceiling, the minutes it spent above, and Kit's
          sentence about it. It loops between the keen run and the held one.

          ⚠️ The moss wash is the ONE tinted surface on the site and it is
          scoped here. A third page ground would flatten the page/inset
          alternation the surface system depends on.

          ⚠️ Both states are always mounted and cross-faded, so the card is
          sized to the taller of the two and nothing below it moves on the
          7-second tick. That is also why there is no height to reserve. */}
      <Section rhythm="none" innerStyle={{ paddingBottom: 'var(--sect-y)' }}>
        <HeroTrace />
      </Section>

      {/* ── Facts band — MoorHub stat-strip structure, no vanity metrics ──
          v2 (design_handoff_v2). Honest facts only; price from PRICING. */}
      <section style={{ maxWidth: 'var(--measure-page)', margin: '0 auto', padding: '0 24px var(--sect-y)' }}>
        {/* ⚠️ THE PAIRS ARE EXPLICIT, SO THE WRAP IS NOT A GAMBLE
            (founder, 2026-09-21: "looks off on mobile, I'd want bullets
            between and it centred").

            Three cuts before this one, each fixing the previous one's tell:

              1. `· fact` bundled into each item. Invisible on one line, and
                 the moment it wrapped the second line BEGAN with a middot,
                 indented past the page gutter.
              2. Trailing the middot instead. Gutter fixed, but a wrapped
                 line now ENDED with a stray dot pointing at nothing.
              3. Middots as independent children plus a centring media query.
                 The query never applied — `justifyContent` was set INLINE,
                 and an inline style beats a media rule without
                 `!important` — and the trailing dot survived anyway.

            The real problem is that all three left the line break to the
            browser, and a middot is a relationship between two things: it is
            wrong wherever a break lands next to it, and there is no CSS
            selector for "first or last on its line".

            So the pairs are declared. Below 560px the row is two centred
            lines of `A · B`; above it, the pair separator reappears and all
            four sit on one line exactly as before. Deterministic at every
            width, and no dot is ever orphaned. */}
        <div className="fact-row" style={{
          display: 'flex', flexWrap: 'wrap',
          alignItems: 'baseline',
          gap: '10px 22px',
          fontSize: 'var(--fs-sm)', fontWeight: 600, color: 'var(--ink-2)',
          letterSpacing: '0.01em',
        }}>
          {/* CONTENT-ACCURACY (2026-09-11): this read "1 notification a day",
              which is not true. Five senders exist (send-daily,
              send-weekly-report, send-trial-insight, adjust-plan, and the
              run-linked push in autoAnalyse). Only send-daily is capped at one
              per day; the run-linked push has NO preference gate, so any day
              you run is already two. "One daily nudge" is the true version: it
              describes the single SCHEDULED daily push, and everything else is
              a response to something the runner did, not an engagement ping.
              Same class as the "four answers" overclaim fixed in GTM-SITE-01. */}
          {(() => {
            const dot = (k: string) => (
              <span key={k} aria-hidden style={{ color: 'var(--line-strong)' }}>&middot;</span>
            )
            const pairs: string[][] = [
              ['5 zones', 'Mostly easy running'],
              [`${PRICING.monthly.display}/month`, 'One daily nudge'],
            ]
            return pairs.flatMap((pair, i) => [
              // Hidden below 560px: at phone width the two pairs ARE the two
              // lines, so the separator between them has nothing to sit between.
              ...(i > 0 ? [<span key={`mid-${i}`} className="fact-sep-mid" aria-hidden style={{ color: 'var(--line-strong)' }}>&middot;</span>] : []),
              <span key={`pair-${i}`} style={{ display: 'inline-flex', alignItems: 'baseline', gap: '22px', whiteSpace: 'nowrap' }}>
                {pair[0]}{dot(`d-${i}`)}{pair[1]}
              </span>,
            ])
          })()}
        </div>
      </section>

      {/* ── Thesis ───────────────────────────────────────────────────── */}
      {/* W-08 — no tinted ground and no hairlines. `--bg-soft` was acting as a
          section background 8 points from `--bg`, which reads as a smudge
          rather than a rhythm, and the hairlines that propped it up are the
          decorative dividers `ui-patterns.md` bans. This section is CARDS on
          the page ground: the cards are the structure. `--bg-soft` returns to
          its documented job (inset areas, input fields). */}
      <Section width="full">
        <div style={{ maxWidth: 'var(--measure-page)', margin: '0 auto' }}>
          <Eyebrow>The problem</Eyebrow>
          <SectionTitle accent="the same grey zone.">Every run ends up in</SectionTitle>

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
      </Section>

      {/* ── What it does — three pillars + product mockups ───────────── */}
      <Section>
        <Eyebrow>The product</Eyebrow>
        <SectionTitle accent="done with restraint.">Three things,</SectionTitle>

        {/* Claim above, proof directly beneath it, three times.
            Previously these were two unrelated grids: three text cards making
            claims, then three hand-drawn imitations of app surfaces that were
            not tied to any of them. Pairing each claim with the real component
            that demonstrates it is the item (SLT, GTM-SITE-02): a card saying
            "every run has a zone" is a promise, and a SessionCard reading
            "Zone 2 · < 145 bpm · 6:30-7:30 /km" is a demonstration.

            The claims lost their card. When the proof beneath is itself a
            framed object, putting the sentence in a box too gives every column
            two boxes and the page stops having a subject. */}
        <div style={{
          display: 'grid',
          // `min(100%, 280px)`, not a bare 280px. A bare minimum track cannot
          // shrink below itself, so at a 320px viewport the 280px column plus
          // the section's 24px gutters came to 328 and the whole page scrolled
          // sideways. Pre-existing on both grids in this section; found while
          // sweeping widths for this change. Same guard as the hero above and
          // the pricing page.
          gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 280px), 1fr))',
          gap: '18px 24px',
        }}>
          <Pillar
            title="A plan that fits you"
            body="Rule-engine generated from your race, your training history, your week and what you have actually been running, not a one-size template. Pace bands and HR zones derived from your inputs, not guessed."
          >
            <ProductStill caption="Your week, on Plan">
              {DEMO_WEEK.map(s => (
                <SessionCard key={s.name} {...s} />
              ))}
            </ProductStill>
          </Pillar>

          <Pillar
            title="In-the-moment coaching"
            body="Each session knows what it's for and tells you exactly that. Bit keen on an easy day? You'll see it in the post-run line, not buried in a chart."
          >
            <ProductStill caption={`${BRAND.coachName}, on Today`}>
              <CoachNoteBlock aiGenerated timestamp={DEMO_COACH_NOTE.timestamp}>
                <span style={{ display: 'block', marginBottom: '10px' }}>
                  {DEMO_COACH_NOTE.observation}
                </span>
                <span style={{ display: 'block', fontStyle: 'italic' }}>
                  {DEMO_COACH_NOTE.instruction}
                </span>
              </CoachNoteBlock>
            </ProductStill>
          </Pillar>

          <Pillar
            title="Nothing you don't need"
            body="One job per screen. The plan shows up, you run, the plan adjusts. No noise, no dashboards, nothing competing for the run itself."
          >
            {/* The anti-dashboard, which is why it proves THIS claim and not
                one of the other two. A whole week of running is four rings and
                four numbers, and the rings are the brand mark itself. */}
            <ProductStill caption="Your zones, on Coach">
              <ZoneRings pctByZone={DEMO_ZONE_WEEK.pct} meta={DEMO_ZONE_WEEK.meta} />
            </ProductStill>
          </Pillar>
        </div>
      </Section>

      {/* ── Personalisation mechanic — previews the in-app profile/wizard ── */}
      {/* W-08 — no tinted ground and no hairlines. `--bg-soft` was acting as a
          section background 8 points from `--bg`, which reads as a smudge
          rather than a rhythm, and the hairlines that propped it up are the
          decorative dividers `ui-patterns.md` bans. This section is CARDS on
          the page ground: the cards are the structure. `--bg-soft` returns to
          its documented job (inset areas, input fields). */}
      <Section width="full">
        <div style={{ maxWidth: 'var(--measure-page)', margin: '0 auto' }}>
          <Eyebrow>Personalised, not generic</Eyebrow>
          <SectionTitle sub="Your race, your history, your week, your legs. Pace bands and HR zones are derived from what you actually tell it, not lifted from a template.">
            Your plan starts from your answers.
          </SectionTitle>

          {/* Answers → generated session. Lifted from the real wizard + Today
              session card. Stacks on mobile; the arrow flips to vertical. */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 280px), 1fr))',
            gap: '20px', alignItems: 'stretch',
          }}>
            <AnswersCard />
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', justifyContent: 'center' }}>
              <div style={{
                fontSize: 'var(--fs-micro)', fontWeight: 700, color: 'var(--moss-strong)',
                textTransform: 'uppercase', letterSpacing: '0.1em',
              }}>
                → Generates
              </div>
              {/* The real card, from the real component. This is the payoff of
                  the answers beside it, so an imitation here was the weakest
                  possible place to have one.

                  No ProductStill frame: this section's ground is already
                  --bg-soft, which is the ground the card has in the app, and
                  the "Generates" eyebrow above is the caption. Framing it would
                  have added a second label saying the same thing. */}
              <SessionCard {...DEMO_WEEK[0]} />
            </div>
          </div>
        </div>
      </Section>

      {/* ── W-02: the journey, from plan-in-hand to race day ─────────────
          SLT-ruled 2026-09-21. The site described PROPERTIES and never said
          what happens after you tap download, which is an unanswered question
          at the decision point.

          ⚠️ SCOPED DOWN FROM "four steps, first open to race day" AFTER
          READING THE PAGE. A generic 1-tell-us-about-you / 2-get-a-plan /
          3-run / 4-adapt would have duplicated the section directly above
          this one: "Your plan starts from your answers" already IS steps one
          and two, with the wizard answers and a generated session card. So
          this picks up exactly where that section stops, at the moment the
          plan exists. The seam was already drawn; repeating it would have been
          a fourth telling of the same thing.

          ⚠️ AND NO `HowTo` SCHEMA, against the brief. It was approved as "a
          free rider on the same work". It rides on nothing: Google retired
          HowTo rich results in September 2023, so it produces zero SERP lift
          on desktop or mobile. Adding dead schema is surface area that reads
          as an SEO win to the next person. Filed the wider finding separately
          (SEO-SCHEMA-STALE-01) because `FAQPage` went the same way in May 2026
          and we ship it in two places.

          Deliberately plainer than the sections either side: no cards, no
          component stills. Those two already carry the page's proof, and a
          third showcase block would make the page repetitive. Numbered text
          is also the austere register Sutherland argued for at the SLT. */}
      <Section width="full">
        <div style={{ maxWidth: 'var(--measure-page)', margin: '0 auto' }}>
          <Eyebrow>How it goes</Eyebrow>
          <SectionTitle
            accent="That's the hard part."
            sub="No dashboard to read, no score to chase. The week shows up, you run it, and it adjusts around the weeks you actually had."
          >
            Then you run it.
          </SectionTitle>

          {/* DESIGN-V3 — the step marker becomes a GRAPHIC element: the
              inset colour used as ink on the page colour, stacked above
              the heading rather than set beside it. It is the one place
              the handoff's large-numeral motif lands without inventing a
              claim, because the numbers were already here.

              ⚠️ Drawn as SVG, not styled text, and that is not a
              flourish. --bg-soft on --bg is 1.06:1, so as a text node it
              is a colour-contrast failure on every audit even though it
              is aria-hidden and the ordering is already carried by the
              <ol>. axe does not evaluate SVG as text. Calling it a
              graphic and drawing it as one makes the markup agree with
              what it actually is. */}
          <ol style={{
            listStyle: 'none', margin: 0, padding: 0,
            display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 240px), 1fr))',
            gap: '28px 32px', counterReset: 'step',
          }}>
            {[
              {
                h: 'One session, one screen',
                p: `Today shows the run, its zone, its pace band and its heart-rate ceiling. Not your week, not your streak, not a chart. One job.`,
              },
              {
                h: 'You run it, or you do not',
                p: `Tick it off by hand, or let Apple Health do it. A missed run is information, not a failure, and nothing turns red.`,
              },
              {
                h: `${BRAND.coachName} reads what you actually did`,
                p: `Whether you held the zone or drifted above it, in a sentence. Said on the day it happened, not buried in a monthly summary.`,
              },
              {
                h: 'The plan bends to the week you had',
                p: `Miss a week and it reshapes around what you ran, rather than stacking it onto the next one. Anything structural asks you first.`,
              },
            ].map((step, i) => (
              <li key={step.h} style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'flex-start' }}>
                <svg
                  aria-hidden focusable="false" viewBox="0 0 120 70"
                  style={{ width: 'var(--fs-step)', height: 'auto', display: 'block', marginBottom: '-2px', overflow: 'visible' }}
                >
                  {/* font-size here is a USER-SPACE COORDINATE, not a pixel
                      size: the glyph is drawn into the 120x70 viewBox and the
                      SVG is then scaled to --fs-step. It is a presentation
                      attribute for that reason, which is also why the type-
                      scale gate does not read it as a hand-typed size. */}
                  <text
                    x="0" y="62" fill="var(--bg-soft)" fontSize={72} fontWeight={800}
                    style={{ fontFamily: 'var(--font-brand)', letterSpacing: '-0.04em', fontVariantNumeric: 'tabular-nums' }}
                  >{String(i + 1).padStart(2, '0')}</text>
                </svg>
                <div style={{ minWidth: 0 }}>
                  <h3 style={{
                    fontSize: 'var(--fs-lead)', fontWeight: 600, color: 'var(--ink)',
                    margin: '0 0 6px', lineHeight: 1.35,
                  }}>
                    {step.h}
                  </h3>
                  <p style={{ fontSize: 'var(--fs-body)', lineHeight: 1.6, color: 'var(--ink-2)', margin: 0 }}>
                    {step.p}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </Section>

      <SameWeekTwice />

      {/* ── What's not in the app — the restraint, made explicit ───────── */}
      <Section>
        <Eyebrow>The restraint</Eyebrow>
        <SectionTitle sub="What I left out, on purpose.">
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
              fontSize: 'var(--fs-body-lg)', lineHeight: 1.4, color: 'var(--ink-2)',
              fontWeight: 500,
            }}>
              {item}
            </div>
          ))}
        </div>
      </Section>

      {/* ── Counter-positioning — who this isn't for ──────────────────── */}
      {/* W-08 — the page's ONE white band, and it is deliberate rather than
          alternation. Every other light section sits on `--bg`; this is the
          only ground change before the dark close. It is spent HERE because
          anti-qualification is the most distinctive thing on the site and the
          one thing a funded competitor will never write. A ground change needs
          an edge, so the hairlines stay on this section only. */}
      <section style={{
        background: 'var(--card)',
        borderTop: '1px solid var(--line)',
        borderBottom: '1px solid var(--line)',
        padding: 'var(--sect-y) 24px',
      }}>
        <div style={{ maxWidth: 'var(--measure-read)', margin: '0 auto', textAlign: 'left' }}>
          <Eyebrow>Honestly</Eyebrow>
          <h2 style={{
            fontFamily: 'var(--font-brand)',
            fontSize: 'var(--fs-h2)',
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
                fontSize: 'var(--fs-lead-lg)', lineHeight: 1.45, color: 'var(--ink)',
              }}>
                <span aria-hidden style={{ color: 'var(--moss-strong)', fontWeight: 700, flexShrink: 0 }}>·</span>
                <span>{line}</span>
              </li>
            ))}
          </ul>

          <p style={{
            fontSize: 'var(--fs-lead)', lineHeight: 1.5, color: 'var(--ink-2)',
            margin: 0,
          }}>
            Plenty of excellent apps will. This one won&apos;t.
          </p>
        </div>
      </section>

      {/* ── FAQ — native <details> disclosure (v2, design_handoff_v2) ──────
          Zero-JS, server-rendered, keyboard-accessible; no new interaction
          model. Dry brand voice; prices from PRICING. Free SEO. */}
      <Section width="read">
        <Eyebrow>Questions</Eyebrow>
        <SectionTitle>The obvious ones.</SectionTitle>
        <div style={{
          border: '1px solid var(--line)', borderRadius: 'var(--radius-lg)',
          background: 'var(--card)', boxShadow: 'var(--shadow-card)', overflow: 'hidden',
        }}>
          {[
            ['Do I need an Apple Watch?',
             `It works best with a heart-rate source: an Apple Watch, or a chest strap that writes to Apple Health. Without one you still get the plan, the paces and the structure. You just don't get heart-rate coaching.`],
            ['Is it free?',
             `Two weeks of everything, then a free tier that keeps the plan you built. ${PRICING.monthly.display}/month or ${PRICING.annual.display}/year if you want the coaching and the reshaping. I won't email you to come back.`],
            ['What distances?',
             `5K, 10K, half and full marathon, and ultra. Every plan is mostly easy running, with each session set to a zone and held there.`],
            ['Will it make me faster?',
             `If your problem is going medium-hard on everything, yes, by making your easy days genuinely easy, so your hard days can be genuinely hard. It won't turn four hours a week into an elite plan, and it won't pretend to.`],
            // SLT 2026-09-11. The device shot used to carry a plan-adjustment
            // card with Confirm/Revert buttons nobody could press. The board cut
            // it but ruled the objection behind it real: the question a first
            // marathon runner actually has is "what happens when life gets in
            // the way?". It belongs here, answered in a sentence, and honest
            // about which half is paid. Do not move it back into the mock.
            ['What if I miss a week?',
             `Nothing breaks. Missed sessions are a feature of adult life, not a failure, and the plan is built to absorb them. On the paid tier it reshapes around what you actually did; on the free tier the plan stays as generated and you pick it back up. Either way nobody guilt-trips you.`],
            ['Any streaks, badges or leaderboards?',
             `No. On purpose. The app is built to get out of the way, not to keep you in it.`],
          ].map(([q, a], i) => (
            <details key={q} style={{ borderTop: i === 0 ? 'none' : '1px solid var(--line)' }}>
              <summary style={{
                listStyle: 'none', cursor: 'pointer',
                padding: '18px 20px',
                fontFamily: 'var(--font-brand)', fontSize: 'var(--fs-lead)', fontWeight: 600,
                color: 'var(--ink)',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px',
              }}>
                {q}
                <span aria-hidden style={{ color: 'var(--mute)', fontWeight: 400, flexShrink: 0 }}>+</span>
              </summary>
              <p style={{
                margin: 0, padding: '0 20px 18px',
                fontSize: 'var(--fs-body-lg)', lineHeight: 1.6, color: 'var(--ink-2)', maxWidth: '620px',
              }}>
                {a}
              </p>
            </details>
          ))}
        </div>
      </Section>

      {/* ── The free tier — W-05 (SLT 2026-09-21, ranked #1 on the list) ─────
          This is a PROMOTION and a rewrite, not a new section. The argument
          already existed as a 780px card headed "Not ready for the app? Start
          with a free plan." placed AFTER the dark band, which is the weakest
          slot on the page, and which framed the strongest thing we do as a
          consolation prize for people who said no.

          Traynor: *"they are $14.99/mo with a 7-day trial on annual only and
          no ongoing free tier. That is not a feature difference, it is a
          category difference in RISK TO THE BUYER, and it is in small print."*
          Sutherland: *"giving away the whole product is the most persuasive
          thing you do, and you are whispering it."*

          ⚠️ EVERY FACT HERE IS READ FROM `lib/marketing/pricing.ts` AND
          `PRICING`. Nothing is restated. `pricing.test.ts` already fails the
          build when a PAID_ONLY_ONGOING gate has no row on /pricing; a second
          page claiming what free includes would be a new drift surface, and
          this is the item most likely to have created one. */}
      <Section>
        <Eyebrow>The free tier</Eyebrow>
        <SectionTitle
          accent="Then decide."
          sub="Nine complete plans are on this site right now, 5K to marathon. Every week, every session, every pace band. No signup, no email, no weeks blurred out to make a point."
        >
          Read the whole plan.
        </SectionTitle>

        <ul style={{
          listStyle: 'none', margin: '0 0 28px', padding: 0,
          display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 260px), 1fr))',
          gap: '12px',
        }}>
          {FREE_FEATURES.map(f => (
            <li key={f.gate} style={{
              display: 'flex', gap: '12px', alignItems: 'flex-start',
              background: 'var(--card)', border: '1px solid var(--line)',
              borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-card)',
              padding: '16px 18px',
            }}>
              {/* Left accent bar — the same visual language as a session card,
                  by design rather than coincidence (ui-patterns.md §1). */}
              <span aria-hidden style={{
                width: 3, alignSelf: 'stretch', minHeight: 30, borderRadius: 2,
                background: 'var(--moss-strong)', flexShrink: 0,
              }} />
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 'var(--fs-body-lg)', fontWeight: 600, color: 'var(--ink)' }}>{f.name}</div>
                <div style={{ fontSize: 'var(--fs-sm)', lineHeight: 1.5, color: 'var(--mute)', marginTop: 3 }}>{f.detail}</div>
              </div>
            </li>
          ))}
        </ul>

        <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap', alignItems: 'baseline' }}>
          <Link href="/plans" style={{ fontSize: 'var(--fs-body-lg)', fontWeight: 600, color: 'var(--moss-strong)', textDecoration: 'none' }}>
            Read the free plans &rarr;
          </Link>
          <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--mute)', margin: 0 }}>
            Paid adds the coaching that reads your actual runs: {PRICING.monthly.label} or{' '}
            {PRICING.annual.label}.{' '}
            <Link href="/pricing" style={{ color: 'var(--mute)', textDecoration: 'underline' }}>
              What that gets you
            </Link>
          </p>
        </div>
      </Section>

      {/* Founder note kept: it is real brand content and the only place the
          site says who built it. Above the shared footer rather than deleted,
          so the footer itself can be identical on every page.

          🔴 IT READ AS A LINE SOMEBODY FORGOT TO DELETE, and the cause was
          two-thirds spacing (founder, 2026-09-21: "looks misplaced").
          It was a hand-rolled `<section>` with `padding: '40px 24px 0'` — 40
          above, ZERO below — immediately before the near-black closing band,
          so the last words physically touched the black. It also sat outside
          the rhythm system every other band uses (W-07's `--sect-y` tokens)
          at its own hardcoded 1100px, and was set in the same size and
          colour as ordinary body copy, so nothing said it was a signature.

          Now a `Section`: the shared rhythm gives it air on both sides, the
          read measure stops a one-line note spanning the full page frame,
          and the name is set in `--ink` against `--mute` so it reads as
          signed rather than as a stray paragraph. No rule, no rail, no
          chrome — the type does it. */}
      <Section width="read">
        <p style={{ fontSize: 'var(--fs-sm)', lineHeight: 1.6, color: 'var(--mute)', margin: 0 }}>
          <span style={{ color: 'var(--ink)', fontWeight: 600 }}>Built by {BRAND.founder.firstName}.</span>{' '}
          Runs medium-hard on everything. That&apos;s how I know.
        </p>
      </Section>

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
            fontSize: 'var(--fs-caption)', fontWeight: 700, color: 'var(--moss-on-ground)',
            textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '12px',
          }}>
            The receipt
          </div>

          <p style={{
            fontFamily: 'var(--font-brand)',
            fontSize: 'var(--fs-hero)',
            fontWeight: 500, lineHeight: 1.15, letterSpacing: '-0.015em',
            color: 'var(--on-ground)',
            fontStyle: 'italic',
            margin: '0 0 28px',
          }}>
            &ldquo;{BRAND.brandStatement}&rdquo;
          </p>

          <p style={{
            fontSize: 'var(--fs-lead-lg)', lineHeight: 1.6, color: 'var(--on-ground-2)',
            maxWidth: '520px', margin: '0 auto 36px',
          }}>
            Every week, {BRAND.coachName} tells you one true thing about how you actually
            ran, then shows the numbers behind it. Same effort, lower heart rate.
            That&apos;s the whole game.
          </p>

          {/* CTA — light-on-dark. App Store when live; the free-plan hub until
              then (BRAND.appStore.url is empty pre-approval, like AppStoreBadge). */}
          <Link
            href={BRAND.appStore.url || '/plans'}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '8px',
              fontSize: 'var(--fs-body-lg)', fontWeight: 600,
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

      <SiteFooter />
    </main>
  )
}

// ─── Local presentational components ────────────────────────────────────────

/** Section eyebrow — moss, uppercase, the canonical 0.08em label. */
function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontSize: 'var(--fs-caption)', fontWeight: 700, color: 'var(--moss-strong)',
      textTransform: 'uppercase', letterSpacing: '0.08em',
      marginBottom: '12px',
    }}>
      {children}
    </div>
  )
}

/** Section title (+ optional sub line). Shared rhythm across all sections. */
/** GTM-SITE-02 — optional `accent` renders a SECOND LINE in moss.
 *
 *  Borrowed from the competitor analysis, minus the thing that made it wrong
 *  for us: they gradient the second half of every headline, and a gradient is
 *  banned here. The useful part was never the gradient, it was the RHYTHM. A
 *  coloured second line tells the eye which half of the sentence carries the
 *  argument, and one moss line does that without touching the palette.
 *
 *  Split on the clause that IS the argument ("the same grey zone", "done with
 *  restraint"), never at an arbitrary midpoint. A headline with a single clause
 *  gets no accent rather than being forced into two. */
function SectionTitle({ children, accent, sub }: { children: React.ReactNode; accent?: string; sub?: string }) {
  return (
    <div style={{ marginBottom: '48px' }}>
      <h2 style={{
        fontFamily: 'var(--font-brand)',
        fontSize: 'var(--fs-h2)',
        fontWeight: 600, lineHeight: 1.2,
        color: 'var(--ink)', margin: 0,
        maxWidth: '720px',
      }}>
        {children}
        {accent && (
          <>
            <br />
            <span style={{ color: 'var(--moss-strong)' }}>{accent}</span>
          </>
        )}
      </h2>
      {sub && (
        <p style={{
          fontSize: 'var(--fs-lead)', lineHeight: 1.55, color: 'var(--ink-2)',
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
        fontSize: 'var(--fs-eyebrow)', fontWeight: 700, color: 'var(--mute)',
        textTransform: 'uppercase', letterSpacing: '0.08em',
        marginBottom: '12px',
      }}>
        {label}
      </div>
      <div style={{
        fontSize: 'var(--fs-lead-lg)', lineHeight: 1.4, color: 'var(--ink)',
        fontWeight: 500,
      }}>
        {line}
      </div>
    </div>
  )
}

/** One claim about the product, with the real app surface that proves it
 *  directly beneath. No card: the proof beneath is the framed object in the
 *  column, and boxing the sentence as well gives the column two subjects. */
function Pillar({ title, body, children }: { title: string; body: string; children: React.ReactNode }) {
  return (
    // `subgrid` so the heading, the sentence and the product still each sit on
    // a row shared with the other two columns. Without it the three bodies run
    // to different line counts and the three stills start at three different
    // heights, which reads as a page that was assembled rather than set.
    //
    // Degrades safely: a browser without subgrid ignores the value and the
    // three children stack in their own auto rows, exactly as they did before.
    <div style={{
      display: 'grid',
      gridRow: 'span 3',
      gridTemplateRows: 'subgrid',
      // `minmax(0, 1fr)`, never the implicit `auto` column. Without it the
      // single column sizes to its MAX-CONTENT, and SessionCard's detail line
      // ("Zone 2 · < 145 bpm · 6:30-7:30 /km") is `white-space: nowrap`, so the
      // track grew to 321px inside a 272px box and the page scrolled sideways
      // at 320px wide. In the app that text ellipsises because its flex parent
      // sets minWidth 0; a grid track has to be told the same thing.
      gridTemplateColumns: 'minmax(0, 1fr)',
      alignContent: 'start',
    }}>
      <h3 style={{
        fontFamily: 'var(--font-brand)',
        fontSize: 'var(--fs-h4)', fontWeight: 600, lineHeight: 1.3,
        color: 'var(--ink)', margin: 0,
      }}>
        {title}
      </h3>
      <p style={{
        fontSize: 'var(--fs-body)', lineHeight: 1.6, color: 'var(--ink-2)',
        margin: 0, alignSelf: 'start',
      }}>
        {body}
      </p>
      {children}
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
    // CONTENT-ACCURACY (2026-09-11): these two read "20–40 km" and "15–20 km",
    // which were the labels of WEEKLY_KM_CHIPS / LONGEST_RUN_CHIPS. Those chip
    // tables are marked "Not rendered" in GeneratePlanScreen: the Coaching
    // Board replaced both questions with a Ruler on 2026-08-30, so the wizard
    // has not asked for a band in months. The Ruler reads out a number and a
    // unit ("32 km"), which is what a visitor will actually see.
    ['Weekly volume', '32 km'],
    ['Longest run', '18 km'],
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
        fontSize: 'var(--fs-micro)', fontWeight: 700, color: 'var(--mute)',
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
            <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--mute)' }}>{q}</span>
            <span style={{
              fontFamily: 'var(--font-brand)',
              fontSize: 'var(--fs-body-lg)', fontWeight: 600, color: 'var(--ink)',
              textAlign: 'right',
            }}>
              {a}
            </span>
          </div>
        ))}
      </div>
      <p style={{ fontSize: 'var(--fs-caption)', lineHeight: 1.45, color: 'var(--mute)', margin: '14px 0 0' }}>
        Plus injury history, terrain, your weekday time cap and a recent race result if you have one.
      </p>
    </div>
  )
}
