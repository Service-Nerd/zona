// CharityCohortCard — FIRSTRUN-MOMENTS-01f.
//
// The honest version of "you are not alone": ONE true fact, stated once. No
// feed, no leaderboard, no comparison — those are barred, and the SLT was
// explicit that a running counter is a leaderboard with extra steps.
//
// ⚠️ WHAT THIS DELIBERATELY DOES NOT SAY. The approved copy included "most of
// them have never done this either". Nothing in this app measures that, so it
// was cut rather than asserted — the claim/computation mismatch class that was
// retracted three times on the day this shipped. What is left is checkable
// against `charity_batches`: the partner's name, and the size of their cohort.
//
// The number is the batch CAP, not the redeemed count: the cap is how many
// places the charity has, it is fixed, and it does not turn the card into a
// counter that changes every time someone else signs up.
//
// PROVENANCE: database fact, not model output — no AIMark (AI-PROVENANCE-01).
// Same plain metric-led card family as RunwayRevealCard / FirstRunCard.

export interface CharityCohortCardProps {
  /** `charity_batches.partner_name`, e.g. "Make-A-Wish UK". */
  partnerName: string
  /** `charity_batches.cap` — the places the partner holds. */
  cohortSize: number
}

export default function CharityCohortCard({ partnerName, cohortSize }: CharityCohortCardProps) {
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
        You&rsquo;re not the only one
      </div>

      {/* The number leads, matching the rest of the reveal family. */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 'var(--space-2)', marginBottom: 'var(--space-3)', flexWrap: 'wrap' }}>
        <span style={{ fontFamily: 'var(--font-ui)', fontSize: '15px', fontWeight: 600, color: 'var(--mute)' }}>
          One of
        </span>
        <span style={{ fontFamily: 'var(--font-ui)', fontSize: '32px', fontWeight: 800, color: 'var(--ink)', letterSpacing: '-0.5px', lineHeight: 1 }}>
          {cohortSize}
        </span>
      </div>

      <div style={{ fontFamily: 'var(--font-ui)', fontSize: '14px', fontWeight: 400, color: 'var(--ink-2)', lineHeight: 1.6 }}>
        running this for {partnerName}. Same race, same plan, same starting line.
      </div>
    </div>
  )
}
