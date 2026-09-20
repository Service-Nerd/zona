// LOCAL DESIGN HARNESS — 404s in production, not linked, not in the sitemap.
// Same pattern as /me-preview, /onboarding-preview, /refusal-preview.
//
// WHY. P-04's block sits on the Plan screen, behind auth and behind a live
// plan with analysed runs, and the states that matter most are the ones a
// healthy test account never produces: a week with no heart rate at all, a
// week where nothing held, and the free-tier lock. Renders the REAL component
// with real output from `lib/coaching/zoneWeekStatement.ts`.

'use client'

import { notFound } from 'next/navigation'
import ZoneWeekBlock from '@/components/shared/ZoneWeekBlock'
import type { RunZoneOutcome } from '@/lib/coaching/zoneWeekStatement'

const runs = (held: number, drifted: number, unknown: number): RunZoneOutcome[] => [
  ...Array<RunZoneOutcome>(held).fill('held'),
  ...Array<RunZoneOutcome>(drifted).fill('drifted'),
  ...Array<RunZoneOutcome>(unknown).fill('unknown'),
]

const CASES: { title: string; note: string; outcomes: RunZoneOutcome[]; locked?: boolean }[] = [
  { title: '3 held, 1 drifted', note: 'The canonical sentence. Count, not percentage. Plain verb. Names the exception.', outcomes: runs(3, 1, 0) },
  { title: 'All held', note: 'Moss rail. No celebration: the voice table bars cheerleading.', outcomes: runs(4, 0, 0) },
  { title: 'None held', note: '⚠️ The sentence a struggling runner reads. Narrowed to the runs and points at the next one. NO cause (we do not have one) and NO action (the plan does not change for one week). If this ever opens with a number, the zero-case bug is back.', outcomes: runs(0, 4, 0) },
  { title: '2 measured, 2 with no heart rate', note: '⚠️ The denominator is runs we MEASURED. "2 of 4" would be false. The gap is named on its own line.', outcomes: runs(2, 0, 2) },
  { title: 'Below the verdict threshold', note: 'Two runs: the count, and nothing inferred from it. The block does NOT hide, because a minimum of three would have hidden it on 57.1% of measured runner-weeks.', outcomes: runs(2, 0, 0) },
  { title: 'No heart rate at all', note: 'The most common week for anyone without a strap. Reports the missing data rather than rendering nothing.', outcomes: runs(0, 0, 3) },
  { title: 'No runs logged yet', note: 'Start of the week.', outcomes: runs(0, 0, 0) },
  { title: 'Free tier (locked)', note: 'Run analysis is activity_intelligence (PAID). Names what the score is and what unlocks it, following RestraintCard. Gate richness, never access.', outcomes: runs(3, 1, 0), locked: true },
]

export default function ZoneBlockPreviewPage() {
  if (process.env.NODE_ENV === 'production') notFound()

  return (
    <main style={{ background: 'var(--bg)', minHeight: '100vh', padding: '28px 16px 64px', fontFamily: 'var(--font-ui)' }}>
      <h1 style={{ fontFamily: 'var(--font-brand)', fontSize: '20px', fontWeight: 700, color: 'var(--ink)', margin: '0 0 6px' }}>
        Zone compliance block
      </h1>
      <p style={{ fontFamily: 'var(--font-ui)', fontSize: '13px', color: 'var(--mute)', lineHeight: 1.55, margin: '0 0 32px' }}>
        P-04. Every sentence below is real output from the statement module, not a placeholder.
      </p>
      {CASES.map(c => (
        <section key={c.title} style={{ marginBottom: '32px' }}>
          <h2 style={{ fontFamily: 'var(--font-ui)', fontSize: '13px', fontWeight: 700, color: 'var(--ink)', margin: '0 0 4px' }}>{c.title}</h2>
          <p style={{ fontFamily: 'var(--font-ui)', fontSize: '12px', color: 'var(--mute)', lineHeight: 1.5, margin: '0 0 12px' }}>{c.note}</p>
          <ZoneWeekBlock outcomes={c.outcomes} locked={c.locked} />
        </section>
      ))}
    </main>
  )
}
