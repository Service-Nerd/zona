// PullToRefresh — the dashboard's manual refresh gesture (PTR-01).
//
// Wraps the single dashboard scroll container. When the user drags down from
// the very top, it reveals a neutral moss-dot indicator; past the threshold it
// arms; on release it runs `onRefresh` (a HealthKit sync + re-fetch) and holds
// the dot in a gentle pulse until the work settles.
//
// Design rules (docs/canonical/ui-patterns.md §30):
//   - No spinner. The dot PULSES (zonna-ptr-pulse) — the sanctioned substitute.
//   - NOT the AIMark sparkle. A data refresh is not model output, so it must
//     not borrow the AI-provenance glyph.
//   - Completion copy is calm and always-true ("Up to date.") — the gesture
//     teaches restraint, it does not manufacture novelty.
//   - Colours/tokens only via CSS custom properties. No hardcoded hex.
//
// Ownership: the caller passes its existing scroll ref so other code that
// reads the same element (scroll-to-top on screen change) keeps working.

import React, { useCallback, useEffect, useRef, useState } from 'react'

/** Finger travel (px, after resistance) required to arm a refresh. */
const THRESHOLD = 72
/** Resistance ceiling — the dot never pulls further than this. */
const MAX_PULL = 104
/** Fraction of raw finger travel that becomes pull distance (rubber feel). */
const RESISTANCE = 0.5
/** How long the "Up to date." / error line lingers before collapse (ms). */
const DONE_HOLD_MS = 750

type Status = 'idle' | 'pulling' | 'armed' | 'refreshing' | 'done' | 'error'

export interface PullToRefreshProps {
  /** The scroll element's ref — owned by the caller, set on this component's div. */
  scrollRef: React.RefObject<HTMLDivElement>
  /** Runs the refresh. Resolve = success ("Up to date."); throw = error. */
  onRefresh: () => Promise<void>
  /** Reserve space for the fixed bottom nav (px). */
  paddingBottom: number
  /** Suppress the gesture entirely (e.g. during onboarding, before appReady). */
  disabled?: boolean
  children: React.ReactNode
}

export default function PullToRefresh({
  scrollRef,
  onRefresh,
  paddingBottom,
  disabled = false,
  children,
}: PullToRefreshProps) {
  const [pull, setPull] = useState(0)
  const [status, setStatus] = useState<Status>('idle')

  // Mirror gesture bookkeeping in refs so the non-passive touchmove listener
  // (added once) never reads stale state.
  const startYRef = useRef(0)
  const startXRef = useRef(0)
  const activeRef = useRef(false)      // finger down + engaged from the top
  const decidedRef = useRef(false)     // axis lock resolved for this drag
  const pullRef = useRef(0)
  const statusRef = useRef<Status>('idle')
  const disabledRef = useRef(disabled)

  useEffect(() => { disabledRef.current = disabled }, [disabled])
  useEffect(() => { statusRef.current = status }, [status])

  const settle = useCallback((next: number, nextStatus: Status) => {
    pullRef.current = next
    setPull(next)
    statusRef.current = nextStatus
    setStatus(nextStatus)
  }, [])

  const runRefresh = useCallback(async () => {
    settle(THRESHOLD, 'refreshing')
    try {
      await onRefresh()
      settle(THRESHOLD, 'done')
    } catch {
      settle(THRESHOLD, 'error')
    }
    window.setTimeout(() => {
      settle(0, 'idle')
    }, DONE_HOLD_MS)
  }, [onRefresh, settle])

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    if (disabledRef.current) return
    if (statusRef.current === 'refreshing' || statusRef.current === 'done' || statusRef.current === 'error') return
    const el = scrollRef.current
    if (!el || el.scrollTop > 0) return
    if (e.touches.length !== 1) return
    startYRef.current = e.touches[0].clientY
    startXRef.current = e.touches[0].clientX
    activeRef.current = true
    decidedRef.current = false
  }, [scrollRef])

  const endDrag = useCallback(() => {
    if (!activeRef.current) return
    activeRef.current = false
    if (statusRef.current === 'armed') {
      void runRefresh()
    } else if (statusRef.current === 'pulling') {
      settle(0, 'idle')
    }
  }, [runRefresh, settle])

  // touchmove must be non-passive so we can preventDefault while pulling. React's
  // synthetic onTouchMove is passive on iOS, so bind natively to the element.
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return

    const handleMove = (e: TouchEvent) => {
      if (!activeRef.current) return
      if (el.scrollTop > 0) { // user scrolled away from the top mid-drag
        activeRef.current = false
        if (statusRef.current === 'pulling') settle(0, 'idle')
        return
      }
      const dy = e.touches[0].clientY - startYRef.current
      const dx = e.touches[0].clientX - startXRef.current

      // Axis lock on first meaningful movement: a horizontal intent (week
      // strip) or an upward drag releases the gesture.
      if (!decidedRef.current) {
        if (Math.abs(dx) > Math.abs(dy) || dy <= 0) {
          if (Math.abs(dx) > 6 || Math.abs(dy) > 6) { activeRef.current = false; return }
          return // too small to decide yet
        }
        decidedRef.current = true
      }

      if (dy <= 0) { settle(0, 'idle'); return }
      e.preventDefault()
      const next = Math.min(dy * RESISTANCE, MAX_PULL)
      pullRef.current = next
      setPull(next)
      const nextStatus: Status = next >= THRESHOLD ? 'armed' : 'pulling'
      if (statusRef.current !== nextStatus) { statusRef.current = nextStatus; setStatus(nextStatus) }
    }

    el.addEventListener('touchmove', handleMove, { passive: false })
    return () => el.removeEventListener('touchmove', handleMove)
  }, [scrollRef, settle])

  const active = status === 'pulling' || status === 'armed'
  const progress = Math.min(pull / THRESHOLD, 1)
  const working = status === 'refreshing'
  const reduceMotion =
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

  const statusText =
    status === 'done' ? 'Up to date.'
    : status === 'error' ? "Couldn't refresh."
    : null

  return (
    <div
      ref={scrollRef}
      onTouchStart={onTouchStart}
      onTouchEnd={endDrag}
      onTouchCancel={endDrag}
      style={{
        flex: 1,
        overflowY: 'auto',
        paddingBottom: `${paddingBottom}px`,
        overscrollBehavior: 'none',
        position: 'relative',
      }}
    >
      {/* Indicator zone — occupies exactly the revealed gap above the content. */}
      <div
        aria-hidden={statusText == null}
        role={statusText ? 'status' : undefined}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: `${Math.max(pull, 0)}px`,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '6px',
          pointerEvents: 'none',
          overflow: 'hidden',
        }}
      >
        <span
          style={{
            width: '9px',
            height: '9px',
            borderRadius: '50%',
            background: 'var(--moss)',
            opacity: working ? 1 : 0.35 + progress * 0.65,
            transform: working ? undefined : `scale(${0.7 + progress * 0.4})`,
            animation: working && !reduceMotion ? 'zonna-ptr-pulse 1.1s ease-in-out infinite' : undefined,
          }}
        />
        {statusText && (
          <span
            style={{
              fontFamily: 'var(--font-ui)',
              fontSize: '0.75rem',
              fontWeight: 500,
              color: 'var(--mute)',
            }}
          >
            {statusText}
          </span>
        )}
      </div>

      <div
        style={{
          transform: `translateY(${pull}px)`,
          transition: active ? 'none' : 'transform 0.28s cubic-bezier(0.22, 1, 0.36, 1)',
          willChange: 'transform',
        }}
      >
        {children}
      </div>
    </div>
  )
}
