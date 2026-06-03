// PlanIntroCard — CA-01, the free-tier "why this plan" coach intro.
//
// Renders Kit's one-line plan intro (meta.plan_intro), generated once on a free
// user's first plan. The single AI voice surface a free user gets — the fix for
// the silent "wedge moment". Carries provenance via CoachByline (anchored
// AIMark sparkle) + the canonical 3px moss left rail.
//
// Visual language: slim variant of the Plan Voice Card (ui-patterns.md §24 /
// §24b). Same moss-rail + --card treatment as the "This week" card so the two
// read as one coaching surface family.
//
// Provenance honesty: only ever render this with genuine model output
// (meta.plan_intro). Never pass rule-engine or hand-authored copy here.

import CoachByline from './CoachByline'

interface PlanIntroCardProps {
  /** The model-generated intro line (meta.plan_intro). */
  text: string
  /** Optional — makes the byline tappable (e.g. to the Coach/Upgrade surface). */
  onBylineClick?: () => void
}

export default function PlanIntroCard({ text, onBylineClick }: PlanIntroCardProps) {
  return (
    <div
      style={{
        position:     'relative',
        background:   'var(--card)',
        border:       '1px solid var(--line)',
        borderRadius: 'var(--radius-lg)',
        padding:      '14px 16px 14px 19px',
        overflow:     'hidden',
      }}
    >
      {/* Canonical AI-card moss left rail (Pattern 16b) */}
      <span
        aria-hidden="true"
        style={{
          position:     'absolute',
          left:         '8px',
          top:          '14px',
          bottom:       '14px',
          width:        '3px',
          borderRadius: '2px',
          background:   'var(--moss)',
        }}
      />

      <div style={{ marginBottom: '8px' }}>
        <CoachByline color="moss" role="Why this plan" onClick={onBylineClick} />
      </div>

      <div
        style={{
          fontFamily:    'var(--font-ui)',
          fontSize:      '14px',
          fontWeight:    400,
          color:         'var(--ink-2)',
          lineHeight:    1.6,
          letterSpacing: '-0.005em',
        }}
      >
        {text}
      </div>
    </div>
  )
}
