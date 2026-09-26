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
//   • COVERING the nav — the panel's bottom edge is the viewport's (S1, Design
//     Board 2026-09-22). ⚠️ THIS REVERSES SHEET-PRESENT-01's ORIGINAL RULE,
//     "come up from the nav bar but not overlay it", explicitly and by name.
//
//     The reversal is NOT about room. Measured: covering the nav buys 0px on an
//     iPhone SE and 5px — 0.6% — on a 13/15. The defect was that the backdrop is
//     `inset: 0` at Z_LAYERS.sheet (4000) against the nav's 3000, filled with
//     `--scrim` at 40% ink and carrying `onClick={close}`. So the nav was
//     VISIBLE, DIMMED, AND LYING: it offered four destinations and delivered
//     one behaviour, and tapping "Plan" dismissed the sheet instead of
//     navigating. The fattest, most reachable strip on the phone was wired to
//     the wrong verb, on all six sheets in the product.
//
//     A modal dialog covers the application. The one exit is the panel's own
//     bottom bar, which the standing rule already puts there.
//
//     ⚠️ The nav height is still MEASURED and still consumed — by `maxHeight`
//     below, so a tall sheet cannot grow into the home-indicator strip.
//   • `maxHeightVh` 88 is LOAD-BEARING, not a default (Silvanto, binding). This
//     is a sheet that covers the nav, NOT a sheet becoming a screen. A sheet
//     whose content cannot fit at 88vh is evidence the content belongs on a
//     screen.
//   • Enter + exit animation, backdrop + Escape dismissal, body-scroll lock,
//     and focus handling (focus the panel on open, trap Tab within it, restore
//     on close).
//
// Presentation contract lives in docs/canonical/ui-patterns.md § Slide-up Sheet.

'use client'

import { createContext, useContext, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import IconButton from '@/components/ui/IconButton'
import { createPortal } from 'react-dom'
import { Z_LAYERS } from '@/lib/ui/zLayers'
import { lastPressedRect } from '@/lib/ui/lastPressed'

// ── Nav height ─────────────────────────────────────────────────────────────
// The bottom nav measures itself (ResizeObserver in DashboardClient) and
// publishes the height here so any sheet, wherever it is declared in the tree,
// can bound its own height against it. ⚠️ Since S1 the panel COVERS the nav, so
// this no longer positions anything — it only keeps a tall sheet's content out
// of the home-indicator strip. Null while the nav is unmounted (first-time
// onboarding) or before first measure; sheets fall back to a sane default.

const NavHeightContext = createContext<number | null>(null)

export function NavHeightProvider({ value, children }: { value: number | null; children: React.ReactNode }) {
  return <NavHeightContext.Provider value={value}>{children}</NavHeightContext.Provider>
}

export function useNavHeight(): number | null {
  return useContext(NavHeightContext)
}

const NAV_FALLBACK_PX = 64
/** SHEET-ORIGIN-01 — matches `--nav-pill-inset` / the pill's own geometry. */
const PILL_INSET   = 16
const PILL_MAXW    = 448
/** How far the sheet's foot tucks BEHIND the pill so they read as one object. */
const PILL_OVERLAP = 26
const EXIT_MS = 280
/**
 * 📐 PICKED FROM THE CURVE, AND THE FIRST PICK WAS WRONG IN AN INSTRUCTIVE WAY.
 * A front-loaded spring (`cubic-bezier(0.18, 1.70, 0.40, 1)`) reaches 90% in
 * **16% of the duration** — at 360ms the whole journey finished in 57ms and the
 * rest was oscillation in place, so the founder reported "it still comes from
 * the bottom" about a sheet that provably grew from his own tap.
 *
 * This curve reaches 90% at **56%**, peaks at **111.8%** at 76%, and settles by
 * 99%. At 420ms that is **235ms of travel and 185ms of settle.**
 */
const ENTER_MS   = 420
const ENTER_EASE = 'cubic-bezier(0.65, 0, 0.35, 1.55)'

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
  /** The scrolling element. Separate from the panel since SHEET-CLOSE-PIN-01. */
  const bodyRef = useRef<HTMLDivElement>(null)
  const prevFocusRef = useRef<Element | null>(null)
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose
  const closingRef = useRef(false)

  /**
   * 🔴 SHEET-ORIGIN-01 — the panel grows out of the control that opened it.
   *
   * Founder, over six rounds: sheets should come **out of the nav pill**, be
   * **the width of the pill**, and **go back into it**. Two corrections came out
   * of the preview and both are load-bearing:
   *
   *   1. **The runner never taps the pill** — they tap a card, a chip, an "i"
   *      mark. Growing from the pill attributes the sheet to a control they did
   *      not touch. So the origin is the **last pressed control**, and the
   *      pill's top edge only when there isn't one.
   *   2. **"It still comes from the bottom"** on a build that demonstrably grew
   *      from the card. The origin was real and IMPERCEPTIBLE: the old curve
   *      reached 90% in 57ms, so the journey was over before the eye could
   *      follow it. **On an origin-anchored transition the number to optimise is
   *      TIME SPENT TRAVELLING, not time to arrival.**
   */
  const originRef = useRef<DOMRect | null>(null)
  const closedTransform = useCallback(() => {
    const panel = panelRef.current
    if (!panel) return 'translateY(100%)'
    const src = originRef.current
    const pill = { top: window.innerHeight - navH }
    const h = panel.offsetHeight
    // The panel's laid-out bottom edge in viewport coords. Derived, never
    // measured: `getBoundingClientRect()` returns the TRANSFORMED box, and the
    // panel is already transformed when this runs.
    const bottomEdge = window.innerHeight - Math.max(0, navH - PILL_OVERLAP)
    const anchor = src ? src.top + src.height / 2 : pill.top
    const sy = Math.max(2 / Math.max(h, 1), 0.01)
    return `translateY(${Math.round(anchor - bottomEdge)}px) scaleY(${sy.toFixed(4)})`
  }, [navH])

  /**
   * 🔴 SWIPE DOWN TO CLOSE (founder, 2026-09-25: *"I want ALL popups we have to
   * be able to swipe down to close them as well as have the cross to close"*).
   *
   * ⚠️ THE DRAG PILL WAS ALREADY DRAWN AND DRAGGED NOTHING — a false affordance
   * shipped in the primitive itself, promising a gesture the sheet did not
   * support. Every sheet in the app inherited it.
   *
   * ⚠️ THE DRAG ONLY STARTS AT THE TOP OF THE SCROLL. A sheet whose body is
   * scrolled mid-way must scroll, not dismiss — otherwise a runner reading a
   * long zone explanation loses it trying to scroll back up. `scrollTop <= 0`
   * is the whole guard, and it is why this is safe on a scrollable panel.
   */
  const dragStartY = useRef<number | null>(null)
  const [dragY, setDragY] = useState(0)
  const DISMISS_PX = 90

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    // 🔴 `bodyRef`, NOT `panelRef`. The scroller moved when the close was
    // pinned, and the swipe-to-dismiss gate reads the scroller: left on the
    // panel it would read a permanent 0 and the sheet would dismiss mid-scroll,
    // which is the documented reason this gate exists at all.
    const el = bodyRef.current
    if (!el || el.scrollTop > 0) { dragStartY.current = null; return }
    dragStartY.current = e.touches[0]!.clientY
  }, [])

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    if (dragStartY.current === null) return
    const dy = e.touches[0]!.clientY - dragStartY.current
    // Downward only: an upward pull is a scroll, not a dismiss.
    setDragY(dy > 0 ? dy : 0)
  }, [])

  const onTouchEnd = useCallback(() => {
    if (dragStartY.current === null) return
    const dy = dragY
    dragStartY.current = null
    setDragY(0)
    if (dy > DISMISS_PX) closeRef.current()
  }, [dragY])

  const closeRef = useRef<() => void>(() => {})

  // Animated dismiss: play the exit, then hand control back to the caller.
  const close = useCallback(() => {
    if (closingRef.current) return
    closingRef.current = true
    if (reduce.current) { onCloseRef.current(); return }
    setShown(false)
    window.setTimeout(() => onCloseRef.current(), EXIT_MS)
  }, [])
  closeRef.current = close

  // Mount → portal target exists → run the enter animation on the next frame.
  useEffect(() => {
    reduce.current = prefersReducedMotion()
    setMounted(true)
  }, [])

  useLayoutEffect(() => {
    if (!mounted) return
    if (reduce.current) { setShown(true); return }
    const panel = panelRef.current
    if (!panel) { setShown(true); return }
    originRef.current = lastPressedRect()
    panel.style.transition = 'none'
    panel.style.transformOrigin = 'center bottom'
    panel.style.transform = closedTransform()
    void panel.offsetHeight                       // paint the closed frame
    // ⚠️ rAF WITH A TIMEOUT FALLBACK. rAF does not fire while the document is
    // hidden, so a sheet mounting as the app backgrounds would leave `shown`
    // false: scrim up, body scroll-locked, no panel (`SHEET-RAF-FALLBACK-01`).
    let released = false
    const release = () => {
      if (released) return
      released = true
      panel.style.transition = `transform ${ENTER_MS}ms ${ENTER_EASE}`
      panel.style.transform = 'translateY(0px) scaleY(1)'
      setShown(true)
    }
    requestAnimationFrame(release)
    const t = setTimeout(release, 50)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
        background: 'var(--scrim)',
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
        // S1 — the panel's bottom edge is the VIEWPORT's, so the sheet covers
        // the nav rather than resting on a dimmed, dead copy of it.
        paddingBottom: 0,
        boxSizing: 'border-box',
        opacity: shown ? 1 : 0,
        transition: transition ?? 'opacity 0.2s ease-out',
      }}
    >
      <div
        ref={panelRef}
        tabIndex={-1}
        onClick={e => e.stopPropagation()}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onTouchCancel={onTouchEnd}
        style={{
          // 🔴 PILL WIDTH, and it is not decoration. Founder: "I'd want the pop
          // ups to be the width of the pill too." Measured in the preview: at
          // pill width the HORIZONTAL scale of the entry transform is exactly
          // **1**, so the panel no longer squashes its own text on the way out
          // and needs no counter-fade. The whole animation becomes one number.
          width: `calc(100% - ${PILL_INSET * 2}px)`,
          maxWidth: `${Math.min(maxWidth, PILL_MAXW)}px`,
          background: 'var(--card)',
          // All four corners: a pill-width sheet is an OBJECT, not a drawer. The
          // foot is hidden behind the pill so its radius never shows.
          borderRadius: '22px 22px 0 0',
          border: '1px solid var(--chrome-edge)',
          borderBottom: 'none',
          position: 'relative',
          boxShadow: '0 -8px 24px rgba(0,0,0,0.12)',
          paddingTop: 'var(--space-2)',
          // S1 completeness — the panel now reaches the viewport's bottom edge,
          // so ITS content (the close bar the standing rule puts there) would
          // otherwise sit under the home indicator. The nav used to absorb this
          // for us. Same doctrine as A4: the inset is a reserved strip, not
          // content padding, so it is added rather than spent.
          paddingBottom: 'env(safe-area-inset-bottom, 0px)',
          // navH is still consumed HERE even though the panel covers the nav:
          // it keeps a tall sheet's own content out of the home-indicator strip.
          // The foot tucks BEHIND the pill so there is no seam between them.
          marginBottom: `-${PILL_OVERLAP}px`,
          maxHeight: `min(${maxHeightVh}vh, calc(100vh - ${navH}px - 24px))`,
          // 🔴 THE PANEL NO LONGER SCROLLS — ITS BODY DOES (SHEET-CLOSE-PIN-01).
          // The close was `position: absolute` inside the scrolling panel, and
          // an absolutely-positioned child of a scroll container scrolls WITH
          // the content. Measured in a browser: **-500px after a 500px scroll**.
          // So the one documented way out of a sheet left the screen the moment
          // the runner scrolled, on ALL NINE sheets. Founder saw it on the
          // manual log and it is visible in his capture.
          //
          // ⚠️ Same class as STICKY-SCROLLER-01 earlier today: an element that
          // looks pinned and is not. There it was a scrollport that could never
          // scroll; here it is a pinned thing inside the scrollport itself.
          display: 'flex',
          flexDirection: 'column',
          // `hidden` so the body still clips to the 20px top corners now that it
          // is the scrolling element rather than the panel.
          overflow: 'hidden',
          outline: 'none',
          transform: shown ? `translateY(${dragY}px)` : 'translateY(100%)',
          // No transition WHILE dragging: the panel must track the finger, then
          // spring back or dismiss when it is released.
          transition: dragY > 0 ? 'none' : (transition ?? 'transform 0.28s cubic-bezier(0.32, 0.72, 0, 1)'),
        }}
      >
        {/* Drag pill — and as of 2026-09-25 it actually drags.
            ⚠️ It and the close now sit OUTSIDE the scrolling body, which is the
            whole fix: they are chrome, and chrome does not scroll away. */}
        <div style={{ flexShrink: 0, width: '36px', height: '4px', background: 'var(--line)', borderRadius: '2px', margin: '6px auto 18px' }} />
        {/* 🔴 THE CLOSE IS THE PRIMITIVE'S, NOT EACH SHEET'S (SHEET-CLOSE-OWNER-01).
            Six sheets hand-rolled three different closes: a bottom full-width
            "Close", a top-right cross, and nothing. A runner met a different
            way out of each one. Same shape as `.cta-pill` and `BackButton` —
            the third time a thing every caller needs was left to each caller. */}
        <IconButton
          onClick={close}
          ariaLabel="Close"
          shape="circle"
          style={{ position: 'absolute', top: '10px', right: '12px', zIndex: 1 }}
          icon={
            <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden="true">
              <path d="M5 5l10 10M15 5L5 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          }
        />
        {/* The scrolling body. ⚠️ Callers with a `position: sticky; bottom: 0`
            bar (ModifyPlanSheet, RaceResultSheet, the manual log) stick to THIS
            element now — they rode the panel before, and the behaviour is the
            same because they are still inside the scroller. */}
        <div
          ref={bodyRef}
          style={{
            flex: 1, minHeight: 0,
            overflowY: 'auto',
            WebkitOverflowScrolling: 'touch',
          }}
        >
          {typeof children === 'function' ? children(close) : children}
        </div>
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
