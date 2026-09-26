// SHEET-ORIGIN-01 — the preview the founder asked for, before anything ships.
//
// Founder: "I'd absolutely love it if all our pop-ups loaded as if they came out
// of the nav pill, then retracted back into it when closing. Would be great if
// we could make it wobble a little too. **I'd like to see it.**"
//
// 🔴 IT SHOWS THREE ORIGINS, NOT ONE, AND THAT IS THE BOARD'S DOING. The runner
// never taps the nav pill — they tap a card, a chip, an "i" mark. A sheet that
// emerges from the pill is pretty and attributes itself to a control the runner
// did not touch. Silvanto: "a transition that names the wrong parent is a worse
// lie than no transition." So: bottom (today) · pill (asked for) · the tapped
// control (honest). The founder judges the brief against its alternative.
//
// ⚠️ SHIPS NOTHING. The panel is drawn inline rather than importing `Sheet`, so
// playing with it cannot move the app.
//
// ⚠️ BUILT AGAINST `NAV-TRANSLUCENT-01`'s LESSON — "a mock that could not show
// the effect it was built to show". That one floated over EMPTY GROUND, the one
// backdrop where the effect was invisible. This opens over real cards with a
// real pill in place, and the trigger is a control you actually tap, so the
// tap-origin case has something true to animate from.

'use client'

import { useCallback, useLayoutEffect, useRef, useState } from 'react'

type Origin = 'bottom' | 'pill' | 'tap'
type Spring = 'none' | 'overshoot' | 'wobble'

const EASE: Record<Spring, string> = {
  none:      'cubic-bezier(0.32, 0.72, 0, 1)',    // what ships today
  overshoot: 'cubic-bezier(0.34, 1.40, 0.64, 1)', // one pass beyond, settles
  wobble:    'cubic-bezier(0.18, 1.70, 0.40, 1)', // further over, more visible
}

export default function SheetPreview() {
  const [origin, setOrigin] = useState<Origin>('pill')
  const [spring, setSpring] = useState<Spring>('overshoot')
  const [ms, setMs] = useState(380)
  const [open, setOpen] = useState(false)
  const [shown, setShown] = useState(false)

  const pillRef  = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const fromRect = useRef<DOMRect | null>(null)

  /** The closed transform: shrink the panel onto the origin's rect.
   *
   * 🔴 THE PANEL MUST BE MEASURED UNTRANSFORMED, and the first version was not.
   * `getBoundingClientRect()` returns the TRANSFORMED box, and the panel already
   * carries `translateY(100%)` when this runs — so every translate came out
   * 225px short and the sheet would have flown to the wrong place. Caught by
   * printing the rects rather than watching it, which is just as well: the
   * browser pane is hidden here, `requestAnimationFrame` never fires, and the
   * animation could not be seen at all. The numbers were the only witness. */
  const closedTransform = (): string => {
    const panel = panelRef.current
    if (!panel || origin === 'bottom') return 'translateY(100%)'
    const r = origin === 'pill' ? pillRef.current?.getBoundingClientRect() : fromRect.current
    if (!r) return 'translateY(100%)'
    // 🔴 DERIVED, NOT MEASURED, AND THAT IS THE SECOND FIX HERE.
    // Attempt 1 read `getBoundingClientRect()` — which returns the TRANSFORMED
    // box, and the panel already carries `translateY(100%)`, so every translate
    // came out 225px short. Attempt 2 cleared `transform` before reading —
    // which STARTS A 380ms TRANSITION to none, so the rect was still mid-flight
    // and read the same wrong number.
    //
    // The panel is `left:0; right:0; bottom:0; margin:0 auto; maxWidth:480`
    // inside a `position:fixed; inset:0`, so its laid-out box is derivable and
    // needs no measurement at all: `offsetHeight` is transform-independent.
    // ⚠️ Twice in a row the MEASUREMENT was the bug rather than the thing
    // measured — worth remembering before trusting a rect on a moving element.
    const pw = Math.min(480, window.innerWidth)
    const p = {
      left: (window.innerWidth - pw) / 2,
      top: window.innerHeight - panel.offsetHeight,
      width: pw,
      height: panel.offsetHeight,
    }
    const sx = Math.max(r.width  / p.width,  0.05)
    const sy = Math.max(r.height / p.height, 0.02)
    const dx = (r.left + r.width  / 2) - (p.left + p.width  / 2)
    const dy = (r.top  + r.height / 2) - (p.top  + p.height / 2)
    return `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})`
  }

  const openFrom = useCallback((el: HTMLElement | null) => {
    fromRect.current = el?.getBoundingClientRect() ?? null
    setOpen(true)
  }, [])

  /* 🔴 THE ORIGIN NEVER APPLIED, AND THIS IS WHY. React renders `{open && …}`,
   * and on THAT render `panelRef.current` is still null — so `closedTransform()`
   * returned its `translateY(100%)` fallback every single time and all three
   * variants were showing today's animation. The preview looked like it worked.
   *
   * ⚠️ It is not fixable in the render: the panel must EXIST to be measured, and
   * the closed transform must be painted BEFORE the open one or there is nothing
   * to transition from. So the first frame is driven imperatively in a layout
   * effect — write the closed state with transitions off, force a reflow, then
   * turn transitions on and release. This is what a real implementation has to
   * do too, which is the whole point of building the preview first. */
  useLayoutEffect(() => {
    if (!open) return
    const panel = panelRef.current
    if (!panel) return
    panel.style.transition = 'none'
    panel.style.transform = closedTransform()
    panel.style.opacity = '0.4'
    void panel.offsetHeight                       // flush the closed frame
    requestAnimationFrame(() => {
      panel.style.transition = `transform ${ms}ms ${EASE[spring]}, opacity ${Math.round(ms * 0.6)}ms ease`
      setShown(true)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const close = () => {
    const panel = panelRef.current
    if (panel) {
      panel.style.transition = `transform ${ms}ms ${EASE[spring]}, opacity ${Math.round(ms * 0.6)}ms ease`
      panel.style.transform = closedTransform()   // retracts to the SAME origin
      panel.style.opacity = '0.4'
    }
    setShown(false)
    setTimeout(() => setOpen(false), ms)
  }

  const seg = <T extends string>(label: string, value: T, set: (v: T) => void, opts: readonly T[]) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
      <span style={{ fontFamily: 'var(--font-ui)', fontSize: 11, color: 'var(--mute)', width: 50, flexShrink: 0 }}>{label}</span>
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
        {opts.map(o => (
          <button key={o} onClick={() => set(o)}
            className={`btn btn--compact ${value === o ? 'btn--primary' : 'btn--secondary'}`}
            style={{ fontSize: 11 }}>{o}</button>
        ))}
      </div>
    </div>
  )

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'var(--bg)', overflow: 'hidden', maxWidth: 480, margin: '0 auto' }}>
      <div style={{ padding: '10px 16px', background: 'var(--card)', borderBottom: '1px solid var(--line)' }}>
        <div style={{ fontFamily: 'var(--font-brand)', fontSize: 15, fontWeight: 600, color: 'var(--ink)' }}>Sheet origin &amp; spring</div>
        <div style={{ fontFamily: 'var(--font-ui)', fontSize: 11, color: 'var(--mute)', marginTop: 3, lineHeight: 1.5 }}>
          <strong>pill</strong> is what you asked for. <strong>tap</strong> comes out of the control you
          actually touched — the board&rsquo;s point is that the runner never taps the nav.
        </div>
        {seg('origin', origin, setOrigin, ['bottom', 'pill', 'tap'] as const)}
        {seg('spring', spring, setSpring, ['none', 'overshoot', 'wobble'] as const)}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8 }}>
          <span style={{ fontFamily: 'var(--font-ui)', fontSize: 11, color: 'var(--mute)', width: 50 }}>{ms}ms</span>
          <input type="range" min={220} max={700} step={20} value={ms}
                 onChange={e => setMs(parseInt(e.target.value, 10))} style={{ flex: 1 }} />
        </div>
      </div>

      <div style={{ position: 'absolute', inset: '162px 0 0', overflowY: 'auto', padding: '0 16px 150px' }}>
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
            position: 'absolute', left: 0, right: 0, bottom: 0,
            maxWidth: 480, margin: '0 auto',
            background: 'var(--card)', borderRadius: '20px 20px 0 0',
            boxShadow: '0 -8px 24px rgba(0,0,0,0.12)',
            maxHeight: '70vh', padding: '8px 18px 28px',
            transformOrigin: 'center center',
            // ⚠️ The OPEN state only. The closed first frame is written by the
            // layout effect above, because the panel cannot be measured until it
            // exists. Setting it here is what made every origin fall back.
            ...(shown ? {
              transform: 'translate(0,0) scale(1,1)',
              opacity: 1,
              transition: `transform ${ms}ms ${EASE[spring]}, opacity ${Math.round(ms * 0.6)}ms ease`,
            } : {}),
          }}>
            <div style={{ width: 36, height: 4, background: 'var(--line)', borderRadius: 2, margin: '6px auto 18px' }} />
            <div style={{ fontFamily: 'var(--font-brand)', fontSize: 18, fontWeight: 600, color: 'var(--ink)' }}>Your training load balance</div>
            <div style={{ fontFamily: 'var(--font-ui)', fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.6, marginTop: 10 }}>
              Easy days easy, hard days hard. Enough body here to see the panel move as a whole
              object rather than a strip.
            </div>
            <button onClick={close} className="btn btn--secondary btn--compact" style={{ width: '100%', marginTop: 18 }}>Close</button>
          </div>
        </div>
      )}
    </div>
  )
}
