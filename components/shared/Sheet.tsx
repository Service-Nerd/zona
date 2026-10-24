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
import { releaseOnNextFrame } from '@/lib/ui/rafRelease'
import { claimSheetFoot, getNavNode } from '@/lib/ui/sheetFoot'

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
const EXIT_MS = 280

// ── S1 Amendment 1 — the sheet comes out of the pill (SHEET-ORIGIN-01, Design Board 2026-10-24) ──────────────────
//
// The founder asked six times for sheets to come out of the nav pill and decided the one structural question himself
// (2026-10-02, option b): while a sheet is open the pill stays visible as the sheet's FOOT and visibly stops being tabs.
// That answers S1's reason for covering the nav (a visible nav that offers four destinations is lying) instead of
// ignoring it, which is what the reverted attempt (`aa0dbb9d`) did.
//
// What the reverted rounds taught, kept here so they are not re-learned:
//   • the origin is the PILL, the founder's word in every message;
//   • SLIDE, never scaleY: a scale collapses the panel to a line on the way out (round 4);
//   • the curve must TRAVEL, not front-load: 90% at 56% of the duration (round 6);
//   • the panel's width is the pill's, so nothing scales horizontally;
//   • a declarative style prop and an imperative style write cannot both own a property. This is declarative only.
//
// ⏸️ OFF AGAIN, 2026-10-24 (SHEET-ORIGIN-DEVICE-01). On the same day it went on, the founder opened a Coach sheet in
// the iOS app and it appeared mid-screen, then dropped onto the pill. The real component in a browser at 375×812 rises
// from the pill and settles in ~0.5 s, so the app on a device differs from the preview, and the cause is not yet
// known. `/sheet-preview` keeps the toggle, so the presentation can still be inspected while it is found.
export const SHEET_FROM_PILL = false
/** How far the panel's foot tucks BEHIND the pill, so the two read as one object with no seam (round 3, measured). */
export const PILL_OVERLAP_PX = 26
/** Enter: travels, overshoots once to ~112%, settles (round 6). */
export const SHEET_PILL_CURVE = 'cubic-bezier(0.65, 0, 0.35, 1.55)'
export const SHEET_PILL_MS = 420
/** Exit: back into the pill, no overshoot. */
const SHEET_PILL_EXIT = `transform ${EXIT_MS}ms cubic-bezier(0.65, 0, 0.35, 1)`

export type SheetPresentation = 'bottom' | 'pill'
const SheetPresentationContext = createContext<SheetPresentation>(SHEET_FROM_PILL ? 'pill' : 'bottom')
export function SheetPresentationProvider({ value, children }: { value: SheetPresentation; children: React.ReactNode }) {
  return <SheetPresentationContext.Provider value={value}>{children}</SheetPresentationContext.Provider>
}


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
  /** 🔴 THE DIALOG'S ACCESSIBLE NAME, AND IT IS REQUIRED (`SHEET-ARIA-LABEL-01`,
   *  2026-10-01). `role="dialog"` with no name announces as an unnamed dialog, which
   *  tells a screen-reader user that something has taken over the screen and nothing
   *  about what. It was optional, and the item was filed on the premise that the four
   *  sheets' copy was an open question.
   *
   *  ⚠️ MEASURED FIRST, AND THE PREMISE WAS WRONG IN THE USEFUL DIRECTION: there are
   *  **ten runner-reachable call sites, not four, and every one already passes a label.**
   *  So this authors no copy and changes no behaviour — it moves the guarantee from
   *  "everyone has remembered so far" to the compiler, which is where this repo's own
   *  record says a rule has to live. The ELEVENTH is the one it is for. */
  ariaLabel: string
}

export default function Sheet({ onClose, children, maxWidth = 480, maxHeightVh = 88, ariaLabel }: SheetProps) {
  const navHeight = useNavHeight()
  const navH = navHeight ?? NAV_FALLBACK_PX
  // The pill presentation needs a MEASURED pill to come out of: the real nav's box, read once at mount. No nav
  // (onboarding) or no measure → S1's bottom sheet, which needs neither.
  const wantsPill = useContext(SheetPresentationContext) === 'pill'
  const [pill, setPill] = useState<{ left: number; top: number; width: number; height: number } | null>(null)
  useLayoutEffect(() => {
    if (!wantsPill) return
    const read = () => {
      const r = getNavNode()?.getBoundingClientRect()
      setPill(r && r.width > 0 && r.height > 0 ? { left: r.left, top: r.top, width: r.width, height: r.height } : null)
    }
    read()
    window.addEventListener('resize', read)
    return () => window.removeEventListener('resize', read)
  }, [wantsPill])
  const fromPill = wantsPill && pill != null
  const releaseFootRef = useRef<(() => void) | null>(null)

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
    // The pill becomes tabs again as the panel retracts into it, not after.
    releaseFootRef.current?.()
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

  // SHEET-RAF-FALLBACK-01 — rAF RELEASES THE ENTER TRANSITION, AND rAF DOES NOT
  // FIRE WHILE `document.hidden` IS TRUE.
  //
  // 🔴 The failure is not a missing animation, it is a dead screen. With `shown`
  // stuck false the panel sits at `translateY(100%)` while the scrim is already
  // up and the body is already scroll-locked, so the app looks broken AND
  // cannot be scrolled out of.
  //
  // ⚠️ IT SELF-HEALS ON RETURN, which is what kept it filed rather than fixed:
  // pending rAF callbacks fire when the document becomes visible, so the broken
  // window is the one nobody is looking at. It is still a window a runner can
  // land in: open a sheet, take a call or switch apps mid-tap, come back.
  //
  // ⚠️ AND IT IS NOT HYPOTHETICAL IN THIS REPO. `document.hidden` is
  // permanently true in the browser pane used for verification, which is why
  // four successive attempts on `/sheet-preview` reported a sheet that had not
  // opened. The item recorded the preview as carrying its own timeout fallback;
  // that is stale, because SHEET-ORIGIN-01 rewrote the preview to import this
  // primitive, so it has no release logic of its own and never did get fixed.
  //
  // The fix is a race, not a replacement: whichever of rAF and the backstop
  // fires first releases, and both are cancelled on teardown. rAF still wins
  // every normal frame, so the transition is unchanged for every runner who is
  // actually looking at it.
  //
  // ⚠️ VIA `releaseOnNextFrame` RATHER THAN TWO LINES HERE, because the consumer
  // check on this fix found `WheelPicker` with the same bug and a worse symptom
  // (`suppress` latches true and the wheel stops responding to scroll at all).
  // Two components had it independently; a third written tomorrow would have it
  // again. `rafRelease.test.ts` fails the build on a direct rAF call.
  useEffect(() => {
    if (!mounted) return
    if (reduce.current) { setShown(true); return }
    return releaseOnNextFrame(() => setShown(true))
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

  // S1 Am.1 — claim the pill as this sheet's foot for as long as it is open. Released on close (above) and on unmount.
  useEffect(() => {
    if (!mounted || !fromPill) return
    const release = claimSheetFoot()
    releaseFootRef.current = release
    return release
  }, [mounted, fromPill])

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
        // S1 Am.1 — or, from the pill, it ends PILL_OVERLAP_PX below the pill's top edge, tucked behind it.
        paddingBottom: fromPill ? `calc(100vh - ${pill!.top + PILL_OVERLAP_PX}px)` : 0,
        boxSizing: 'border-box',
        opacity: shown ? 1 : 0,
        transition: transition ?? 'opacity 0.2s ease-out',
      }}
    >
      {(() => { const panel = (
      <div
        ref={panelRef}
        tabIndex={-1}
        onClick={e => e.stopPropagation()}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onTouchCancel={onTouchEnd}
        style={{
          width: '100%', maxWidth: fromPill ? undefined : `${maxWidth}px`,
          background: 'var(--card)',
          // S1 Am.1 — from the pill the foot is SQUARED and unbordered, tucked behind the pill: two borders meeting
          // would draw a seam through what is meant to be one object (Silvanto).
          borderRadius: fromPill ? '22px 22px 0 0' : '20px 20px 0 0',
          ...(fromPill ? { border: '1px solid var(--chrome-edge)', borderBottom: 'none', boxSizing: 'border-box' as const } : {}),
          position: 'relative',
          boxShadow: '0 -8px 24px rgba(0,0,0,0.12)',
          paddingTop: 'var(--space-2)',
          // S1 completeness — the panel now reaches the viewport's bottom edge,
          // so ITS content (the close bar the standing rule puts there) would
          // otherwise sit under the home indicator. The nav used to absorb this
          // for us. Same doctrine as A4: the inset is a reserved strip, not
          // content padding, so it is added rather than spent.
          // S1 Am.1 — from the pill, the last PILL_OVERLAP_PX of the panel sits behind the pill, so it is reserved.
          paddingBottom: fromPill ? `${PILL_OVERLAP_PX}px` : 'env(safe-area-inset-bottom, 0px)',
          // navH is still consumed HERE even though the panel covers the nav:
          // it keeps a tall sheet's own content out of the home-indicator strip.
          maxHeight: fromPill
            ? `min(${maxHeightVh}vh, ${pill!.top + PILL_OVERLAP_PX - 24}px)`
            : `min(${maxHeightVh}vh, calc(100vh - ${navH}px - 24px))`,
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
          transition: dragY > 0 ? 'none' : (transition ?? (fromPill
            ? (shown ? `transform ${SHEET_PILL_MS}ms ${SHEET_PILL_CURVE}` : SHEET_PILL_EXIT)
            : 'transform 0.28s cubic-bezier(0.32, 0.72, 0, 1)')),
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
            // SCROLL-NATIVE-01 — without this, scrolling a sheet to its end CHAINS to the
            // page behind it and the screen slides under the panel. A native sheet does not
            // move the thing it is covering.
            overscrollBehavior: 'contain',
          }}
        >
          {typeof children === 'function' ? children(close) : children}
        </div>
      </div>
      )
      // S1 Am.1 — the clip IS the pill's mouth. Its bottom edge sits PILL_OVERLAP_PX below the pill's top, so a panel
      // translated down by its own height is hidden behind the pill, and the slide in and out reads as the panel
      // coming out of it. The width is the pill's own, from the pill's own variables, so nothing is measured twice.
      // The top padding is room for the shadow, which the clip would otherwise cut.
      return fromPill ? (
        <>
          <div style={{
            position: 'absolute', left: pill!.left, width: pill!.width, bottom: `calc(100vh - ${pill!.top + PILL_OVERLAP_PX}px)`,
            overflow: 'hidden', paddingTop: 'var(--space-5)',
            display: 'flex', flexDirection: 'column', justifyContent: 'flex-end',
          }}>{panel}</div>
          {/* THE FOOT — an empty pill drawn over the real nav's exact box, in THIS layer, so it is above the scrim
              whatever stacking context the nav lives in (lib/ui/sheetFoot.ts). The real nav is underneath, inert. */}
          <div aria-hidden="true" className="nav-bar nav-bar--floating nav-bar--sheet-foot"
            style={{ position: 'fixed', left: pill!.left, top: pill!.top, width: pill!.width, height: pill!.height,
                     bottom: 'auto', transform: 'none', maxWidth: 'none', margin: 0 }} />
        </>
      ) : panel })()}
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
