// PendingAdjustmentBanner — Zonna Phase 2 shared component
// Hero-level feature — this is the proof point for "the plan adapts to your life."
// Visual: warm amber banner, CoachByline eyebrow, action row with confirm + revert.
// API calls live in the parent. This component is pure UI.
// See docs/canonical/ui-patterns.md § PendingAdjustmentBanner.
//
// AI-VIS-01: replaced the "!" warning circle eyebrow with a CoachByline.
// Plan adjustments are coach advice (model output), not system alerts. The
// byline tells users this is an AI suggestion they can accept or revert.
//
// RESHAPE-FIX-WAVE2A: accepts optional sessions_before/sessions_after and
// renders a per-day before/after diff strip beneath the prose via the new
// `<AdjustmentDiff />` component. The 2026-06-26 incident root cause was
// a runner who could not see what Confirm would do — only AI prose that
// lied. Two-layer doctrine: prose handles WHY (AI, with byline), diff
// handles WHAT (rule-engine, no byline).

import CoachByline from './CoachByline'
import AdjustmentDiff from './AdjustmentDiff'
import type { SessionLike } from '@/lib/coaching/diff/sessionDiff'
import type { DistanceUnits } from '@/lib/format'

type Props = {
  /** Byline role line — default "PLAN ADJUSTED". Use coach voice (e.g. "MOVED YOUR TEMPO"). */
  title?: string
  /** Description of what changed */
  children: React.ReactNode
  /** Called when user taps Confirm. Omit for informational adjustments (e.g. fitness_signal) — hides the Confirm button. */
  onConfirm?: () => void
  /** Called when user taps Revert */
  onRevert: () => void
  /** Disable both actions while an API call is in flight */
  loading?: boolean
  /**
   * RESHAPE-FIX-WAVE2A — optional per-day diff payload. When both are
   * supplied AND there is at least one non-unchanged day, the diff strip
   * renders beneath the prose. Omit to retain the legacy prose-only
   * behaviour (informational adjustments, fitness_signal, etc.).
   */
  sessionsBefore?: ReadonlyArray<SessionLike | null | undefined>
  sessionsAfter?:  ReadonlyArray<SessionLike | null | undefined>
  /** User's preferred distance units, forwarded to the diff strip. Default 'km'. */
  units?: DistanceUnits
}

export default function PendingAdjustmentBanner({
  title = 'Plan adjusted',
  children,
  onConfirm,
  onRevert,
  loading = false,
  sessionsBefore,
  sessionsAfter,
  units = 'km',
}: Props) {
  const verticalPadding   = 14
  const horizontalPadding = 16

  return (
    <div
      style={{
        position:     'relative',
        background:   'var(--warn-bg)',
        borderRadius: '14px',
        padding:      `${verticalPadding}px ${horizontalPadding}px ${verticalPadding}px ${horizontalPadding + 8}px`,
      }}
    >
      {/* AI provenance left-rail */}
      <span
        aria-hidden="true"
        style={{
          position:     'absolute',
          left:         '8px',
          top:          `${verticalPadding}px`,
          bottom:       `${verticalPadding}px`,
          width:        '3px',
          borderRadius: '2px',
          background:   'var(--warn)',
        }}
      />

      {/* Byline eyebrow */}
      <div style={{ marginBottom: '10px' }}>
        <CoachByline color="warn" role={title} />
      </div>

      {/* Body — AI prose (WHY) */}
      <div
        style={{
          fontFamily: 'var(--font-ui)',
          fontSize:   '13px',
          fontWeight: 400,
          lineHeight: 1.55,
          color:      'var(--coach-ink)',
          marginBottom: '14px',
        }}
      >
        {children}
      </div>

      {/* RESHAPE-FIX-WAVE2A — Rule-engine diff (WHAT). No AIMark. */}
      {sessionsBefore && sessionsAfter && (
        <div style={{ marginBottom: '14px' }}>
          <AdjustmentDiff sessionsBefore={sessionsBefore} sessionsAfter={sessionsAfter} units={units} />
        </div>
      )}

      {/* Actions */}
      <div style={{ display: 'flex', gap: '8px' }}>
        {/* Primary — Confirm (hidden when onConfirm not provided, e.g. fitness_signal) */}
        {onConfirm && (
          <button
            onClick={onConfirm}
            disabled={loading}
            style={{
              flex:         1,
              padding:      '10px 0',
              background:   loading ? 'var(--warn-bg)' : 'var(--warn)',
              border:       'none',
              borderRadius: '100px',
              fontFamily:   'var(--font-ui)',
              fontSize:     '13px',
              fontWeight:   600,
              color:        'var(--card)',
              cursor:       loading ? 'default' : 'pointer',
              opacity:      loading ? 0.6 : 1,
              transition:   'opacity 0.15s',
            }}
          >
            {loading ? '…' : 'Confirm'}
          </button>
        )}

        {/* Ghost — Revert */}
        <button
          onClick={onRevert}
          disabled={loading}
          style={{
            flex:         1,
            padding:      '10px 0',
            background:   'transparent',
            border:       '1px solid rgba(61,38,0,0.2)',
            borderRadius: '100px',
            fontFamily:   'var(--font-ui)',
            fontSize:     '13px',
            fontWeight:   500,
            color:        'var(--coach-ink)',
            cursor:       loading ? 'default' : 'pointer',
            opacity:      loading ? 0.6 : 1,
            transition:   'opacity 0.15s',
          }}
        >
          Revert
        </button>
      </div>
    </div>
  )
}
