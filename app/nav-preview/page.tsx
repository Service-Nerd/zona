// NAV-COLLAPSE-01 / NAV-FLOAT-01 — the mock-up the founder asked for before any
// build. Design Board ruled NAV-COLLAPSE-01 SHIP and TODAY-V2 INSUFFICIENT
// EVIDENCE; this is the artefact for the first and a probe for the second.
//
// ⚠️ THIS IS A PROTOTYPE AND SHIPS NOTHING. It is not on the nav, nothing links
// to it, and it deliberately reimplements the chrome inline rather than
// importing the live `.nav-bar` — so playing with it cannot move the app.
//
// 🔴 IT CARRIES A LIVE READOUT ON PURPOSE. Every nav decision this session was
// argued from impressions and settled by a measurement, twice in the founder's
// favour and twice against my own code. The panel shows, per variant: the
// chrome's painted height, and how much of "Log this session" is behind it at
// the current scroll. **Compare the numbers, not the vibe.**
//
// ⚠️ WHAT THIS MOCK DOES NOT DO, stated because the last thing I verified in a
// probe was verified in the wrong state: it does not reproduce Today's real
// content heights (22 conditional blocks — the hero, coach note and pending
// adjustment are approximated), and nothing here has been felt on a device.

'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

type Variant = 'bar' | 'pill' | 'collapse'

const TABS = [
  { id: 'today', label: 'Today' },
  { id: 'plan', label: 'Plan' },
  { id: 'coach', label: 'Coach' },
  { id: 'me', label: 'Me' },
] as const

function Glyph({ id, active }: { id: string; active: boolean }) {
  const c = active ? 'var(--moss-strong)' : 'var(--mute)'
  if (id === 'today') return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden>
      <rect x="3" y="11" width="4" height="8" rx="1" fill={c} />
      <rect x="9" y="7" width="4" height="12" rx="1" fill={c} />
      <rect x="15" y="4" width="4" height="15" rx="1" fill={c} />
    </svg>
  )
  if (id === 'plan') return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden>
      <rect x="3" y="5" width="16" height="14" rx="3" stroke={c} strokeWidth="1.6" />
      <path d="M3 9h16M7 3v4M15 3v4" stroke={c} strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  )
  if (id === 'coach') return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden>
      <circle cx="11" cy="7" r="3.4" stroke={c} strokeWidth="1.6" />
      <path d="M4.5 19a6.5 6.5 0 0113 0" stroke={c} strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  )
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden>
      <circle cx="11" cy="7.5" r="3.6" stroke={c} strokeWidth="1.6" />
      <path d="M4 19c1.6-3.6 4-5.4 7-5.4s5.4 1.8 7 5.4" stroke={c} strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  )
}

export default function NavPreview() {
  const [variant, setVariant] = useState<Variant>('collapse')
  const [active, setActive] = useState<string>('today')
  const [collapsed, setCollapsed] = useState(false)
  const [reduce, setReduce] = useState(false)
  const [readout, setReadout] = useState({ chrome: 0, hidden: 0 })

  const scrollRef = useRef<HTMLDivElement>(null)
  const ctaRef = useRef<HTMLButtonElement>(null)
  const chromeRef = useRef<HTMLDivElement>(null)
  const idle = useRef<number | null>(null)

  // ⚠️ SCROLL-STOP, NOT SCROLL-DIRECTION (Wroblewski, at the sitting). A
  // direction-triggered nav flickers when a thumb nudges the list; an idle
  // timer does not. 150ms is his starting number: long enough not to strobe,
  // short enough to feel like it is tracking you.
  const IDLE_MS = 150

  const measure = useCallback(() => {
    const cta = ctaRef.current?.getBoundingClientRect()
    const chrome = chromeRef.current?.getBoundingClientRect()
    if (!cta || !chrome) return
    setReadout({
      chrome: Math.round(window.innerHeight - chrome.top),
      hidden: Math.max(0, Math.round(cta.bottom - chrome.top)),
    })
  }, [])

  const onScroll = useCallback(() => {
    if (variant === 'collapse') setCollapsed(true)
    if (idle.current) window.clearTimeout(idle.current)
    idle.current = window.setTimeout(() => { setCollapsed(false); measure() }, IDLE_MS)
    measure()
  }, [variant, measure])

  useEffect(() => { measure() }, [measure, variant, collapsed])
  useEffect(() => { if (variant !== 'collapse') setCollapsed(false) }, [variant])

  // Reduced motion collapses the DURATION, never the BEHAVIOUR. The clearance
  // must still arrive for a runner who has motion turned off — that is exactly
  // why the scroll-fade could not be the only remedy.
  const motion = reduce ? '0s' : 'var(--motion-ui)'
  const isCollapsed = variant === 'collapse' && collapsed
  const floating = variant !== 'bar'

  return (
    <div style={{ position: 'fixed', inset: 0, display: 'flex', flexDirection: 'column', background: 'var(--bg)' }}>

      {/* ── the controls, deliberately outside the phone frame ── */}
      <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--line)', background: 'var(--card)' }}>
        <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
          {(['bar', 'pill', 'collapse'] as Variant[]).map(v => (
            <button key={v} onClick={() => setVariant(v)} className={`btn btn--compact ${variant === v ? 'btn--primary' : 'btn--secondary'}`} style={{ flex: 1 }}>
              {v === 'bar' ? 'A · shipped bar' : v === 'pill' ? 'B · pill' : 'C · pill + collapse'}
            </button>
          ))}
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontFamily: 'var(--font-ui)', fontSize: 12, color: 'var(--ink-2)' }}>
          <input type="checkbox" checked={reduce} onChange={e => setReduce(e.target.checked)} />
          Simulate <code>prefers-reduced-motion</code> — the collapse must still happen, instantly
        </label>
        <div style={{ marginTop: 8, fontFamily: 'var(--font-ui)', fontSize: 12, color: 'var(--ink)', fontVariantNumeric: 'tabular-nums' }}>
          chrome <strong>{readout.chrome}px</strong> · &ldquo;Log this session&rdquo; hidden behind it:{' '}
          <strong style={{ color: readout.hidden > 0 ? 'var(--danger)' : 'var(--moss-strong)' }}>{readout.hidden}px</strong>
        </div>
      </div>

      {/* ── the scrolling screen ── */}
      <div ref={scrollRef} onScroll={onScroll} style={{ flex: 1, overflowY: 'auto', position: 'relative', padding: '0 20px', paddingBottom: 140 }}>
        <div style={{ fontFamily: 'var(--font-ui)', fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', color: 'var(--mute)', padding: '18px 0 10px' }}>BASE · WEEK 1</div>
        <div style={{ fontFamily: 'var(--font-ui)', fontSize: 15, color: 'var(--ink-2)' }}>Good evening, Russ</div>
        <div style={{ fontFamily: 'var(--font-brand)', fontSize: 58, fontWeight: 700, letterSpacing: '-2px', lineHeight: 1.02, color: 'var(--ink)', marginTop: 4 }}>
          8km,<br /><span style={{ color: 'var(--moss-strong)' }}>slowly.</span>
        </div>

        <div style={{ marginTop: 22, background: 'var(--warn-bg)', borderLeft: '3px solid var(--warn)', borderRadius: 14, padding: '14px 16px' }}>
          <div style={{ fontFamily: 'var(--font-ui)', fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', color: 'var(--warn)' }}>KIT · YOUR COACH</div>
          <div style={{ fontFamily: 'var(--font-ui)', fontSize: 15, color: 'var(--ink)', lineHeight: 1.45, marginTop: 6 }}>
            Nothing from the last few days to go on. Start easy and find your legs before you push them.
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 22 }}>
          {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
            <div key={i} style={{ textAlign: 'center', fontFamily: 'var(--font-ui)', fontSize: 12, color: i === 4 ? 'var(--card)' : 'var(--mute)' }}>
              <div>{d}</div>
              <div style={{ marginTop: 6, width: 30, height: 30, lineHeight: '30px', borderRadius: '50%', background: i === 4 ? 'var(--moss-strong)' : 'transparent' }}>{21 + i}</div>
            </div>
          ))}
        </div>

        <div style={{ fontFamily: 'var(--font-ui)', fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', color: 'var(--mute)', marginTop: 26 }}>TODAY&rsquo;S SESSION</div>
        <div style={{ marginTop: 10, background: 'var(--bg-soft)', borderRadius: 12, padding: '12px 14px', fontFamily: 'var(--font-ui)', fontSize: 13, color: 'var(--ink-2)' }}>
          <strong style={{ fontSize: 11, letterSpacing: '0.08em', color: 'var(--mute)' }}>LAST 10 SIMILAR EASY RUNS</strong>
          <div style={{ marginTop: 4 }}>137 bpm avg · 51% in zone</div>
        </div>
        <div style={{ marginTop: 12, background: 'var(--card)', border: '1px solid var(--line)', borderLeft: '3px solid var(--s-easy)', borderRadius: 14, padding: '16px 16px', boxShadow: 'var(--shadow-card)' }}>
          <div style={{ fontFamily: 'var(--font-brand)', fontSize: 17, fontWeight: 600, color: 'var(--ink)' }}>Easy run — Zone 2</div>
          <div style={{ fontFamily: 'var(--font-ui)', fontSize: 13, color: 'var(--mute)', marginTop: 4 }}>Zone 2 · &lt; 145 bpm · 5:53 /km or slower</div>
        </div>
        <div style={{ display: 'flex', gap: 3, marginTop: 12 }}>
          {[0, 1, 2, 3, 4].map(i => <div key={i} style={{ flex: 1, height: 6, borderRadius: 3, background: i === 1 ? 'var(--s-easy)' : 'var(--line)' }} />)}
        </div>

        <button ref={ctaRef} className="btn btn--primary btn--regular btn--full" style={{ marginTop: 12 }}>Log this session</button>
        <button className="btn btn--secondary btn--compact btn--full" style={{ marginTop: 8 }}>Log manually</button>
        <div style={{ height: 40 }} />
      </div>

      {/* ── the chrome under test ── */}
      <div
        ref={chromeRef}
        style={{
          position: 'fixed', left: '50%', transform: 'translateX(-50%)',
          bottom: floating ? 'calc(12px + env(safe-area-inset-bottom, 0px))' : 0,
          width: floating ? (isCollapsed ? '76px' : 'calc(100% - 32px)') : '100%',
          maxWidth: 480,
          display: 'flex', alignItems: 'stretch', justifyContent: 'center',
          background: 'var(--nav-bg)',
          border: floating ? '1px solid var(--line)' : 'none',
          borderTop: floating ? '1px solid var(--line)' : '1px solid var(--line)',
          borderRadius: floating ? 999 : 0,
          boxShadow: floating ? 'var(--shadow-lifted)' : 'none',
          paddingBottom: floating ? 0 : 'env(safe-area-inset-bottom, 0px)',
          overflow: 'hidden',
          transition: `width ${motion}, border-radius ${motion}, bottom ${motion}`,
          zIndex: 3000,
        }}
      >
        {TABS.map(t => {
          const show = !isCollapsed || t.id === active
          return (
            <button
              key={t.id}
              onClick={() => { setActive(t.id); setCollapsed(false) }}
              aria-current={active === t.id ? 'page' : undefined}
              style={{
                flex: show ? 1 : 0,
                width: show ? undefined : 0,
                minWidth: show ? (isCollapsed ? 76 : undefined) : 0,
                minHeight: 60, padding: 0, border: 'none', background: 'none', cursor: 'pointer',
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 3,
                fontFamily: 'var(--font-ui)', fontSize: 11,
                color: active === t.id ? 'var(--moss-strong)' : 'var(--mute)',
                opacity: show ? 1 : 0,
                transition: `opacity ${motion}, flex ${motion}`,
                overflow: 'hidden', whiteSpace: 'nowrap',
              }}
            >
              <Glyph id={t.id} active={active === t.id} />
              <span style={{ display: isCollapsed ? 'none' : 'block' }}>{t.label}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
