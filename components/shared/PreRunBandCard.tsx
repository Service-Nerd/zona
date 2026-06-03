// PreRunBandCard — R25 Cut #2, Today screen pre-run context band.
//
// Shows past-self stats for similar-distance runs before today's session —
// "Your last N similar easy runs: 147 bpm avg · 88% in zone."
// Formula-derived only: no AIMark, no CoachByline (provenance honesty).
//
// Deliberately compact — sits above the session card as a quiet context strip,
// not a competing surface. Uses --bg-soft (inset / informational) rather than
// --card so it reads as secondary to the session card beneath it.
//
// States:
//   live     — cohort data available, ≥ 3 similar runs
//   skeleton — loading shimmer while fetch is in flight
// Pending (not enough runs): parent renders nothing — no empty-state clutter.
//
// See ui-patterns.md §30 (PreRunBandCard).

interface CohortSummary {
  cohortSize: number
  avgHr: number | null
  avgInZonePct: number | null
  medianDistanceKm: number
}

type PreRunBandCardProps =
  | { state: 'live'; cohort: CohortSummary; sessionType: string }
  | { state: 'skeleton' }

/** Friendly session noun for display, e.g. "easy run", "long run". */
function sessionNoun(type: string): string {
  switch (type) {
    case 'easy':      return 'easy run'
    case 'long':      return 'long run'
    case 'quality':
    case 'tempo':     return 'tempo run'
    case 'intervals': return 'interval session'
    case 'recovery':  return 'recovery run'
    default:          return 'run'
  }
}

export default function PreRunBandCard(props: PreRunBandCardProps) {
  if (props.state === 'skeleton') {
    return (
      <div style={{
        background:   'var(--bg-soft)',
        borderRadius: 'var(--radius-md)',
        padding:      '10px 14px',
        marginBottom: '10px',
      }}>
        <div style={{ height: '9px', width: '55%', background: 'var(--line)', borderRadius: '3px', marginBottom: '8px', opacity: 0.6 }} />
        <div style={{ height: '13px', width: '72%', background: 'var(--line)', borderRadius: '3px', opacity: 0.4 }} />
      </div>
    )
  }

  const { cohort, sessionType } = props
  const noun = sessionNoun(sessionType)

  // Build the stats string — only include fields we have data for.
  const parts: string[] = []
  if (cohort.avgHr != null)       parts.push(`${Math.round(cohort.avgHr)} bpm avg`)
  if (cohort.avgInZonePct != null) parts.push(`${Math.round(cohort.avgInZonePct)}% in zone`)

  // If we somehow have no usable stats, don't render.
  if (!parts.length) return null

  return (
    <div style={{
      background:   'var(--bg-soft)',
      borderRadius: 'var(--radius-md)',
      padding:      '10px 14px',
      marginBottom: '10px',
    }}>
      <div style={{
        fontFamily:    'var(--font-ui)',
        fontSize:      '10px',
        fontWeight:    700,
        color:         'var(--mute)',
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
        marginBottom:  '4px',
      }}>
        Last {cohort.cohortSize} similar {noun}{cohort.cohortSize !== 1 ? 's' : ''}
      </div>
      <div style={{
        fontFamily: 'var(--font-ui)',
        fontSize:   '13px',
        fontWeight: 400,
        color:      'var(--ink-2)',
        lineHeight: 1.4,
      }}>
        {parts.join(' · ')}
      </div>
    </div>
  )
}
