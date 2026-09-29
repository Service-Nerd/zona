'use client'

// STICKY-PROBE — a dev-only WebKit probe, not a product surface.
//
// 🔴 WHY IT EXISTS. The founder reports on an iPhone that pinned headers do not stay put
// ("Contact support ... no static header", "Your zones has a header but does not stay
// static on scroll"). The identical nesting sticks perfectly in desktop Blink, measured.
// The suspected difference is WebKit's treatment of `position: sticky` under an ancestor
// carrying `transform` / `will-change: transform` — which every screen has, because
// `PullToRefresh` wraps its children in exactly that to animate the pull.
//
// ⚠️ THIS PAGE SELF-REPORTS IN HUGE TEXT because the iOS Simulator tooling can screenshot
// but cannot run JavaScript for me. The page scrolls itself and prints the answer.
// Two boxes, identical except for the transform, so the comparison is within one engine.

import { useEffect, useRef, useState } from 'react'
import { notFound } from 'next/navigation'

function Box({ withTransform, onResult }: {
  withTransform: boolean
  onResult: (stuck: boolean, offset: number) => void
}) {
  const scroller = useRef<HTMLDivElement>(null)
  const header = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const sc = scroller.current, hd = header.current
    if (!sc || !hd) return
    sc.scrollTop = 600
    const t = setTimeout(() => {
      const off = Math.round(hd.getBoundingClientRect().top - sc.getBoundingClientRect().top)
      onResult(Math.abs(off) < 3, off)
    }, 400)
    return () => clearTimeout(t)
  }, [onResult])

  return (
    <div style={{ height: 200, overflow: 'hidden', display: 'flex', flexDirection: 'column',
                  border: '2px solid var(--ink)', marginBottom: 12 }}>
      <div ref={scroller} style={{ flex: 1, overflowY: 'auto', position: 'relative' }}>
        <div style={withTransform
          ? { transform: 'translateY(0px)', willChange: 'transform' }
          : undefined}>
          <div style={{ minHeight: '100%', display: 'flex', flexDirection: 'column' }}>
            <div ref={header}
                 style={{ position: 'sticky', top: 0, background: 'var(--bg-soft)', height: 44,
                          fontSize: 18, fontWeight: 700 }}>
              {withTransform ? 'WITH transform' : 'NO transform'}
            </div>
            <div style={{ height: 1600 }} />
          </div>
        </div>
      </div>
    </div>
  )
}

export default function StickyProbe() {
  if (process.env.NODE_ENV === 'production') notFound()
  const [a, setA] = useState<string>('…')
  const [b, setB] = useState<string>('…')
  return (
    <div style={{ padding: 16, fontFamily: 'system-ui' }}>
      <Box withTransform={false} onResult={(s, o) => setA(`${s ? 'STUCK' : 'SCROLLED AWAY'} (${o})`)} />
      <Box withTransform={true} onResult={(s, o) => setB(`${s ? 'STUCK' : 'SCROLLED AWAY'} (${o})`)} />
      <div style={{ fontSize: 26, fontWeight: 800, lineHeight: 1.4 }}>
        <div>NO transform: {a}</div>
        <div>WITH transform: {b}</div>
      </div>
    </div>
  )
}
