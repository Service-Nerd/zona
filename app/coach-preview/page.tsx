// LOCAL DESIGN HARNESS — 404s in production (see the guard below), not linked
// from anywhere, not in the sitemap.
//
// Exists because the arc lives inside a tier-gated, authed card: without this
// there is no way to LOOK at it, and "it compiles" is not the same claim as
// "it renders correctly in every state". The first attempt at this feature
// shipped as a comment above an unchanged component precisely because nobody
// could see the difference.
//
// Renders the real components with fixture props. If you change
// RaceProgressArcRow or ZoneRings, check this page.

'use client'

import { notFound } from 'next/navigation'
import { buildRaceProgressArc } from '@/lib/coaching/raceProgressArc'
import { RaceProgressArcRow } from '@/components/shared/RaceProgressArcRow'
import { RACE_PROJECTIONS_COPY } from '@/components/shared/raceProjectionsCopy'
import ZoneRings from '@/components/shared/ZoneRings'
import TrendCard from '@/components/shared/TrendCard'

const ARC_COPY = RACE_PROJECTIONS_COPY.status.arc!

const CASES: { title: string; note: string; input: Parameters<typeof buildRaceProgressArc>[0] }[] = [
  {
    title: 'Improving, with a time goal',
    note: 'The full three points. The case the founder asked for.',
    input: { baselineSeconds: 3 * 3600 + 53 * 60 + 36, currentSeconds: 3 * 3600 + 48 * 60 + 12, goalSeconds: 3 * 3600 + 45 * 60 },
  },
  {
    title: 'Gone backwards',
    note: 'Must NOT read as progress. Muted, not moss, and never --danger.',
    input: { baselineSeconds: 3 * 3600 + 45 * 60, currentSeconds: 3 * 3600 + 53 * 60 + 20, goalSeconds: 3 * 3600 + 40 * 60 },
  },
  {
    title: 'Goal already beaten',
    note: 'The gap clamps at zero. Never "-3m to find".',
    input: { baselineSeconds: 4 * 3600 + 5 * 60, currentSeconds: 3 * 3600 + 57 * 60 + 4, goalSeconds: 4 * 3600 },
  },
  {
    title: 'Holding',
    note: 'Inside the 30-second significance floor. Says so rather than inventing a direction.',
    input: { baselineSeconds: 49 * 60 + 10, currentSeconds: 49 * 60 + 25, goalSeconds: 45 * 60 },
  },
  {
    title: 'Finish goal, no target time',
    note: 'Two points. Most beginners are here.',
    input: { baselineSeconds: 4 * 3600 + 4 * 60, currentSeconds: 3 * 3600 + 59 * 60 + 30, goalSeconds: null },
  },
  {
    title: 'Week one — no plan-start estimate',
    note: 'Now and the goal. No fabricated baseline.',
    input: { baselineSeconds: null, currentSeconds: 26 * 60 + 40, goalSeconds: 25 * 60 },
  },
  {
    title: 'Now only',
    note: 'One point, no claims. The floor of the design.',
    input: { baselineSeconds: null, currentSeconds: 23 * 60 + 42, goalSeconds: null },
  },
]

export default function CoachPreviewPage() {
  // Committed so the next person can use it, unreachable on www.zonna.run:
  // it renders invented race times, and an unlinked route is still a public
  // one. `NODE_ENV` is inlined at build time, so this is dead-stripped.
  if (process.env.NODE_ENV === 'production') notFound()

  return (
    <main style={{ background: 'var(--bg)', minHeight: '100vh', padding: '24px 16px 64px', fontFamily: 'var(--font-ui)' }}>
      <h1 style={{ fontSize: '18px', fontWeight: 800, color: 'var(--ink)', margin: '0 0 4px' }}>
        Race progress arc
      </h1>
      <p style={{ fontSize: '13px', color: 'var(--mute)', margin: '0 0 24px' }}>
        UX-COACH-01 states. Fixture data, real components.
      </p>

      {/* ── The read + rings as ONE card (the "they appear separate" fix) ── */}
      <div style={{ maxWidth: '420px', marginBottom: '28px' }}>
        <div style={{
          background: 'var(--card)', borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--line)', padding: '18px 20px 18px 22px', position: 'relative',
        }}>
          <div style={{ position: 'absolute', left: '8px', top: '14px', bottom: '14px', width: '3px', background: 'var(--moss)', borderRadius: '2px' }} />
          <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--moss)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: '10px' }}>
            Kit &middot; this week
          </div>
          <div style={{ fontSize: '17px', fontWeight: 600, color: 'var(--ink)', lineHeight: 1.4, marginBottom: '8px' }}>
            Nine per cent of your week sat in Zone 3.
          </div>
          <div style={{ fontSize: '14px', color: 'var(--ink-2)', lineHeight: 1.55 }}>
            That is the grey middle. Everything else held where it should.
          </div>
          <div style={{ height: '1px', background: 'var(--line)', margin: '18px 0 16px' }} />
          <ZoneRings chromeless pctByZone={{ z1: 10, z2: 62, z3: 9, z45: 19 }} meta="across 4 runs" />
        </div>
        <p style={{ fontSize: '12px', color: 'var(--mute)', margin: '10px 0 0' }}>
          One card. Word and image, one eyeful. Compare against the two bordered boxes that shipped.
        </p>
      </div>

      {/* ── Trend card labels ───────────────────────────────────────────── */}
      <div style={{ maxWidth: '420px', marginBottom: '28px' }}>
        <TrendCard
          state="live"
          label="Easy run trend"
          sessionLabel="easy run"
          earlierMonth="Apr"
          earlierHr={151}
          nowHr={144}
          cohortSize={20}
          windowMonths={6}
          glossless
        />
        <p style={{ fontSize: '12px', color: 'var(--mute)', margin: '10px 0 0' }}>
          Meta must read &ldquo;6mo&rdquo;, not &ldquo;6w&rdquo;. Tap it: the sheet must say &ldquo;easy runs&rdquo;, not &ldquo;long runs&rdquo;.
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '18px', maxWidth: '420px' }}>
        {CASES.map(({ title, note, input }) => {
          const arc = buildRaceProgressArc(input)
          return (
            <div key={title} style={{ background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 'var(--radius-lg)', padding: '20px' }}>
              <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--mute)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '10px' }}>
                {title}
              </div>
              <div style={{ background: 'var(--bg-soft)', borderRadius: '10px', borderLeft: '3px solid var(--s-race)', padding: '12px 14px' }}>
                <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--mute)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '6px' }}>
                  Your race
                </div>
                <div style={{ fontSize: '12px', color: 'var(--ink-2)', marginBottom: '14px' }}>London Marathon</div>
                {arc
                  ? <RaceProgressArcRow arc={arc} copy={ARC_COPY} />
                  : <div style={{ fontSize: '13px', color: 'var(--mute)' }}>No arc (no measured present).</div>}
              </div>
              <p style={{ fontSize: '12px', color: 'var(--mute)', lineHeight: 1.5, margin: '10px 0 0' }}>{note}</p>
            </div>
          )
        })}
      </div>
    </main>
  )
}
