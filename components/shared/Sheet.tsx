// Sheet — the single slide-up sheet primitive (SHEET-PRESENT-01, 2026-09-13).
//
// Every secondary surface in the app (zone explainers, the Coach stat sheets,
// the trend explainer, the missed-session prompt, manual logging, the race
// result form) arrives the same way through this one component. Before it, seven
// hand-rolled copies each invented their own z-index, animation and nav
// clearance; five of seven sat BELOW the bottom nav, so the panel opened but the
// runner could not see its content or its close bar without scrolling the parent
// screen. Founder-reported on device.
//
// What this owns, so no caller re-invents it:
//   • Portal to document.body — the sheet escapes the app's scrolling content
//     container entirely. That is deliberate: the shell locks <body> and scrolls
//     an inner div, and WKWebView mispositions position:fixed descendants of a
//     scrolling container. Rendered at the body, the sheet is truly viewport-
//     anchored.
//   • One z-index (Z_LAYERS.sheet) that is above the nav BY CONSTRUCTION.
//   • Resting on the nav's top edge — the overlay reserves the measured nav
//     height as paddingBottom, so the panel's bottom (and its sticky close bar)
//     land exactly on the nav, never under or over it. The founder's rule —
//     "come up from the nav bar but not overlay it" — is a property of the
//     primitive, and it tracks the nav automatically (NAV-SPACE-01 and beyond).
//   • Enter + exit animation, backdrop + Escape dismissal, body-scroll lock,
//     and focus handling (focus the panel on open, trap Tab within it, restore
//     on close).
//
// Presentation contract lives in docs/canonical/ui-patterns.md § Slide-up Sheet.

'use client'

import { createContext, useContext, useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Z_LAYERS } from '@/lib/ui/zLayers'

// ── Nav height ─────────────────────────────────────────────────────────────
// The bottom nav measures itself (ResizeObserver in DashboardClient) and
// publishes the height here so any sheet, wherever it is declared in the tree,
// can rest on the nav's top edge. Null while the nav is unmounted (first-time
// onboarding) or before first measure; sheets fall back to a sane default.

const NavHeightContext = createContext<number | null>(null)

export function NavHeightProvider({ value, children }: { value: number | null; children: React.ReactNode }) {
  return <NavHeightContext.Provider value={value}>{children}</NavHeightContext.Provider>
}

export function useNavHeight(): number | null {
  return useContext(NavHeightContext)
}

const NAV_FALLBACK_PX = 64
const EXIT_MS = 280

const prefersReducedMotion = () =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches

interface SheetProps {
  /** Called once the exit animation has finished — unmount the sheet here. */
  onClose: () => void
  /** Sheet body: everything below the drag pill (header, content, sticky
   *  footer). Pass a function to receive an animated `close()` for internal
   *  dismiss affordances (a bottom Close button, a ✕, a "Got it"). */
  children: React.ReactNode | ((close: () => void) => React.ReactNode)
  /** Panel max width. Default 480 (the app's phone column). */
  maxWidth?: number
  /** Panel max height as a percentage of the viewport, before the nav is
   *  subtracted. Default 88. */
  maxHeightVh?: number
  /** Accessible label for the dialog. */
  ariaLabel?: string
}

export default function Sheet({ onClose, children, maxWidth = 480, maxHeightVh = 88, ariaLabel }: SheetProps) {
  const navHeight = useNavHeight()
  const navH = navHeight ?? NAV_FALLBACK_PX

  const [mounted, setMounted] = useState(false)
  const [shown, setShown] = useState(false)
  const reduce = useRef(false)

  const panelRef = useRef<HTMLDivElement>(null)
  const prevFocusRef = useRef<Element | null>(null)
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose
  const closingRef = useRef(false)

  // Animated dismiss: play the exit, then hand control back to the caller.
  const close = useCallback(() => {
    if (closingRef.current) return
    closingRef.current = true
    if (reduce.current) { onCloseRef.current(); return }
    setShown(false)
    window.setTimeout(() => onCloseRef.current(), EXIT_MS)
  }, [])

  // Mount → portal target exists → run the enter animation on the next frame.
  useEffect(() => {
    reduce.current = prefersReducedMotion()
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!mounted) return
    if (reduce.current) { setShown(true); return }
    const r = requestAnimationFrame(() => setShown(true))
    return () => cancelAnimationFrame(r)
  }, [mounted])

  // Escape to dismiss, body-scroll lock, focus capture + restore. One effect so
  // teardown is symmetric.
  useEffect(() => {
    if (!mounted) return
    prevFocusRef.current = document.activeElement

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.stopPropagation(); close(); return }
      if (e.key === 'Tab') trapTab(e, panelRef.current)
    }
    window.addEventListener('keydown', onKey, true)

    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    return () => {
      window.removeEventListener('keydown', onKey, true)
      document.body.style.overflow = prevOverflow
      const prev = prevFocusRef.current
      if (prev instanceof HTMLElement) prev.focus()
    }
  }, [mounted, close])

  // Move focus into the panel once it is on screen.
  useEffect(() => {
    if (shown) panelRef.current?.focus()
  }, [shown])

  if (!mounted || typeof document === 'undefined') return null

  const transition = reduce.current ? 'none' : undefined

  return createPortal(
    <div
      onClick={close}
      role="dialog"
      aria-modal="true"
      aria-label={ariaLabel}
      style={{
        position: 'fixed', inset: 0, zIndex: Z_LAYERS.sheet,
        background: 'rgba(26,26,26,0.4)',
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
        // Rest on the nav's top edge: reserve the measured nav height so the
        // flex-end panel bottom lands exactly on the nav, never under it.
        paddingBottom: `${navH}px`,
        boxSizing: 'border-box',
        opacity: shown ? 1 : 0,
        transition: transition ?? 'opacity 0.2s ease-out',
      }}
    >
      <div
        ref={panelRef}
        tabIndex={-1}
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: `${maxWidth}px`,
          background: 'var(--card)',
          borderRadius: '20px 20px 0 0',
          boxShadow: '0 -8px 24px rgba(0,0,0,0.12)',
          paddingTop: '8px',
          maxHeight: `min(${maxHeightVh}vh, calc(100vh - ${navH}px - 24px))`,
          overflowY: 'auto',
          WebkitOverflowScrolling: 'touch',
          outline: 'none',
          transform: shown ? 'translateY(0)' : 'translateY(100%)',
          transition: transition ?? 'transform 0.28s cubic-bezier(0.32, 0.72, 0, 1)',
        }}
      >
        {/* Drag pill — the only chrome the primitive draws for you. */}
        <div style={{ width: '36px', height: '4px', background: 'var(--line)', borderRadius: '2px', margin: '6px auto 18px' }} />
        {typeof children === 'function' ? children(close) : children}
      </div>
    </div>,
    document.body,
  )
}

// Keep Tab focus inside the panel.
function trapTab(e: KeyboardEvent, panel: HTMLElement | null) {
  if (!panel) return
  const focusable = panel.querySelectorAll<HTMLElement>(
    'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
  )
  if (focusable.length === 0) { e.preventDefault(); panel.focus(); return }
  const first = focusable[0]
  const last = focusable[focusable.length - 1]
  const active = document.activeElement
  if (e.shiftKey && (active === first || active === panel)) {
    e.preventDefault(); last.focus()
  } else if (!e.shiftKey && active === last) {
    e.preventDefault(); first.focus()
  }
}
