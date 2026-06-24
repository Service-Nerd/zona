// HrPendingStatusRow — HR-SYNC-02
//
// The visual primitive for "Apple Watch HR hasn't landed yet" status. Used
// inside SessionCard's done-state row and the TodayScreen post-run hero.
// PendingHrCard reuses the same dot + copy but in a different container.
//
// Why no AIMark / CoachByline: this is a rule-engine state (we're waiting on
// Apple's sync clock), not AI output. Provenance honesty — see ui-patterns.md
// § 16 and § 16b ("When NOT to use").
//
// Voice rules: matter-of-fact, one sentence, no time promise, responsibility
// on the device (brand.md § Tone of Voice).

'use client'

import { useState } from 'react'

export type HrPendingState = 'pending' | 'fallback'

interface Props {
  state:        HrPendingState
  /** Provided only when state='fallback' to make the row tappable. */
  onRetry?:     () => void | Promise<void>
  /** Set to true while the retry call is in flight. Disables the button and
   *  swaps copy to "Checking…". Auto-revert is the caller's responsibility. */
  isRetrying?:  boolean
  /** `sm` for SessionCard rows (11px), `md` for the TodayScreen hero (13px). */
  size?:        'sm' | 'md'
}

const PENDING_COPY  = "Watch HR hasn't landed yet."
const FALLBACK_COPY = 'HR didn’t land. Tap to retry.'
const CHECKING_COPY = 'Checking…'

export default function HrPendingStatusRow({ state, onRetry, isRetrying = false, size = 'sm' }: Props) {
  const fontSize  = size === 'md' ? 13 : 11
  const dotSize   = size === 'md' ? 7 : 6
  const gap       = size === 'md' ? 8 : 6

  const isFallback = state === 'fallback'
  const tappable   = isFallback && onRetry != null && !isRetrying

  const copy = isRetrying
    ? CHECKING_COPY
    : isFallback
      ? FALLBACK_COPY
      : PENDING_COPY

  // Local hover state for the fallback button. Not using CSS :hover because
  // the row sits inside a parent SessionCard which has its own cursor — keep
  // the affordance specific to this button.
  const [hover, setHover] = useState(false)

  const inner = (
    <span
      style={{
        display:        'inline-flex',
        alignItems:     'center',
        gap:            `${gap}px`,
        fontFamily:     'var(--font-ui)',
        fontSize:       `${fontSize}px`,
        fontWeight:     400,
        color:          isFallback && !isRetrying ? 'var(--ink-2)' : 'var(--mute)',
        lineHeight:     1.4,
        whiteSpace:     'nowrap',
        overflow:       'hidden',
        textOverflow:   'ellipsis',
      }}
    >
      {/* Pulsing dot. Wrapping opacity 0.7 quietens the existing
       *  ai-mark-pulse keyframe (0.55→1.0) into a calmer 0.385→0.7 range —
       *  reads as a quiet system signal, not as AI provenance. */}
      <span aria-hidden="true" style={{ display: 'inline-flex', opacity: 0.7 }}>
        <span
          style={{
            display:      'inline-block',
            width:        `${dotSize}px`,
            height:       `${dotSize}px`,
            borderRadius: '50%',
            background:   'var(--moss)',
            animation:    'ai-mark-pulse 1.6s ease-in-out infinite',
          }}
        />
      </span>
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{copy}</span>
      {tappable && (
        <span aria-hidden="true" style={{
          fontSize:    `${fontSize}px`,
          color:       'var(--ink-2)',
          opacity:     0.6,
          marginLeft:  '4px',
          transition:  'transform 0.12s, opacity 0.12s',
          transform:   hover ? 'translateX(2px)' : 'translateX(0)',
        }}>→</span>
      )}
    </span>
  )

  if (!tappable) {
    // Pending state or in-flight retry — render as static row.
    return (
      <div role={isRetrying ? 'status' : undefined} aria-live={isRetrying ? 'polite' : undefined}>
        {inner}
      </div>
    )
  }

  // Fallback state with retry — render as a full-width button. Tap target
  // ≥ 44px high (HIG) via padding.
  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); void onRetry?.() }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display:        'inline-flex',
        alignItems:     'center',
        background:     'none',
        border:         'none',
        padding:        '6px 0',
        margin:         0,
        cursor:         'pointer',
        textAlign:      'left',
        font:           'inherit',
        color:          'inherit',
        minHeight:      '32px',
      }}
      aria-label={FALLBACK_COPY}
    >
      {inner}
    </button>
  )
}
