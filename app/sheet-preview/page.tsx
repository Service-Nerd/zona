// SHEET-ORIGIN-01 — the harness, and it now runs the REAL `Sheet`.
//
// 🔴 WHY THIS FILE WAS REWRITTEN. It used to draw its own panel inline,
// deliberately, so that "playing with it cannot move the app". That decision is
// precisely why a broken build reached the founder: I verified the COPY and
// shipped the ORIGINAL. Every value was right in the bundle and none of them
// ran, because `Sheet`'s render still owned `transform` and React overwrote the
// imperative write on every re-render.
//
// ⚠️ **A preview that does not import the thing it previews is testing a
// different program.** It imports `Sheet` now. If this page looks right, the app
// looks right, because it is the same component.

'use client'

import { useEffect, useRef, useState } from 'react'
import Sheet, { NavHeightProvider } from '@/components/shared/Sheet'

export default function SheetPreview() {
  const [open, setOpen] = useState<string | null>(null)

  /* 🔴 THE PREVIEW MUST PUBLISH THE NAV HEIGHT, OR IT IS NOT FAITHFUL.
   * `Sheet` reads the nav's measured OCCLUSION from context to decide where it
   * rests. Without a provider it falls back to 64px, and the panel sat 10px off
   * — measured 774 against the app's 764. A harness that differs from the app
   * by a magic fallback is the same trap as a harness that draws its own panel:
   * it verifies a program nobody ships. `DashboardClient` measures the real
   * pill with a ResizeObserver; this does the same. */
  const pillRef = useRef<HTMLDivElement>(null)
  const [navH, setNavH] = useState<number | null>(null)
  useEffect(() => {
    const el = pillRef.current
    if (!el) return
    const read = () => setNavH(Math.ceil(window.innerHeight - el.getBoundingClientRect().top))
    read()
    const ro = new ResizeObserver(read)
    ro.observe(el)
    window.addEventListener('resize', read)
    return () => { ro.disconnect(); window.removeEventListener('resize', read) }
  }, [])

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'var(--bg)', overflow: 'hidden',
                  maxWidth: 480, margin: '0 auto', display: 'flex', flexDirection: 'column' }}>
      <div style={{ flexShrink: 0, padding: '12px 16px', background: 'var(--card)', borderBottom: '1px solid var(--line)' }}>
        <div style={{ fontFamily: 'var(--font-brand)', fontSize: 15, fontWeight: 600, color: 'var(--ink)' }}>
          Sheet — the real one
        </div>
        <div style={{ fontFamily: 'var(--font-ui)', fontSize: 11, color: 'var(--mute)', marginTop: 3, lineHeight: 1.5 }}>
          This page imports `components/shared/Sheet`. What happens here is what happens in the app.
          Tap a card: the sheet grows out of <strong>that card</strong> and retracts into it.
        </div>
      </div>

      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '0 16px 150px' }}>
        {["This week\u2019s load", 'Hitting the zone', 'Why this session', 'Your training load balance'].map(t => (
          <button key={t} onClick={() => setOpen(t)}
            style={{ width: '100%', textAlign: 'left', font: 'inherit', cursor: 'pointer',
                     marginTop: 12, background: 'var(--card)', border: '1px solid var(--line)',
                     borderRadius: 14, padding: '18px 16px', boxShadow: 'var(--shadow-card)' }}>
            <div style={{ fontFamily: 'var(--font-ui)', fontSize: 10, fontWeight: 700, color: 'var(--mute)',
                          textTransform: 'uppercase', letterSpacing: '0.08em' }}>Tap to open</div>
            <div style={{ fontFamily: 'var(--font-ui)', fontSize: 15, fontWeight: 600, color: 'var(--ink)', marginTop: 4 }}>{t}</div>
          </button>
        ))}
      </div>

      {/* The real pill, so the sheet\u2019s foot has something to tuck behind. */}
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
        <NavHeightProvider value={navH}>
        <Sheet onClose={() => setOpen(null)} ariaLabel={open}>
          <div style={{ padding: '4px 18px 24px' }}>
            <div style={{ fontFamily: 'var(--font-brand)', fontSize: 18, fontWeight: 600, color: 'var(--ink)' }}>{open}</div>
            <div style={{ fontFamily: 'var(--font-ui)', fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.6, marginTop: 10 }}>
              Easy days easy, hard days hard. Enough body here to see the panel move as a whole
              object rather than a strip.
            </div>
          </div>
        </Sheet>
        </NavHeightProvider>
      )}
    </div>
  )
}
