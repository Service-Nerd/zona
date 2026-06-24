// PendingHrCard — HR-SYNC-02
//
// Sibling of PendingAnalysisCard (DashboardClient.tsx). Sits at the front of
// the PostRunScreen morph chain (and TodayScreen post-run hero):
//
//   PendingHrCard → PendingAnalysisCard → RunFeedbackCard
//
// Structurally mirrors PendingAnalysisCard (moss left-rail, card, copy line,
// skeleton metric row) so the morph between them is sub-perceptual — the
// surface "is just working".
//
// Differences from PendingAnalysisCard:
//   - No CoachByline. This is rule-engine state (we're waiting on Apple
//     sync), not AI provenance. Eyebrow label "HEART RATE" + pulsing dot
//     replaces the byline.
//   - Skeleton columns name what's actually waiting on HR (HR / ZONE /
//     DRIFT) rather than the full analysis metrics. Distance + pace are
//     already known from the workout shell.
//
// See HR-SYNC-02 spec in docs/releases/backlog.md and ui-patterns.md § 15
// (Loading State).

'use client'

import HrPendingStatusRow, { type HrPendingState } from './HrPendingStatusRow'

interface Props {
  state:        HrPendingState
  /** Required when state='fallback'. Caller wires to syncOnAppOpen() via the throttled wrapper. */
  onRetry?:     () => void | Promise<void>
  isRetrying?:  boolean
}

const SKELETON_LABELS = ['HR', 'Zone', 'Drift']

export default function PendingHrCard({ state, onRetry, isRetrying = false }: Props) {
  return (
    <div
      style={{
        position:     'relative',
        marginTop:    '12px',
        background:   'var(--card)',
        borderRadius: '14px',
        border:       '1px solid var(--line)',
        padding:      '14px 16px 14px 22px',
        animation:    'zonna-fade-in 200ms ease-out',
      }}
    >
      {/* Moss left-rail — identical to PendingAnalysisCard. */}
      <span aria-hidden="true" style={{
        position: 'absolute', left: '8px', top: '14px', bottom: '14px',
        width: '3px', borderRadius: '2px', background: 'var(--moss)',
      }} />

      {/* Eyebrow label + pulsing-dot status row (left/right split). */}
      <div style={{
        display:        'flex',
        alignItems:     'center',
        justifyContent: 'space-between',
        marginBottom:   '10px',
        gap:            '12px',
      }}>
        <span style={{
          fontFamily:    'var(--font-ui)',
          fontSize:      '10px',
          fontWeight:    700,
          color:         'var(--mute)',
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
        }}>
          Heart rate
        </span>
        <HrPendingStatusRow state={state} onRetry={onRetry} isRetrying={isRetrying} size="sm" />
      </div>

      {/* Skeleton metric row — hints at what's waiting. Three columns rather
       *  than PendingAnalysisCard's four: distance + pace are already known
       *  from the workout shell, only HR-derived metrics are missing. */}
      <div style={{ display: 'flex', gap: '10px' }}>
        {SKELETON_LABELS.map(label => (
          <div key={label} style={{ flex: 1 }}>
            <div style={{
              fontFamily:    'var(--font-ui)',
              fontSize:      '9px',
              fontWeight:    700,
              color:         'var(--mute)',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              marginBottom:  '6px',
            }}>{label}</div>
            <div style={{
              height:       '3px',
              background:   'var(--line)',
              borderRadius: '2px',
              animation:    'ai-mark-pulse 1.6s ease-in-out infinite',
            }} />
          </div>
        ))}
      </div>
    </div>
  )
}
