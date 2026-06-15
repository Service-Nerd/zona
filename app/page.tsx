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
//   • Hero headline (h1)  → BRAND.appStoreSubtitle  (functional, discovery/SEO)
//   • Closing voice line  → BRAND.brandStatement    (personality moment)
//
// ─── Brand-rule note (revisit if challenged) ───────────────────────────────
// CLAUDE.md locks "never mix two taglines on the same surface" and maps the
// landing-page hero to appStoreSubtitle. On a *destination marketing* surface
// (not the App Store), voice should lead — so the tagline is elevated to the
// hero kicker while appStoreSubtitle stays the functional <h1> / SEO anchor.
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
import { Wordmark } from '@/components/ui/Wordmark'
import { AppStoreBadge } from '@/components/marketing/AppStoreBadge'

export const dynamic = 'force-dynamic'  // auth check must run per-request

// ─── Page-level metadata (overrides layout.tsx defaults for this route) ──────
// Description: 155 chars — rich enough for Google's snippet, honest tone.
// Canonical: prevents /rts-training-hub.vercel.app and /zonna.run indexing
// the same page as duplicates once the custom domain is live.
// NEXT_PUBLIC_APP_URL must be set to https://zonna.run in Vercel env vars.
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://zonna.run'

export const metadata: Metadata = {
  title: `${BRAND.name} — ${BRAND.appStoreSubtitle}`,
  description: `Training plans for runners who go medium-hard on everything. ${BRAND.name} prescribes the zone for each session and holds you to it. Built for the day-job runner. ${PRICING.trialDays} days free.`,
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

  return (
    <main style={{ background: 'var(--bg)', color: 'var(--ink)', minHeight: '100vh', fontFamily: 'var(--font-ui)' }}>

      {/* ── Top nav — wordmark only (sign-in removed) ────────────────────── */}
      <nav style={{
        maxWidth: '1100px', margin: '0 auto',
        padding: '20px 24px',
        display: 'flex', alignItems: 'center',
      }}>
        <Wordmark size="sm" />
      </nav>

      {/* ── Hero ─────────────────────────────────────────────────────── */}
      <section style={{
        maxWidth: '780px', margin: '0 auto',
        padding: '56px 24px 80px',
        textAlign: 'center',
      }}>
        {/* Tagline elevated to hero kicker — voice leads on this surface. */}
        <div style={{
          fontFamily: 'var(--font-brand)',
          fontSize: 'clamp(17px, 2.4vw, 21px)',
          fontWeight: 600, lineHeight: 1.3, letterSpacing: '-0.01em',
          color: 'var(--moss)',
          marginBottom: '18px',
        }}>
          {BRAND.tagline}
        </div>

        <h1 style={{
          fontFamily: 'var(--font-brand)',
          fontSize: 'clamp(36px, 6vw, 56px)',
          fontWeight: 700, lineHeight: 1.05, letterSpacing: '-0.02em',
          color: 'var(--ink)',
          margin: '0 0 24px',
        }}>
          {BRAND.appStoreSubtitle}
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
          Two weeks, full access. Then {PRICING.monthly.display}/month or {PRICING.annual.display}/year —
          or you walk. We won&apos;t email you to come back.
        </p>

        <p style={{
          marginTop: '8px',
          fontSize: '13px', color: 'var(--mute)',
        }}>
          Works with Apple Health. Apple Watch supported.
        </p>
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
          <SectionTitle>Every run ends up in the same grey middle.</SectionTitle>

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
            body="Rule-engine generated from your race, fitness, age, and weekly volume — not a one-size template. Pace bands and HR zones derived from your inputs, not guessed."
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
          <SectionTitle sub="Race, fitness, age, weekly volume. Pace bands and HR zones are derived from those — not lifted from a template.">
            Your plan starts from four answers.
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

      {/* ── Closing voice moment — ends on the line, no button ─────────── */}
      <section style={{
        padding: '96px 24px',
        textAlign: 'center',
      }}>
        <p style={{
          fontFamily: 'var(--font-brand)',
          fontSize: 'clamp(32px, 5vw, 48px)',
          fontWeight: 500, lineHeight: 1.15, letterSpacing: '-0.01em',
          color: 'var(--ink)',
          maxWidth: '680px', margin: '0 auto',
          fontStyle: 'italic',
        }}>
          &ldquo;{BRAND.brandStatement}&rdquo;
        </p>
      </section>

      {/* ── Footer ───────────────────────────────────────────────────── */}
      <footer style={{
        padding: '40px 24px',
        borderTop: '1px solid var(--line)',
        background: 'var(--bg)',
      }}>
        <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
          {/* One-line founder note — no headshot, no story page. */}
          <p style={{
            fontSize: '13px', lineHeight: 1.5, color: 'var(--ink-2)',
            margin: '0 0 20px',
          }}>
            Built by Russell. Runs medium-hard on everything. That&apos;s how I know.
          </p>
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            flexWrap: 'wrap', gap: '16px',
            fontSize: '13px', color: 'var(--mute)',
            borderTop: '1px solid var(--line)', paddingTop: '20px',
          }}>
            <div>© {new Date().getFullYear()} {BRAND.name}</div>
            <div style={{ display: 'flex', gap: '20px' }}>
              <Link href="/support" style={{ color: 'var(--mute)', textDecoration: 'none' }}>Support</Link>
              <Link href="/privacy" style={{ color: 'var(--mute)', textDecoration: 'none' }}>Privacy</Link>
              <Link href="/terms" style={{ color: 'var(--mute)', textDecoration: 'none' }}>Terms</Link>
            </div>
          </div>
        </div>
      </footer>
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
  const answers: Array<[string, string]> = [
    ['How far?', 'Half marathon'],
    ['Goal', 'Sub-2:00'],
    ['Weekly volume', '20–40 km'],
    ['Age', '38'],
  ]
  return (
    <div style={{
      background: 'var(--card)',
      border: '1px solid var(--line)',
      borderRadius: 'var(--radius-lg, 12px)',
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
