// LOCAL DESIGN HARNESS — 404s in production (see the guard below), not linked
// from anywhere, not in the sitemap.
//
// Exists because the post-run card is tier-gated and behind auth: without this
// there is no way to LOOK at it, and "it compiles" is not the same claim as
// "it renders correctly in every state". This repo has already shipped a comment
// describing a change to a component nobody could see.
//
// Renders the REAL `RunFeedbackCard` with fixture rows. It is deliberately not a
// copy of the component — a second implementation in a preview page proves the
// preview renders, not the product.
//
// UX-POSTRUN-01 (SLT 2026-09-13) + §108 Amendment 1 (Coaching Board, same day).

'use client'

import { notFound } from 'next/navigation'
import { RunFeedbackCard } from '../dashboard/DashboardClient'

type Case = { title: string; note: string; analysis: Record<string, unknown>; paceTarget?: string | null; driftContext?: { show: boolean; drifted: number; total: number } | null }

const CASES: Case[] = [
  {
    title: 'THE FOUNDER\'S REAL RUN — 2026-10-07, week 3 Progressive tempo',
    note: "Copied VERBATIM from run_analysis in production (week 3 / wed, created 13:45Z). Nothing invented: this is the card he screenshotted at 15:03. Added so the post-run review is run on the real thing rather than on a plausible fixture.",
    paceTarget: '5:07–5:22 /km',
    analysis: {
      source: 'strava', verdict: 'off_target', total_score: 50,
      hr_discipline_score: 32, distance_score: 80, pace_score: 40, ef_score: 80,
      hr_in_zone_pct: 32.26,
      planned_load_km: 8.5, actual_load_km: 9.88,
      planned_load_mins: 48, actual_load_mins: 61.12,
      ef_value: 0.0175, ef_baseline: 0.0179, ef_trend_pct: -2.39,
      feedback_text:
        "You ran 1.4km longer than planned and spent most of it above the zone, which means the session drifted from tempo into steady-state effort. HR climbed 13 bpm in the back third\u2014the limiter looks like aerobic capacity, not leg speed\u2014so hold the zone next time: if you're creeping above 158, ease back rather than push through. This suggests you need more patience on the build phase; quality tempo only counts when it stays in the band.",
    },
  },
  {
    title: 'No heart rate — §108 Amendment 1',
    note: "THE FOUNDER'S SCREENSHOT. Was a confident 69/100 with a four-column dashboard, 37.5 points of which were a default for the axis nothing measured. Now: no number, no verdict, one honest line.",
    paceTarget: '7:00–7:45 /km',
    analysis: {
      source: 'strava', verdict: null, total_score: null,
      hr_discipline_score: null, distance_score: 50, pace_score: 75, ef_score: 75,
      hr_in_zone_pct: null,
      feedback_text:
        "No heart rate, so this one goes unscored. The extra 3 km is fine if the effort was genuinely easy, but without the monitor we are both guessing at the zone.",
    },
  },
  {
    title: 'Zone held — the good case',
    note: 'The single behavioural signal Wood argued to keep. Moss above 80.',
    paceTarget: '7:00–7:45 /km',
    analysis: {
      source: 'strava', verdict: 'nailed', total_score: 88,
      hr_discipline_score: 92, distance_score: 95, pace_score: 80, ef_score: 75,
      hr_in_zone_pct: 92,
      feedback_text: "92% in zone on an easy run is the whole job done. Nothing to change here.",
    },
  },
  {
    title: 'Zone drifted — the case the product exists for',
    note: 'Amber. This is the grey-zone run Zonna is built to name, and it is now the loudest thing on the card rather than one of four columns.',
    paceTarget: '7:00–7:45 /km',
    analysis: {
      source: 'strava', verdict: 'off_target', total_score: 41,
      hr_discipline_score: 24, distance_score: 90, pace_score: 60, ef_score: 55,
      hr_in_zone_pct: 24,
      feedback_text: "24% in zone means this was not an easy run, whatever the plan called it. Tomorrow needs to be genuinely slow to pay for it.",
    },
  },
  {
    title: 'POST-RUN-CONTEXT-01 — the block-level line',
    note: 'The differentiator: none of the six competitors joins the run to the block. It COUNTS, it never concludes — no "which is why Saturday felt heavy". Silent by default and never twice running (Wood).',
    paceTarget: '7:00–7:45 /km',
    driftContext: { show: true, drifted: 3, total: 5 },
    analysis: {
      source: 'strava', verdict: 'off_target', total_score: 44,
      hr_discipline_score: 28, distance_score: 90, pace_score: 62, ef_score: 58,
      hr_in_zone_pct: 28,
      feedback_text: "28% in zone means this was not an easy run, whatever the plan called it. Tomorrow needs to be genuinely slow to pay for it.",
    },
  },
  {
    title: 'Same run, but the line is SILENT (never twice in a row)',
    note: "Wood's binding condition. A counter the runner sees every run stops being information and becomes wallpaper.",
    paceTarget: '7:00–7:45 /km',
    driftContext: { show: false, drifted: 4, total: 5 },
    analysis: {
      source: 'strava', verdict: 'off_target', total_score: 44,
      hr_discipline_score: 28, distance_score: 90, pace_score: 62, ef_score: 58,
      hr_in_zone_pct: 28,
      feedback_text: "Still hot. Nothing new to add that yesterday did not already say.",
    },
  },
  {
    title: 'Manual entry — no activity data to score',
    note: 'The isManual branch: no zone signal, no score toggle. Unchanged by this work, included so a regression here is visible.',
    analysis: {
      source: 'manual', verdict: 'close', total_score: null,
      hr_discipline_score: null, distance_score: null, pace_score: null, ef_score: null,
      feedback_text: null,
    },
  },
  {
    title: 'Scored, but no Kit read yet',
    note: 'Analysis landed before the AI call returned. The card must not leave a gap where Kit will be.',
    paceTarget: '7:00–7:45 /km',
    analysis: {
      source: 'strava', verdict: 'close', total_score: 72,
      hr_discipline_score: 70, distance_score: 80, pace_score: 70, ef_score: 65,
      hr_in_zone_pct: 70,
      feedback_text: null,
    },
  },
]

export default function PostRunPreviewPage() {
  // Committed so the next person can use it, unreachable on www.zonna.run:
  // it renders invented run data, and an unlinked route is still a public one.
  // `NODE_ENV` is inlined at build time, so this is dead-stripped.
  if (process.env.NODE_ENV === 'production') notFound()

  return (
    <main style={{ background: 'var(--bg)', minHeight: '100vh', padding: '24px 16px 64px', fontFamily: 'var(--font-ui)' }}>
      <h1 style={{ fontSize: '18px', fontWeight: 800, color: 'var(--ink)', margin: '0 0 4px' }}>
        Post-run card
      </h1>
      <p style={{ fontSize: '13px', color: 'var(--mute)', margin: '0 0 24px', lineHeight: 1.5 }}>
        UX-POSTRUN-01 states. Fixture data, real component. Kit leads; the
        four-column score dashboard is replaced by one zone signal.
      </p>

      {CASES.map(c => (
        <section key={c.title} style={{ marginBottom: '36px' }}>
          <h2 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--ink)', margin: '0 0 4px' }}>
            {c.title}
          </h2>
          <p style={{ fontSize: '12px', color: 'var(--mute)', margin: '0 0 10px', lineHeight: 1.5 }}>
            {c.note}
          </p>
          <RunFeedbackCard analysis={c.analysis} paceTarget={c.paceTarget ?? null} driftContext={c.driftContext ?? null} />
        </section>
      ))}
    </main>
  )
}
