// RunwayRevealCard — FIRSTRUN-MOMENTS-01a.
//
// The uncovered-runway note (meta.uncovered_runway_note) is ratified, brand-voiced
// copy written by the RULE ENGINE (foundationCompose.ts) — and until now it was
// stamped onto every long-runway plan's meta and required by an invariant, yet
// RENDERED NOWHERE. This surfaces it at the one moment it lands hardest: the plan
// reveal, led by the number. For a London 2027 first-timer it says "you are eleven
// weeks early", and the emotion is relief — nobody else is selling that (SLT).
//
// PROVENANCE: this is rule-engine copy, NOT a model output, so it carries NO
// AIMark / CoachByline / moss AI-rail (AI-PROVENANCE-01 — never mark hand-authored
// or rule-engine copy as AI). It is a plain metric-led card.

interface RunwayRevealCardProps {
  /** meta.uncovered_runway_weeks — the weeks before the plan (or its foundation
   *  block) begins. The engine only stamps the note at or above the threshold, so
   *  a card is only rendered when the note is present. */
  weeks: number
  /** meta.uncovered_runway_note — the ratified reassurance copy. */
  note: string
}

export default function RunwayRevealCard({ weeks, note }: RunwayRevealCardProps) {
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
      {/* Eyebrow — calm, positive; --moss because this is good news, not a warning. */}
      <div
        style={{
          fontFamily:     'var(--font-ui)',
          fontSize:       '10px',
          fontWeight:     700,
          letterSpacing:  '0.14em',
          textTransform:  'uppercase',
          color:          'var(--moss)',
          marginBottom:   '6px',
        }}
      >
        You&rsquo;re early
      </div>

      {/* The number leads — bold metric, quiet context (design system). */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 'var(--space-2)', marginBottom: 'var(--space-3)' }}>
        <span style={{ fontFamily: 'var(--font-ui)', fontSize: '32px', fontWeight: 800, color: 'var(--ink)', letterSpacing: '-0.5px', lineHeight: 1 }}>
          {weeks}
        </span>
        <span style={{ fontFamily: 'var(--font-ui)', fontSize: '15px', fontWeight: 600, color: 'var(--ink-2)' }}>
          {weeks === 1 ? 'week early' : 'weeks early'}
        </span>
      </div>

      <div style={{ fontFamily: 'var(--font-ui)', fontSize: '14px', fontWeight: 400, color: 'var(--ink-2)', lineHeight: 1.6 }}>
        {note}
      </div>
    </div>
  )
}
