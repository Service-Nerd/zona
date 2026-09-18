// LOCAL DESIGN HARNESS — 404s in production, not linked from anywhere, not in
// the sitemap. Same pattern as /me-preview, /coach-preview, /post-run-preview.
//
// WHY THIS EXISTS. ONBOARD-EXIT-01 put `SignOutLink` on four screens that all
// sit behind auth AND behind "has no plan yet": the Generate Plan wizard, the
// Orientation screen, Connect Runs, and the Push-permission screen. To reach
// them for real you need a fresh account with no plan, on a device, which is
// why the first commit shipped saying the pixels were unseen. That is the
// exact gap /me-preview was built to close for the Me screen — a comment
// describing a layout is not evidence the layout is right.
//
// Renders the REAL component in the REAL footer compositions. If you change
// SignOutLink or any of those four footers, check this page.

'use client'

import { notFound } from 'next/navigation'
import SignOutLink from '@/components/shared/SignOutLink'
import RunwayRevealCard from '@/components/shared/RunwayRevealCard'
import FirstRunCard from '@/components/shared/FirstRunCard'
import PlanScaleCard from '@/components/shared/PlanScaleCard'
import CharityCohortCard from '@/components/shared/CharityCohortCard'
import { ceremonyLinesFor } from '@/lib/plan/ceremonyLines'
import type { GeneratorInput } from '@/types/plan'

/** The link is live code — clicking it here would really end your session.
 *  A capture-phase stop keeps the rendering real and the action inert. */
function Inert({ children }: { children: React.ReactNode }) {
  return (
    <div onClickCapture={e => { e.preventDefault(); e.stopPropagation() }}>
      {children}
    </div>
  )
}

const MOSS_CTA: React.CSSProperties = {
  width: '100%', padding: '15px', borderRadius: 'var(--radius-md)',
  background: 'var(--moss)', color: 'var(--card)', border: 'none',
  fontFamily: 'var(--font-ui)', fontSize: '15px', fontWeight: 600,
}

const SECONDARY: React.CSSProperties = {
  width: '100%', textAlign: 'center', background: 'none', border: 'none',
  fontFamily: 'var(--font-ui)', fontSize: '13px', color: 'var(--mute)', padding: '8px',
}

function Case({ title, note, children }: { title: string; note: string; children: React.ReactNode }) {
  return (
    <div style={{ background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 'var(--radius-lg)', padding: '16px' }}>
      <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--mute)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '10px' }}>
        {title}
      </div>
      <div style={{ background: 'var(--bg)', borderRadius: '10px', overflow: 'hidden' }}>{children}</div>
      <p style={{ fontSize: '12px', color: 'var(--mute)', lineHeight: 1.5, margin: '10px 0 0' }}>{note}</p>
    </div>
  )
}

/** The wizard's sticky footer, reproduced from GeneratePlanScreen.tsx. */
function WizardFooter({ optional }: { optional: boolean }) {
  return (
    <div style={{ padding: '12px 20px', borderTop: '1px solid var(--line)', background: 'var(--bg)' }}>
      {optional && <button style={{ ...SECONDARY, marginBottom: '8px' }}>Skip this →</button>}
      <button style={MOSS_CTA}>Continue</button>
      <Inert><SignOutLink /></Inert>
    </div>
  )
}

export default function OnboardingPreviewPage() {
  // NODE_ENV is inlined at build time, so this is dead-stripped in production.
  if (process.env.NODE_ENV === 'production') notFound()

  return (
    <main style={{ background: 'var(--bg)', minHeight: '100vh', padding: '28px 16px 64px', fontFamily: 'var(--font-ui)' }}>
      <h1 style={{ fontFamily: 'var(--font-brand)', fontSize: '20px', fontWeight: 600, color: 'var(--ink)', margin: '0 0 6px' }}>
        Onboarding — the way out
      </h1>
      <p style={{ fontSize: '12px', color: 'var(--mute)', lineHeight: 1.6, margin: '0 0 24px', maxWidth: '420px' }}>
        Real <code>SignOutLink</code>, real footer compositions, fixture props. Clicks are inert. Dev only.
        View at 375px wide — these screens are phone-first.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '18px', maxWidth: '420px' }}>
        <Case
          title="Wizard footer — required step"
          note="The common case: CTA, then the escape. The link must read as an aside, not a second choice competing with Continue."
        >
          <WizardFooter optional={false} />
        </Case>

        <Case
          title="Wizard footer — optional step (the crowded one)"
          note="Worst case for this composition: Skip above the CTA and Sign out below it, two muted links sandwiching one moss button. Check the CTA still dominates and the two links do not read as a pair."
        >
          <WizardFooter optional />
        </Case>

        <Case
          title="Orientation / Push permission — below the primary action"
          note="Both screens end in one moss CTA with plenty of space above. Nothing competes here."
        >
          <div style={{ padding: '20px' }}>
            <button style={MOSS_CTA}>Got it</button>
            <Inert><SignOutLink /></Inert>
          </div>
        </Case>

        <Case
          title="Connect Runs — the screen that already had one"
          note="Was a hand-rolled copy at 40px that never cleared the widget store. Now the same component as everywhere else, with the screen's own skip link above it."
        >
          <div style={{ padding: '20px' }}>
            <button style={MOSS_CTA}>Connect Apple Health</button>
            <button style={{ ...SECONDARY, marginTop: '8px' }}>Not now →</button>
            <Inert><SignOutLink /></Inert>
          </div>
        </Case>

        <Case
          title="Disabled — host screen mid-action"
          note="What ConnectRuns passes while a permission prompt is in flight. Must not look broken, just unavailable."
        >
          <div style={{ padding: '20px' }}>
            <button style={{ ...MOSS_CTA, background: 'var(--moss-soft)', color: 'var(--mute)' }}>Connecting…</button>
            <Inert><SignOutLink disabled /></Inert>
          </div>
        </Case>

        {/* FIRSTRUN-MOMENTS-01a/b/c/d/e — the plan reveal. Auth-gated AND
            gated on "has no plan yet", so these three cards shipped without
            anyone seeing them stacked. This is the three-beat arc as a London
            2027 first-timer meets it. */}
        <Case
          title="Plan reveal — the three-beat arc (01a · 01b · 01d/e)"
          note="Relief, then the first concrete action, then the honest size of it, then (for a charity runner only) one true fact about not being alone. Read them in order: does the sequence feel like it was written for one person? Real components, fixture props from a London 2027 first-timer."
        >
          <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <RunwayRevealCard
              weeks={11}
              note={'You have 11 weeks before this plan starts, and we are not going to pretend they are training. Your plan is laid out backwards from race day and there is a limit to how long a useful one runs for, so the spare weeks sit in front of it rather than being added to it. Keep running easy through them, at the volume you are on now. Do not use the time to ramp up: arriving at week one with the legs you have today is the point.'}
            />
            <FirstRunCard dayLabel="Monday" metric="20 min" effort="Easy" reassure />
            {/* FIRSTRUN-GATE-CALL-01 — the same card for an experienced runner.
                Both states are shown because the SLT ruling is about which
                sentence appears, and a harness that only renders one of them
                cannot show whether the ruling landed. */}
            <FirstRunCard dayLabel="Tuesday" metric="8km" effort="Easy" reassure={false} />
            <PlanScaleCard totalDistance="780km" raceDistance="42.2km" hardestRun="3h 28" hardestMonth="March" />
            <CharityCohortCard partnerName="Make-A-Wish UK" cohortSize={500} />
          </div>
        </Case>

        <Case
          title="Plan scale — no long run to name (01e absent)"
          note="A plan with nothing to call the longest run drops that line entirely rather than rendering half a sentence. The reframe still stands alone."
        >
          <div style={{ padding: '16px' }}>
            <PlanScaleCard totalDistance="180km" raceDistance="10km" hardestRun={null} hardestMonth={null} />
          </div>
        </Case>

        <Case
          title="Ceremony lines (01c) — what this runner is told while it builds"
          note="Was five FIXED lines shown to everyone. These are derived from the runner's own answers: 3 days, longest run 8 km, a knee, a 45-minute weekday cap, marathon. The job is proving we listened, not motivating."
        >
          <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {ceremonyLinesFor({
              days_available: 3, longest_recent_run_km: 8, max_weekday_mins: 45,
              race_distance_km: 42.2, injury_history: ['knee'],
            } as Partial<GeneratorInput>).map(line => (
              <div key={line} style={{ fontFamily: 'var(--font-ui)', fontSize: '15px', color: 'var(--ink)', lineHeight: 1.5 }}>
                {line}
              </div>
            ))}
          </div>
        </Case>

        <Case
          title="LIVE — this one really signs you out"
          note="Every case above is inert so the page can be read. This one is not: pressing it runs the real sequence and must land you on /auth/login. It is the only way to exercise the wiring without a phone and a fresh account, and it is why this page exists rather than a screenshot."
        >
          <div style={{ padding: '20px' }}>
            <SignOutLink />
          </div>
        </Case>
      </div>
    </main>
  )
}
