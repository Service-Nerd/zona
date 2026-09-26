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

type Variant = 'opaque' | 'translucent' | 'onScroll' | 'compare'

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
  const [variant, setVariant] = useState<Variant>('onScroll')
  const [alpha, setAlpha] = useState(0.75)
  const [blur, setBlur] = useState(true)
  const [active, setActive] = useState<string>('today')
  const [scrolling, setScrolling] = useState(false)
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
    setScrolling(true)
    if (idle.current) window.clearTimeout(idle.current)
    idle.current = window.setTimeout(() => { setScrolling(false); measure() }, IDLE_MS)
    measure()
  }, [measure])

  useEffect(() => { measure() }, [measure, variant, scrolling])

  /**
   * 🔴 THE CONTRAST IS COMPUTED LIVE, AND AGAINST THE WORST REAL BACKDROP.
   * R181/G192/B180 is the darkest 20px-blurred strip sampled from the actual
   * Today screen — it is the band over the moss CTA, which is the one backdrop
   * nobody thinks to test. Measured floor: 0.70 holds 4.58:1; 0.60 drops to
   * 4.31 and fails. A whole-bar opacity fade fails at 0.9, which is why the
   * LABELS never fade here — only the ground does.
   */
  const WORST_BACKDROP: [number, number, number] = [181, 192, 180]
  const lin = (c: number) => { const x = c / 255; return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4 }
  const lum = (p: number[]) => 0.2126 * lin(p[0]!) + 0.7152 * lin(p[1]!) + 0.0722 * lin(p[2]!)
  const contrast = (fg: number[], bg: number[]) => {
    const a = lum(fg), b = lum(bg); const hi = Math.max(a, b), lo = Math.min(a, b)
    return (hi + 0.05) / (lo + 0.05)
  }
  const effAlpha = variant === 'opaque' ? 1 : variant === 'translucent' ? alpha
                 : variant === 'compare' ? alpha
                 : (scrolling ? alpha : 1)
  const ground = WORST_BACKDROP.map((c, i) => Math.round(255 * effAlpha + c * (1 - effAlpha)))
  const labelRatio = contrast([0x6D, 0x69, 0x63], ground)

  // Reduced motion collapses the DURATION, never the BEHAVIOUR. The clearance
  // must still arrive for a runner who has motion turned off — that is exactly
  // why the scroll-fade could not be the only remedy.
  const motion = reduce ? '0s' : 'var(--motion-ui)'
  const floating = true

  return (
    <div style={{ position: 'fixed', inset: 0, display: 'flex', flexDirection: 'column', background: 'var(--bg)' }}>

      {/* ── the controls, deliberately outside the phone frame ── */}
      <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--line)', background: 'var(--card)' }}>
        <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
          {([['opaque','Opaque'],['translucent','Translucent'],['onScroll','On scroll'],['compare','A/B']] as [Variant,string][]).map(([v,lab]) => (
            <button key={v} onClick={() => setVariant(v)} className={`btn btn--compact ${variant === v ? 'btn--primary' : 'btn--secondary'}`} style={{ flex: 1, fontSize: 11 }}>
              {lab}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
          <label style={{ fontFamily: 'var(--font-ui)', fontSize: 12, color: 'var(--ink-2)', whiteSpace: 'nowrap' }}>
            opacity {alpha.toFixed(2)}
          </label>
          <input type="range" min={0.5} max={1} step={0.05} value={alpha}
                 onChange={e => setAlpha(parseFloat(e.target.value))}
                 disabled={variant === 'opaque'} style={{ flex: 1 }} />
          <label style={{ display: 'flex', alignItems: 'center', gap: 5, fontFamily: 'var(--font-ui)', fontSize: 12, color: 'var(--ink-2)' }}>
            <input type="checkbox" checked={blur} onChange={e => setBlur(e.target.checked)} /> blur
          </label>
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontFamily: 'var(--font-ui)', fontSize: 12, color: 'var(--ink-2)' }}>
          <input type="checkbox" checked={reduce} onChange={e => setReduce(e.target.checked)} />
          Simulate <code>prefers-reduced-motion</code>
        </label>
        <div style={{ marginTop: 8, fontFamily: 'var(--font-ui)', fontSize: 12, color: 'var(--ink)', fontVariantNumeric: 'tabular-nums', lineHeight: 1.6 }}>
          painted chrome <strong>{readout.chrome}px</strong> · CTA hidden <strong>{readout.hidden}px</strong><br />
          pill right now: <strong>{effAlpha === 1 ? 'OPAQUE' : `translucent ${effAlpha.toFixed(2)}${blur ? ' + blur' : ' · NO BLUR'}`}</strong><br />
          label contrast over the worst real backdrop:{' '}
          <strong style={{ color: labelRatio >= 4.5 ? 'var(--moss-strong)' : 'var(--danger)' }}>
            {labelRatio.toFixed(2)}:1
          </strong>{' '}
          <span style={{ color: 'var(--mute)' }}>
            (AA needs 4.5 · floor is 0.70{!blur && ' · ⚠ WITHOUT BLUR this number is meaningless, the backdrop is moving content'})
          </span>
        </div>
      </div>

      {/* ── the scrolling screen ── */}
      <div ref={scrollRef} onScroll={onScroll} style={{ flex: 1, overflowY: 'auto', position: 'relative', padding: '0 20px', paddingBottom: 26 }}>
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
        {/* 🔴 CONTENT MUST PASS *UNDER* THE PILL OR THERE IS NOTHING TO SEE
            THROUGH IT. The first cut reserved 140px of bottom padding, so the
            pill floated over empty `--bg` and every variant looked identical —
            which is exactly what the founder reported. Measured: white at 0.75
            over flat `--bg` is a **5-level** change (invisible); over the moss
            CTA it is **19 levels** (obvious). The one backdrop that shows the
            effect was the one the pill never sat over. Third time today a probe
            could not reach the state it was built to demonstrate. */}
        <div style={{ marginTop: 16, background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 14, padding: 16, boxShadow: 'var(--shadow-card)' }}>
          <div style={{ fontFamily: 'var(--font-ui)', fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>Scroll on.</div>
          <div style={{ fontFamily: 'var(--font-ui)', fontSize: 13, color: 'var(--mute)', marginTop: 4, lineHeight: 1.5 }}>
            Watch the pill as the green button and the amber coach card pass beneath it. Over flat
            background there is nothing to see through — that is the palette, not the code.
          </div>
        </div>
        <button className="btn btn--primary btn--regular btn--full" style={{ marginTop: 12 }}>A second green block, to scroll under</button>
        <div style={{ marginTop: 12, background: 'var(--warn-bg)', borderLeft: '3px solid var(--warn)', borderRadius: 14, padding: '18px 16px', fontFamily: 'var(--font-ui)', fontSize: 14, color: 'var(--ink)', lineHeight: 1.5 }}>
          An amber block, to scroll under. Against this and the green, a translucent pill is a
          15–19 level change. Against the page ground it is 5, which your eye reads as nothing.
        </div>
        <button className="btn btn--primary btn--regular btn--full" style={{ marginTop: 12 }}>And one more</button>
        <div style={{ height: 120 }} />
      </div>

      {/* 🔴 A/B MODE EXISTS BECAUSE A 19-LEVEL DIFFERENCE IS INVISIBLE FROM
          MEMORY. The founder toggled opaque against translucent and reported
          that neither did anything — and he was right about the experience even
          though the CSS was correct: you cannot hold a near-white against
          another near-white across a button press. Side by side over the SAME
          backdrop it is obvious. **If a difference needs A/B to be seen at all,
          that is itself the finding.** */}
      {variant === 'compare' && (
        <div style={{
          position: 'fixed', left: '50%', transform: 'translateX(-50%)',
          bottom: 'calc(86px + env(safe-area-inset-bottom, 0px))',
          width: 'calc(100% - 32px)', maxWidth: 448,
          display: 'flex', alignItems: 'stretch',
          background: 'rgb(255,255,255)',
          border: '1px solid var(--line)', borderRadius: 999,
          boxShadow: 'var(--shadow-lifted)', overflow: 'hidden', zIndex: 3000,
        }}>
          {TABS.map(t => (
            <div key={t.id} style={{
              flex: 1, minHeight: 60, display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center', gap: 3,
              fontFamily: 'var(--font-ui)', fontSize: 11,
              color: active === t.id ? 'var(--moss-strong)' : 'var(--mute)',
            }}>
              <Glyph id={t.id} active={active === t.id} /><span>{t.label}</span>
            </div>
          ))}
          <span style={{ position: 'absolute', right: 10, top: 4, fontFamily: 'var(--font-ui)', fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', color: 'var(--mute)' }}>OPAQUE</span>
        </div>
      )}

      {/* ── the chrome under test ── */}
      {/* ⚠️ THE GROUND GOES TRANSLUCENT, THE LABELS NEVER DO (Silvanto, binding).
          Fading the whole bar is what "a bit translucent" means to most people
          and it takes the label to 4.47:1 at 0.9 — below AA before the change is
          even perceptible. Translucency is a property of the MATERIAL. Blur is
          load-bearing, not decoration: without it the backdrop is moving content
          and no fixed ratio can be claimed, which is why the fallback is OPAQUE
          and never translucent-without-blur. */}
      <div
        ref={chromeRef}
        style={{
          position: 'fixed', left: '50%', transform: 'translateX(-50%)',
          bottom: 'calc(12px + env(safe-area-inset-bottom, 0px))',
          width: 'calc(100% - 32px)', maxWidth: 448,
          display: 'flex', alignItems: 'stretch',
          background: `rgba(255,255,255,${effAlpha})`,
          backdropFilter: blur && effAlpha < 1 ? 'blur(20px) saturate(1.6)' : undefined,
          WebkitBackdropFilter: blur && effAlpha < 1 ? 'blur(20px) saturate(1.6)' : undefined,
          border: '1px solid var(--line)',
          borderRadius: 999,
          boxShadow: 'var(--shadow-lifted)',
          overflow: 'hidden',
          // ⚠️ OUT SLOWLY, BACK FAST (Wroblewski) — 150ms out, 90ms back. Going
          // translucent may be leisurely; returning must feel instant or the
          // runner reaches for a tab that is not solid yet.
          //
          // 🔴 THE DURATION RIDES A CUSTOM PROPERTY AND THAT IS NOT STYLE. The
          // first cut interpolated the duration straight into the `transition`
          // shorthand — `background ${scrolling ? '150ms' : '90ms'} ease-out` —
          // and **changing the transition DECLARATION mid-flight cancels the
          // transition**, so the background stayed pinned at its start value:
          // the inline style read `rgba(255,255,255,0.75)` while the computed
          // style read opaque `rgb(255,255,255)`. It looked wired and rendered
          // nothing. The shorthand string must be CONSTANT; only the variable
          // inside it may change.
          ['--nav-dur' as string]: reduce ? '0s' : (scrolling ? '150ms' : '90ms'),
          transition: 'background var(--nav-dur) ease-out, backdrop-filter var(--nav-dur) ease-out',
          zIndex: 3000,
        }}
      >
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setActive(t.id)}
            aria-current={active === t.id ? 'page' : undefined}
            style={{
              flex: 1, minHeight: 60, padding: 0, border: 'none', background: 'none', cursor: 'pointer',
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 3,
              fontFamily: 'var(--font-ui)', fontSize: 11,
              // The LABEL is never faded. This is the whole ruling in one line.
              color: active === t.id ? 'var(--moss-strong)' : 'var(--mute)',
            }}
          >
            <Glyph id={t.id} active={active === t.id} />
            <span>{t.label}</span>
          </button>
        ))}
        {variant === 'compare' && (
          <span style={{ position: 'absolute', right: 10, top: 4, fontFamily: 'var(--font-ui)', fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', color: 'var(--mute)' }}>
            {alpha.toFixed(2)}
          </span>
        )}
      </div>
    </div>
  )
}
