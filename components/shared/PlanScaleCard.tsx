// PlanScaleCard — FIRSTRUN-MOMENTS-01d + 01e.
//
// The third beat of the reveal, after 01a ("you're eleven weeks early") and 01b
// ("here's where it starts"): the honest size of the thing. Two facts, one job —
// SCALE — which is why they are one card and not two. A fourth card on this
// screen would be card soup, and ui-patterns' "one job per surface" cuts the
// other way here: total and ceiling answer the same question.
//
// PROVENANCE: rule-engine arithmetic, not model output, so NO AIMark /
// CoachByline / moss AI-rail (AI-PROVENANCE-01). Same plain metric-led card
// family as RunwayRevealCard and FirstRunCard.
//
// Content is computed by lib/plan/planScale.ts, which derives LIVE on every
// render — Hutchinson's binding condition, because the hardest-run line is a
// promise about a plan that can reshape.

import type { PlanScale } from '@/lib/plan/planScale'

export default function PlanScaleCard({
  totalDistance, raceDistance, hardestRun, hardestMonth,
}: PlanScale) {
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
        The shape of it
      </div>

      {/* The number leads — bold metric, quiet context (design system), matching
          RunwayRevealCard's treatment so the reveal reads as one family. The
          first cut set "About 780km" all at one weight and the value did not
          dominate, which is the rule ui-patterns states and the sibling card
          already demonstrated. */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '7px', marginBottom: '10px', flexWrap: 'wrap' }}>
        <span style={{ fontFamily: 'var(--font-ui)', fontSize: '15px', fontWeight: 600, color: 'var(--mute)' }}>
          About
        </span>
        <span style={{ fontFamily: 'var(--font-ui)', fontSize: '32px', fontWeight: 800, color: 'var(--ink)', letterSpacing: '-0.5px', lineHeight: 1 }}>
          {totalDistance}
        </span>
      </div>

      <div style={{ fontFamily: 'var(--font-ui)', fontSize: '14px', fontWeight: 400, color: 'var(--ink-2)', lineHeight: 1.6 }}>
        between now and race day. The race itself is {raceDistance} of it.
      </div>

      {/* Dread lives in the unknown, so the worst day gets a number. Omitted
          entirely when the plan has no long run to name — never a half-sentence. */}
      {hardestRun && (
        <div style={{ fontFamily: 'var(--font-ui)', fontSize: '13px', fontWeight: 400, color: 'var(--mute)', lineHeight: 1.6, marginTop: '10px' }}>
          The longest single run is {hardestRun}
          {hardestMonth ? `, once, in ${hardestMonth}.` : ', once.'}
        </div>
      )}
    </div>
  )
}
