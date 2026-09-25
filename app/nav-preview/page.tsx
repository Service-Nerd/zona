// NAV-FLOAT-01 — the side-by-side the Design Board asked for before it will
// rule. Ruling was INSUFFICIENT EVIDENCE, with three named conditions, and this
// page exists to discharge the first:
//
//   1. the two navs on a DEVICE, at 375pt, over scrolling content — because the
//      whole question is what content looks like passing a floating object
//   2. the shadow: a pill needs separation, and `ui-patterns.md:359`'s "you feel
//      it, you don't see it" is hardest to satisfy over content that MOVES
//   3. hide-on-scroll: always-visible eats more content than the bar it
//      replaces; hiding invents a second question — when does it come back?
//
// ⚠️ THIS IS A PREVIEW, NOT A PROPOSAL. `ui-patterns.md:359` says chrome is
// "a top hairline, not a floating card". Collins argued that rule was written
// about cards and never contemplated a floating nav; Silvanto named it and
// declined to veto. Nothing here is shipped, and the pill is deliberately given
// its best shot rather than a straw man — a weak mock would settle nothing.
//
// ⚠️ Scroll it. Both navs sit over the SAME content on purpose: the stacked
// comparison is the only way to see the thing the board split on, which is the
// number of edges of moving content each one creates. The bar has one horizon
// line. The pill has content visible left, right and beneath it.

'use client'

import { useState } from 'react'
import NavTab from '@/components/ui/NavTab'
import Button from '@/components/ui/Button'

const TABS = ['Today', 'Plan', 'Coach', 'Me'] as const

function Glyph({ active }: { active: boolean }) {
  const c = active ? 'var(--moss)' : 'var(--mute)'
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden>
      <rect x="3" y="11" width="4" height="8" rx="1" fill={c} />
      <rect x="9" y="7" width="4" height="12" rx="1" fill={c} />
      <rect x="15" y="4" width="4" height="15" rx="1" fill={c} />
    </svg>
  )
}

export default function NavPreview() {
  const [active, setActive] = useState<string>('Today')
  const [shadow, setShadow] = useState(true)

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <div style={{ maxWidth: '480px', margin: '0 auto', padding: '20px 20px 220px' }}>
        <h1 style={{ fontFamily: 'var(--font-brand)', fontSize: '22px', fontWeight: 600, color: 'var(--ink)', letterSpacing: '-0.4px' }}>
          Nav: bar vs pill
        </h1>
        <p style={{ fontFamily: 'var(--font-ui)', fontSize: '13px', color: 'var(--mute)', lineHeight: 1.6, marginTop: '8px' }}>
          Both sit over this content. Scroll and watch what happens at the edges: the bar has
          one horizon line, the pill has content passing on three sides. That is the thing the
          board split on.
        </p>

        <Button variant="secondary" size="compact" onClick={() => setShadow(s => !s)} style={{ marginTop: '16px' }}>
          Pill shadow: {shadow ? 'on' : 'off'}
        </Button>
        <p style={{ fontFamily: 'var(--font-ui)', fontSize: '12px', color: 'var(--mute)', lineHeight: 1.6, marginTop: '8px' }}>
          Condition 2. With it off the pill floats with nothing holding it up; with it on, look at
          whether the shadow stays still while the content moves under it.
        </p>

        {Array.from({ length: 14 }, (_, i) => (
          <div key={i} className="card-data" style={{
            marginTop: '12px', padding: '16px', background: 'var(--card)',
            border: '1px solid var(--line)', borderRadius: 'var(--radius-lg)',
            boxShadow: 'var(--shadow-card)',
          }}>
            <div style={{ fontFamily: 'var(--font-ui)', fontSize: '13px', fontWeight: 600, color: 'var(--ink)' }}>
              Easy run — Zone 2
            </div>
            <div style={{ fontFamily: 'var(--font-ui)', fontSize: '12px', color: 'var(--mute)', marginTop: '2px' }}>
              Zone 2 · &lt; 145 bpm · 5:53 /km or slower
            </div>
          </div>
        ))}
      </div>

      {/* ── B. THE PILL — NAV-FLOAT-01, not shipped ── */}
      <div style={{
        position: 'fixed', left: '50%', transform: 'translateX(-50%)',
        bottom: `calc(76px + env(safe-area-inset-bottom, 0px))`,
        width: 'calc(100% - 32px)', maxWidth: '343px',
        background: 'var(--nav-bg)',
        border: '1px solid var(--line)',
        borderRadius: '999px',
        boxShadow: shadow ? 'var(--shadow-lifted)' : 'none',
        display: 'flex', alignItems: 'stretch', overflow: 'hidden',
        zIndex: 3001,
      }}>
        {TABS.map(t => (
          <NavTab key={t} label={t} icon={<Glyph active={active === t} />} active={active === t} onClick={() => setActive(t)} />
        ))}
      </div>

      {/* ── A. THE SHIPPED BAR at its new 60px ── */}
      <div className="nav-bar" style={{
        position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)',
        width: '100%', maxWidth: '480px', zIndex: 3000,
      }}>
        {TABS.map(t => (
          <NavTab key={t} label={t} icon={<Glyph active={active === t} />} active={active === t} onClick={() => setActive(t)} />
        ))}
      </div>
    </div>
  )
}
