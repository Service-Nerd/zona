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

/** Monthly buckets as `/api/coaching/trend` returns them. */
const months = (pairs: [string, number | null][]) =>
  pairs.map(([monthKey, avgHr]) => ({
    monthKey,
    shortLabel: ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][Number(monthKey.slice(5))],
    avgHr,
  }))

const BASE = {
  state: 'live' as const,
  label: 'Easy run trend',
  sessionLabel: 'easy run',
  glossless: true,
}

const TREND_CASES = [
  {
    title: 'Improving, six months',
    note: 'Moss line, falling. The hollow dot is where it started, the solid one is now. Meta must read "6mo", not "6w"; tap it and the sheet must say "easy runs", not "long runs".',
    props: { ...BASE, earlierMonth: 'Apr', earlierHr: 152, nowHr: 144, cohortSize: 20, windowMonths: 6,
      series: months([['2026-04', 152], ['2026-05', 150], ['2026-06', 151], ['2026-07', 147], ['2026-08', 146], ['2026-09', 144]]) },
  },
  {
    title: 'Gone backwards',
    note: 'Line rises and goes MUTED. A rising easy HR is usually load, not decline, and --danger is errors only.',
    props: { ...BASE, earlierMonth: 'Apr', earlierHr: 145, nowHr: 153, cohortSize: 17, windowMonths: 6,
      series: months([['2026-04', 145], ['2026-05', 147], ['2026-06', 146], ['2026-07', 150], ['2026-08', 152], ['2026-09', 153]]) },
  },
  {
    title: 'A missing month',
    note: 'May has no usable data. It is dropped, never interpolated, and the Apr-to-Jun span is visibly wider because x is elapsed TIME, not array position.',
    props: { ...BASE, earlierMonth: 'Apr', earlierHr: 152, nowHr: 144, cohortSize: 14, windowMonths: 6,
      series: months([['2026-04', 152], ['2026-05', null], ['2026-06', 149], ['2026-09', 144]]) },
  },
  {
    title: 'Only two months',
    note: 'NO LINE. Two points are a straight segment between numbers already shown in 44pt type. The card is exactly what it was before.',
    props: { ...BASE, earlierMonth: 'Aug', earlierHr: 150, nowHr: 145, cohortSize: 8, windowMonths: 6,
      series: months([['2026-08', 150], ['2026-09', 145]]) },
  },
  {
    title: 'Flat',
    note: 'Centre line, not pinned to an edge. A series that did nothing must not draw an all-time high.',
    props: { ...BASE, earlierMonth: 'Apr', earlierHr: 148, nowHr: 148, cohortSize: 19, windowMonths: 6,
      series: months([['2026-04', 148], ['2026-06', 148], ['2026-09', 148]]) },
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

      {/* ── Trend card: labels, and the line between the numbers ────────── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '18px', maxWidth: '420px', marginBottom: '28px' }}>
        {TREND_CASES.map(({ title, note, props }) => (
          <div key={title}>
            <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--mute)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '8px' }}>
              {title}
            </div>
            <TrendCard {...props} />
            <p style={{ fontSize: '12px', color: 'var(--mute)', lineHeight: 1.5, margin: '10px 0 0' }}>{note}</p>
          </div>
        ))}
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
