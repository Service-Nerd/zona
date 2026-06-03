// GTM-08 — Marketing landing page (FREE, public).
//
// Renders a one-page site for unauthenticated visitors; signed-in visitors are
// forwarded to /dashboard server-side so they never see the marketing surface.
//
// ─── Dark-launched ─────────────────────────────────────────────────────────
// Gated behind MARKETING_SITE_ENABLED. When unset/falsy (default, including
// production today) the root route preserves the legacy redirect-to-dashboard
// behaviour. Flip the env to "true" in Vercel when the custom domain lands +
// TestFlight is live + you actually want this surface public. No release-day
// deploy needed at that point — just an env toggle.
//
// Copy is sourced entirely from `lib/brand.ts` so a brand rename only touches
// that file. Tagline placement follows the three-line system in CLAUDE.md:
//   • Hero headline       → BRAND.appStoreSubtitle  (functional, discovery-facing)
//   • Demographic hook    → BRAND.tagline           (names the user)
//   • Closing voice line  → BRAND.brandStatement    (personality moment)
//   • Voice anchor lift   → BRAND.voiceAnchor       (one in-product voice example)
// Never mix two taglines on the same surface — each owns its own block.
//
// Product mockups are pure CSS (Warm Slate tokens). Faster than maintaining
// real screenshots through redesigns, and stays on-palette automatically.

import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { BRAND, PRICING } from '@/lib/brand'
import { Wordmark } from '@/components/ui/Wordmark'
import { WaitlistForm } from '@/components/marketing/WaitlistForm'
import { AppStoreBadge } from '@/components/marketing/AppStoreBadge'

export const dynamic = 'force-dynamic'  // auth check must run per-request

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

      {/* ── Top nav — wordmark + Sign in ─────────────────────────────── */}
      <nav style={{
        maxWidth: '1100px', margin: '0 auto',
        padding: '20px 24px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <Wordmark size="sm" />
        <Link href="/auth/login" style={{
          fontSize: '14px', fontWeight: 500, color: 'var(--ink-2)',
          textDecoration: 'none', padding: '8px 14px',
          border: '1px solid var(--line)', borderRadius: 'var(--radius-md, 8px)',
          background: 'var(--card)',
        }}>
          Sign in
        </Link>
      </nav>

      {/* ── Hero ─────────────────────────────────────────────────────── */}
      <section style={{
        maxWidth: '780px', margin: '0 auto',
        padding: '64px 24px 80px',
        textAlign: 'center',
      }}>
        <div style={{
          display: 'inline-block',
          padding: '6px 12px',
          borderRadius: '999px',
          background: 'rgba(107,142,107,0.12)',
          color: 'var(--moss)',
          fontSize: '12px', fontWeight: 600,
          letterSpacing: '0.08em', textTransform: 'uppercase',
          marginBottom: '24px',
        }}>
          {BRAND.voiceAnchor}
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

        {/* Primary action — download-first. App Store badge ("coming soon" until
            BRAND.appStore.url is set) sits above the waitlist capture. */}
        <div id="waitlist" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px' }}>
          <AppStoreBadge />
          <WaitlistForm />
        </div>

        <p style={{
          marginTop: '18px',
          fontSize: '14px', color: 'var(--ink-2)',
        }}>
          {PRICING.trialDays} days free. Then {PRICING.monthly.display}/month or {PRICING.annual.display}/year. Cancel anytime.
        </p>

        <p style={{
          marginTop: '8px',
          fontSize: '13px', color: 'var(--mute)',
        }}>
          Works with Apple Health. Apple Watch supported.
        </p>

        <p style={{
          marginTop: '24px',
          fontSize: '14px', color: 'var(--mute)',
        }}>
          {BRAND.tagline}
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
          <div style={{
            fontSize: '12px', fontWeight: 700, color: 'var(--moss)',
            textTransform: 'uppercase', letterSpacing: '0.08em',
            textAlign: 'center', marginBottom: '12px',
          }}>
            The problem
          </div>
          <h2 style={{
            fontFamily: 'var(--font-brand)',
            fontSize: 'clamp(28px, 4vw, 36px)',
            fontWeight: 600, lineHeight: 1.2,
            color: 'var(--ink)',
            textAlign: 'center', margin: '0 0 56px',
            maxWidth: '720px', marginLeft: 'auto', marginRight: 'auto',
          }}>
            Every run ends up in the same grey middle.
          </h2>

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
        <div style={{
          fontSize: '12px', fontWeight: 700, color: 'var(--moss)',
          textTransform: 'uppercase', letterSpacing: '0.08em',
          textAlign: 'center', marginBottom: '12px',
        }}>
          The product
        </div>
        <h2 style={{
          fontFamily: 'var(--font-brand)',
          fontSize: 'clamp(28px, 4vw, 36px)',
          fontWeight: 600, lineHeight: 1.2,
          color: 'var(--ink)',
          textAlign: 'center', margin: '0 0 56px',
        }}>
          Three things, done with restraint.
        </h2>

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
            body="No streaks. No leaderboards. No motivational posters. One job per screen. The plan shows up, you run, the plan adjusts."
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

      {/* ── Closing voice moment + CTA ───────────────────────────────── */}
      <section style={{
        background: 'var(--bg-soft)',
        borderTop: '1px solid var(--line)',
        padding: '80px 24px',
        textAlign: 'center',
      }}>
        <p style={{
          fontFamily: 'var(--font-brand)',
          fontSize: 'clamp(28px, 4vw, 40px)',
          fontWeight: 500, lineHeight: 1.2,
          color: 'var(--ink)',
          maxWidth: '640px', margin: '0 auto 36px',
          fontStyle: 'italic',
        }}>
          &ldquo;{BRAND.brandStatement}&rdquo;
        </p>
        <a href="#waitlist" style={{
          display: 'inline-block',
          padding: '14px 28px',
          background: 'var(--moss)', color: 'white',
          fontSize: '15px', fontWeight: 600,
          borderRadius: 'var(--radius-md, 8px)',
          textDecoration: 'none',
        }}>
          Join the waitlist
        </a>
        <p style={{ marginTop: '16px', fontSize: '14px', color: 'var(--mute)' }}>
          {BRAND.signupSub}
        </p>
      </section>

      {/* ── Footer ───────────────────────────────────────────────────── */}
      <footer style={{
        padding: '40px 24px',
        borderTop: '1px solid var(--line)',
        background: 'var(--bg)',
      }}>
        <div style={{
          maxWidth: '1100px', margin: '0 auto',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          flexWrap: 'wrap', gap: '16px',
          fontSize: '13px', color: 'var(--mute)',
        }}>
          <div>© {new Date().getFullYear()} {BRAND.name}</div>
          <div style={{ display: 'flex', gap: '20px' }}>
            <Link href="/support" style={{ color: 'var(--mute)', textDecoration: 'none' }}>Support</Link>
            <Link href="/privacy" style={{ color: 'var(--mute)', textDecoration: 'none' }}>Privacy</Link>
            <Link href="/terms" style={{ color: 'var(--mute)', textDecoration: 'none' }}>Terms</Link>
          </div>
        </div>
      </footer>
    </main>
  )
}

// ─── Local presentational components ────────────────────────────────────────

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
        <span>Kit · this week</span>
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
