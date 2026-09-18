// FirstRunCard — FIRSTRUN-MOMENTS-01b.
//
// Shows the one concrete first session at the plan reveal, ahead of the wall of
// weeks: "Monday. 20 min. Easy." Rule-engine data (day/duration/effort), so NO
// AIMark / coach byline (AI-PROVENANCE-01). Plain metric-led card in the reveal
// card family. Content is computed by lib/plan/firstRun.ts (firstRunOfPlan).

import type { FirstRun } from '@/lib/plan/firstRun'

export default function FirstRunCard({ dayLabel, metric, effort }: FirstRun) {
  return (
    <div
      style={{
        background:   'var(--card)',
        border:       '1px solid var(--line)',
        borderRadius: 'var(--radius-lg)',
        boxShadow:    'var(--shadow-card)',
        padding:      '16px 18px',
      }}
    >
      <div
        style={{
          fontFamily:    'var(--font-ui)',
          fontSize:      '10px',
          fontWeight:    700,
          letterSpacing: '0.14em',
          textTransform: 'uppercase',
          color:         'var(--moss)',
          marginBottom:  '8px',
        }}
      >
        First up
      </div>

      {/* One line the runner can picture doing: day, how long, how hard. */}
      <div style={{ fontFamily: 'var(--font-ui)', fontSize: '19px', fontWeight: 800, color: 'var(--ink)', letterSpacing: '-0.3px', lineHeight: 1.3 }}>
        {dayLabel}. {metric}. {effort}.
      </div>

      <div style={{ fontFamily: 'var(--font-ui)', fontSize: '14px', fontWeight: 400, color: 'var(--ink-2)', lineHeight: 1.6, marginTop: '8px' }}>
        This is where it starts. Nothing here you can&rsquo;t do.
      </div>
    </div>
  )
}
