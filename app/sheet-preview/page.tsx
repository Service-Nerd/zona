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
type Spring = 'none' | 'overshoot' | 'wobble'
type Width  = 'pill' | 'full'

const EASE: Record<Spring, string> = {
  none:      'cubic-bezier(0.32, 0.72, 0, 1)',
  overshoot: 'cubic-bezier(0.34, 1.40, 0.64, 1)',
  wobble:    'cubic-bezier(0.18, 1.70, 0.40, 1)',
}

const INSET = 16          // matches --nav-pill-inset
const GAP   = 10          // breathing room between the sheet and the pill

export default function SheetPreview() {
  const [origin, setOrigin] = useState<Origin>('pill')
  const [spring, setSpring] = useState<Spring>('overshoot')
  const [width,  setWidth]  = useState<Width>('pill')
  const [ms, setMs] = useState(420)
  const [open, setOpen] = useState(false)
  const [shown, setShown] = useState(false)

  const pillRef  = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const fromRect = useRef<DOMRect | null>(null)

  /** Where the panel rests: just above the pill when pill-width, else the floor. */
  const restBottom = () => {
    const pill = pillRef.current?.getBoundingClientRect()
    if (width === 'full' || !pill) return 0
    return Math.round(window.innerHeight - pill.top + GAP)
  }

  /**
   * The closed state. 🔴 `transform-origin: bottom` + `scaleY` ONLY — it grows
   * UP from its own bottom edge, which is sitting on the pill. Round one scaled
   * from the centre and grew both ways.
   */
  const closed = (): { transform: string; originY: string } => {
    const panel = panelRef.current
    if (!panel) return { transform: 'translateY(100%)', originY: 'center' }
    if (origin === 'bottom') return { transform: 'translateY(100%)', originY: 'center' }

    const src = origin === 'pill'
      ? pillRef.current?.getBoundingClientRect()
      : fromRect.current
    if (!src) return { transform: 'translateY(100%)', originY: 'center' }

    const h = panel.offsetHeight
    // The panel's laid-out bottom edge, in viewport coords.
    const bottomEdge = window.innerHeight - restBottom()
    // Collapse to a sliver, then put that sliver on the origin's TOP edge
    // (the founder's words: "from the top of the nav pill").
    const sy = Math.max(2 / h, 0.01)
    const dy = origin === 'pill'
      ? src.top - bottomEdge                       // the pill's top edge
      : (src.top + src.height / 2) - bottomEdge    // a tapped card's middle
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
    requestAnimationFrame(() => {
      panel.style.transition = `transform ${ms}ms ${EASE[spring]}`
      // 🔴 THE OPEN TRANSFORM IS SET HERE, and the rewrite forgot it — the panel
      // stayed collapsed at a 2px sliver forever and `ANIMATED` read false.
      // FOURTH bug in this preview, and the fourth found by printing numbers
      // rather than looking, because `document.hidden` is true in the pane so
      // nothing animates to watch. All four were in the plumbing, never in the
      // idea, which is the argument for building the preview before the ship.
      panel.style.transform = 'translateY(0px) scaleY(1)'
      setShown(true)
    })
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

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'var(--bg)', overflow: 'hidden', maxWidth: 480, margin: '0 auto' }}>
      <div style={{ padding: '10px 16px', background: 'var(--card)', borderBottom: '1px solid var(--line)' }}>
        <div style={{ fontFamily: 'var(--font-brand)', fontSize: 15, fontWeight: 600, color: 'var(--ink)' }}>Sheet origin · round 2</div>
        <div style={{ fontFamily: 'var(--font-ui)', fontSize: 11, color: 'var(--mute)', marginTop: 3, lineHeight: 1.5 }}>
          Pill-width makes the horizontal scale <strong>1</strong>, so the only movement is height —
          it grows up out of the pill&rsquo;s top edge.
        </div>
        {seg('width',  width,  setWidth,  ['pill', 'full'] as const)}
        {seg('origin', origin, setOrigin, ['pill', 'tap', 'bottom'] as const)}
        {seg('spring', spring, setSpring, ['none', 'overshoot', 'wobble'] as const)}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 6 }}>
          <span style={{ fontFamily: 'var(--font-ui)', fontSize: 11, color: 'var(--mute)', width: 46 }}>{ms}ms</span>
          <input type="range" min={220} max={800} step={20} value={ms}
                 onChange={e => setMs(parseInt(e.target.value, 10))} style={{ flex: 1 }} />
        </div>
      </div>

      <div style={{ position: 'absolute', inset: '186px 0 0', overflowY: 'auto', padding: '0 16px 150px' }}>
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

      <div ref={pillRef} className="nav-bar nav-bar--floating" style={{ position: 'fixed', zIndex: 3000 }}>
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
          <div ref={panelRef} style={{
            position: 'absolute',
            left: pillWidth ? INSET : 0,
            right: pillWidth ? INSET : 0,
            bottom: restBottom(),
            maxWidth: pillWidth ? 448 : 480, margin: '0 auto',
            background: 'var(--card)',
            // Pill-width sheets are objects, so all four corners round and they
            // carry the pill's edge. Full-width keeps today's top-only radius.
            borderRadius: pillWidth ? 22 : '20px 20px 0 0',
            border: pillWidth ? '1px solid var(--chrome-edge)' : 'none',
            boxShadow: 'var(--shadow-lifted)',
            maxHeight: '64vh', overflow: 'hidden',
            willChange: 'transform',
          }}>
            {/* ⚠️ COUNTER-FADE, NOT COUNTER-SCALE. A `scaleY` distorts everything
                inside it; the content fades in over the back half so the
                squashed frames are the transparent ones. */}
            <div style={{
              padding: '18px 18px 22px',
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
      )}
    </div>
  )
}
