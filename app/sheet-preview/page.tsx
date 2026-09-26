// SHEET-ORIGIN-01 — the preview, round two.
//
// Founder, on round one: "Doesn't load from the top of the nav pill at all.
// I'd want the pop ups to be the width of the pill too."
//
// 🔴 THE TWO NOTES ARE ONE PROBLEM. Round one scaled the panel from the PILL'S
// CENTRE, so it grew downward as well as up — off the bottom of the screen —
// and because the panel was full-width against a 343px pill it also scaled
// HORIZONTALLY, squashing its own text on the way out. Neither reads as "this
// came out of the pill"; they read as "a squashed panel un-squashed".
//
// Make the sheet pill-width and the horizontal scale becomes exactly 1. Anchor
// `transform-origin` to the BOTTOM edge and it grows upward only. Then the whole
// animation is one number — height — which is what emerging from a thing looks
// like.
//
// ⚠️ CONTENT MUST NOT SQUASH. A `scaleY` distorts everything inside it. The
// content fades in over the back half instead, so the squashed frames are the
// transparent ones. Cheap, compositor-friendly, and standard.
//
// ⚠️ SHIPS NOTHING. Drawn inline rather than importing `Sheet`.

'use client'

import { useCallback, useLayoutEffect, useRef, useState } from 'react'

type Origin = 'pill' | 'tap' | 'bottom'
type Spring = 'none' | 'wobble' | 'pop'
type Width  = 'pill' | 'full'
type Motion = 'slide' | 'grow'

/**
 * 🔴 `wobble` WAS THE WRONG SHAPE OF CURVE AND IT IS WHY THE FOUNDER SAID
 * *"it still comes from the bottom"* on a build that demonstrably grew from the
 * card he tapped.
 *
 * 📐 The old `cubic-bezier(0.18, 1.70, 0.40, 1)` reaches **90% in 16% of the
 * duration** — at 360ms the entire 400px journey is over in **57ms**, and the
 * remaining **303ms** is the panel oscillating in place at full size. The origin
 * is real and imperceptible. The eye sees "it appeared, then wobbled" and the
 * brain supplies the default story for a sheet: it came from the bottom.
 *
 * ⚠️ MY DURATION PICK CAUSED IT. I chose 360ms because the panel *arrives* in
 * 71ms — optimising for "no perceived lag" on an animation whose entire purpose
 * is that the runner SEES where it came from.
 *
 * `wobble` is now a curve that TRAVELS before it bounces: 90% at 56% of the
 * duration, peak 111.8% at 76%, settled by 99%. At 420ms that is 235ms of
 * journey and 185ms of settle. `pop` keeps the old one so the difference is
 * visible in one tap.
 */
const EASE: Record<Spring, string> = {
  none:   'cubic-bezier(0.32, 0.72, 0, 1)',
  wobble: 'cubic-bezier(0.65, 0.00, 0.35, 1.55)',
  pop:    'cubic-bezier(0.18, 1.70, 0.40, 1)',
}

const INSET = 16          // matches --nav-pill-inset
const GAP     = 10        // `detached`: breathing room above the pill
const OVERLAP = 26        // `fused`: how far the sheet's foot tucks BEHIND the pill

export default function SheetPreview() {
  const [origin, setOrigin] = useState<Origin>('tap')
  const [spring, setSpring] = useState<Spring>('wobble')
  const [width,  setWidth]  = useState<Width>('pill')
  const [motion, setMotion] = useState<Motion>('grow')
  /**
   * 📐 420ms, and the SECOND time this was picked from the curve — the first
   * pick was wrong in an instructive way.
   *
   * 360ms was chosen because the panel *arrives* in 71ms. But `wobble` reached
   * 90% in 57ms, so the journey from the card was invisible and only the
   * in-place oscillation was left to see. **On an origin-anchored transition the
   * number to optimise is TIME SPENT TRAVELLING, not time to arrival.**
   *
   * With the corrected curve at 420ms: **235ms of journey, 185ms of settle.**
   */
  const [ms, setMs] = useState(420)
  const [open, setOpen] = useState(false)
  const [shown, setShown] = useState(false)

  const pillRef  = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const fromRect = useRef<DOMRect | null>(null)

  /** The panel rests with its foot behind the pill. The CLIP hides the rest. */
  const restBottom = () => {
    const pill = pillRef.current?.getBoundingClientRect()
    if (width === 'full' || !pill) return 0
    return Math.round(window.innerHeight - pill.top - OVERLAP)
  }

  /**
   * 🔴 `slide` REPLACES THE SCALE, AND THE FOUNDER'S WORDS ARE WHY:
   * *"it looks like it goes into a line when it retracts."* It did — a `scaleY`
   * collapse ends at a 2px sliver **by definition**, so the panel squashes into
   * a line instead of going anywhere.
   *
   * `slide` never scales. The panel keeps its full height and translates DOWN
   * behind the pill, inside a clip whose bottom edge is the pill's top. Nothing
   * distorts, nothing collapses: it simply descends into the pill and is gone.
   * That is what "goes back into it" looks like.
   *
   * `grow` is kept only so the difference is visible.
   */
  const closed = (): { transform: string; originY: string } => {
    const panel = panelRef.current
    if (!panel || origin === 'bottom') return { transform: 'translateY(100%)', originY: 'center' }
    if (motion === 'slide') {
      // 100% of its own height, straight down — the clip does the hiding.
      return { transform: 'translateY(100%)', originY: 'center' }
    }
    const src = origin === 'pill' ? pillRef.current?.getBoundingClientRect() : fromRect.current
    if (!src) return { transform: 'translateY(100%)', originY: 'center' }
    const h = panel.offsetHeight
    const bottomEdge = window.innerHeight - restBottom()
    const sy = Math.max(2 / h, 0.01)
    const dy = origin === 'pill' ? src.top - bottomEdge : (src.top + src.height / 2) - bottomEdge
    return { transform: `translateY(${Math.round(dy)}px) scaleY(${sy.toFixed(4)})`, originY: 'bottom' }
  }

  const openFrom = useCallback((el: HTMLElement | null) => {
    fromRect.current = el?.getBoundingClientRect() ?? null
    setOpen(true)
  }, [])

  // The panel must EXIST to be measured, and the closed frame must be painted
  // before the open one. Round one set it in the render, where `panelRef` is
  // still null — so every origin silently fell back to the bottom slide.
  useLayoutEffect(() => {
    if (!open) return
    const panel = panelRef.current
    if (!panel) return
    const c = closed()
    panel.style.transition = 'none'
    panel.style.transformOrigin = `center ${c.originY}`
    panel.style.transform = c.transform
    void panel.offsetHeight
    // 🔴 rAF WITH A TIMEOUT FALLBACK, AND IT IS NOT A TEST CONVENIENCE.
    // `requestAnimationFrame` does not fire while the document is hidden. In
    // this browser pane `document.hidden` is permanently true, which is why the
    // animation could never be watched here — but the real exposure is a sheet
    // opened as the app backgrounds: `shown` never flips and the panel stays
    // collapsed off-screen until something else re-renders it.
    let released = false
    const release = () => {
      if (released) return
      released = true
      panel.style.transition = `transform ${ms}ms ${EASE[spring]}`
      // 🔴 THE OPEN TRANSFORM IS SET HERE, and the rewrite forgot it — the panel
      // stayed collapsed at a 2px sliver forever and `ANIMATED` read false.
      // FOURTH bug in this preview, and the fourth found by printing numbers
      // rather than looking, because `document.hidden` is true in the pane so
      // nothing animates to watch. All four were in the plumbing, never in the
      // idea, which is the argument for building the preview before the ship.
      panel.style.transform = 'translateY(0px) scaleY(1)'
      setShown(true)
    }
    requestAnimationFrame(release)
    const t = setTimeout(release, 50)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const close = () => {
    const panel = panelRef.current
    if (panel) {
      const c = closed()
      panel.style.transition = `transform ${ms}ms ${EASE[spring]}`
      panel.style.transform = c.transform     // retracts to the SAME place
    }
    setShown(false)
    setTimeout(() => setOpen(false), ms)
  }

  const seg = <T extends string>(label: string, value: T, set: (v: T) => void, opts: readonly T[]) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
      <span style={{ fontFamily: 'var(--font-ui)', fontSize: 11, color: 'var(--mute)', width: 46, flexShrink: 0 }}>{label}</span>
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
        {opts.map(o => (
          <button key={o} onClick={() => set(o)}
            className={`btn btn--compact ${value === o ? 'btn--primary' : 'btn--secondary'}`}
            style={{ fontSize: 11 }}>{o}</button>
        ))}
      </div>
    </div>
  )

  const pillWidth = width === 'pill'
  const fused     = pillWidth
  const fusedOpen = fused && open

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'var(--bg)', overflow: 'hidden',
      maxWidth: 480, margin: '0 auto',
      // 🔴 FLEX, NOT A HARDCODED OFFSET. The scroll area was
      // `position: absolute; inset: '186px 0 0'` — a magic number for the
      // control panel's height, typed once and then invalidated twice by adding
      // a control row. The panel grew past 186px, the scroll area covered its
      // last two rows, and because the cards are BUTTONS they swallowed the
      // taps: the founder could see the spring toggle and the slider and could
      // not use them.
      //
      // ⚠️ A layout constant that encodes another element's height is wrong the
      // moment that element changes, and nothing warns you. Flex derives it.
      display: 'flex', flexDirection: 'column',
    }}>
      <div style={{ flexShrink: 0, padding: '10px 16px', background: 'var(--card)', borderBottom: '1px solid var(--line)' }}>
        <div style={{ fontFamily: 'var(--font-brand)', fontSize: 15, fontWeight: 600, color: 'var(--ink)' }}>Sheet origin · round 2</div>
        <div style={{ fontFamily: 'var(--font-ui)', fontSize: 11, color: 'var(--mute)', marginTop: 3, lineHeight: 1.5 }}>
          <strong>slide</strong> never scales — the panel keeps its height and descends behind the
          pill. <strong>grow</strong> is the old scale, kept so you can see why it read as a line.
        </div>
        {seg('width',  width,  setWidth,  ['pill', 'full'] as const)}
        {seg('motion', motion, setMotion, ['slide', 'grow'] as const)}
        {seg('origin', origin, setOrigin, ['pill', 'tap', 'bottom'] as const)}
        {seg('spring', spring, setSpring, ['wobble', 'pop', 'none'] as const)}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 6 }}>
          <span style={{ fontFamily: 'var(--font-ui)', fontSize: 11, color: 'var(--mute)', width: 46 }}>{ms}ms</span>
          <input type="range" min={220} max={800} step={20} value={ms}
                 onChange={e => setMs(parseInt(e.target.value, 10))} style={{ flex: 1 }} />
        </div>
      </div>

      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '0 16px 150px' }}>
        {["This week's load", 'Hitting the zone', 'Why this session', 'Your training load balance'].map((t, i) => (
          <button key={i} onClick={e => openFrom(e.currentTarget)}
            style={{
              width: '100%', textAlign: 'left', font: 'inherit', cursor: 'pointer',
              marginTop: 12, background: 'var(--card)', border: '1px solid var(--line)',
              borderRadius: 14, padding: '18px 16px', boxShadow: 'var(--shadow-card)',
            }}>
            <div style={{ fontFamily: 'var(--font-ui)', fontSize: 10, fontWeight: 700, color: 'var(--mute)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Tap to open</div>
            <div style={{ fontFamily: 'var(--font-ui)', fontSize: 15, fontWeight: 600, color: 'var(--ink)', marginTop: 4 }}>{t}</div>
          </button>
        ))}
      </div>

      {/* 🔴 THE PILL IS LIFTED ABOVE THE SCRIM WHILE FUSED, and this collides
          with a recorded ruling. S1 (Design Board 2026-09-22) made the panel
          COVER the nav precisely because a visible dimmed nav was "VISIBLE,
          DIMMED, AND LYING": it offered four destinations and delivered one
          behaviour, and tapping "Plan" dismissed the sheet instead of
          navigating. A BRIGHT nav makes that lie louder, not quieter.
          Surfaced in the preview rather than decided here. */}
      <div ref={pillRef} className="nav-bar nav-bar--floating"
           style={{ position: 'fixed', zIndex: fusedOpen ? 4002 : 3000 }}>
        {['Today', 'Plan', 'Coach', 'Me'].map((l, i) => (
          <button key={l} className="nav-tab" style={{ color: i === 0 ? 'var(--moss-strong)' : undefined }}>
            <svg width="22" height="22" viewBox="0 0 22 22" aria-hidden>
              <rect x="3" y="11" width="4" height="8" rx="1" fill="currentColor" />
              <rect x="9" y="7" width="4" height="12" rx="1" fill="currentColor" />
              <rect x="15" y="4" width="4" height="15" rx="1" fill="currentColor" />
            </svg>
            {l}
          </button>
        ))}
      </div>

      {open && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 4000 }}>
          <div onClick={close} style={{
            position: 'absolute', inset: 0, background: 'var(--scrim)',
            opacity: shown ? 1 : 0, transition: `opacity ${ms}ms ease`,
          }} />
          {/* 🔴 THE CLIP IS THE WHOLE TRICK for `slide`. Its bottom edge is the
              pill's top, so a panel translated down by its own height is simply
              GONE behind the pill — no squash, no sliver, nothing to read as a
              line. `grow` needs no clip and gets none. */}
          <div style={{
            position: 'absolute', left: 0, right: 0, top: 0,
            bottom: pillWidth ? `${restBottom()}px` : 0,
            overflow: motion === 'slide' ? 'hidden' : 'visible',
            pointerEvents: 'none',
          }}>
          <div ref={panelRef} style={{
            pointerEvents: 'auto',
            position: 'absolute',
            left: pillWidth ? INSET : 0,
            right: pillWidth ? INSET : 0,
            bottom: 0,
            maxWidth: pillWidth ? 448 : 480, margin: '0 auto',
            background: 'var(--card)',
            // Pill-width sheets are objects, so all four corners round and they
            // carry the pill's edge. Full-width keeps today's top-only radius.
            // Fused: the foot is hidden behind the pill, so square it and drop
            // the bottom border — two borders meeting would draw a seam through
            // what is meant to be one object.
            borderRadius: !pillWidth ? '20px 20px 0 0' : fused ? '22px 22px 0 0' : 22,
            border: pillWidth ? '1px solid var(--chrome-edge)' : 'none',
            borderBottom: fused ? 'none' : undefined,
            boxShadow: 'var(--shadow-lifted)',
            maxHeight: '64vh', overflow: 'hidden',
            zIndex: 4001,
            willChange: 'transform',
          }}>
            {/* ⚠️ COUNTER-FADE, NOT COUNTER-SCALE. A `scaleY` distorts everything
                inside it; the content fades in over the back half so the
                squashed frames are the transparent ones. */}
            <div style={{
              padding: fused ? `18px 18px ${22 + OVERLAP}px` : '18px 18px 22px',
              opacity: shown ? 1 : 0,
              transition: `opacity ${Math.round(ms * 0.45)}ms ease ${Math.round(ms * 0.35)}ms`,
            }}>
              <div style={{ fontFamily: 'var(--font-brand)', fontSize: 18, fontWeight: 600, color: 'var(--ink)' }}>Your training load balance</div>
              <div style={{ fontFamily: 'var(--font-ui)', fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.6, marginTop: 10 }}>
                Easy days easy, hard days hard. Enough body here to see the panel move as a whole
                object rather than a strip.
              </div>
              <button onClick={close} className="btn btn--secondary btn--compact" style={{ width: '100%', marginTop: 18 }}>Close</button>
            </div>
          </div>
          </div>
        </div>
      )}
    </div>
  )
}
