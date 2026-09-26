// NAV-EDGE-01 — the A/B the founder asked for after the tint was abandoned.
//
// 🔴 WHY THE EDGE AND NOT THE FILL. Measured: `--bg` sits BETWEEN white and any
// AA-safe darker tint, so a fill lighter than the ground vanishes on cards and a
// fill darker vanishes on the ground. The best any single fill manages is **10
// levels vs the ground and 8 vs a card** — ~3%, and the founder confirmed he
// could not see it in the material A/B. **The BORDER separates by 17 levels over
// the ground and 18 over a card, against BOTH, which is roughly twice what the
// best fill can do.** The fill was never what made the pill read as an object.
//
// ⚠️ SHIPS NOTHING. Both pills are drawn inline rather than importing
// `.nav-bar--floating`, so playing with it cannot move the app. The app's nav is
// opaque with the border at its current 8%.

'use client'

import { useState } from 'react'
import NavTab from '@/components/ui/NavTab'

const TABS = [
  { id: 'today', label: 'Today' }, { id: 'plan', label: 'Plan' },
  { id: 'coach', label: 'Coach' }, { id: 'me', label: 'Me' },
] as const

const INK = '26, 26, 26'   // --ink's channels; --line is this at 0.08

function Glyph({ active }: { active: boolean }) {
  const c = active ? 'var(--moss-strong)' : 'var(--mute)'
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden>
      <rect x="3" y="11" width="4" height="8" rx="1" fill={c} />
      <rect x="9" y="7" width="4" height="12" rx="1" fill={c} />
      <rect x="15" y="4" width="4" height="15" rx="1" fill={c} />
    </svg>
  )
}

function Pill({ alpha, bottom, badge }: { alpha: number; bottom: number; badge: string }) {
  return (
    <div style={{
      position: 'fixed', left: '50%', transform: 'translateX(-50%)',
      bottom: `calc(${bottom}px + env(safe-area-inset-bottom, 0px))`,
      width: 'calc(100% - 32px)', maxWidth: 448,
      display: 'flex', alignItems: 'stretch',
      background: 'var(--nav-bg)',                    // OPAQUE, as shipped
      border: `1px solid rgba(${INK}, ${alpha})`,
      borderRadius: 999, boxShadow: 'var(--shadow-lifted)', zIndex: 3000,
    }}>
      {TABS.map((t, i) => (
        <NavTab key={t.id} label={t.label} icon={<Glyph active={i === 0} />} active={i === 0} onClick={() => {}} />
      ))}
      <span style={{
        position: 'absolute', right: 14, top: -9, padding: '1px 7px', borderRadius: 999,
        background: 'var(--ink)', color: 'var(--card)',
        fontFamily: 'var(--font-ui)', fontSize: 9, fontWeight: 700, letterSpacing: '0.08em',
      }}>{badge}</span>
    </div>
  )
}

export default function NavPreview() {
  const [alpha, setAlpha] = useState(0.14)

  return (
    <div style={{ position: 'fixed', inset: 0, display: 'flex', flexDirection: 'column', background: 'var(--bg)' }}>
      <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--line)', background: 'var(--card)' }}>
        <div style={{ fontFamily: 'var(--font-brand)', fontSize: 15, fontWeight: 600, color: 'var(--ink)' }}>
          Nav edge · A/B
        </div>
        <div style={{ fontFamily: 'var(--font-ui)', fontSize: 12, color: 'var(--mute)', marginTop: 3, lineHeight: 1.5 }}>
          Both pills are <strong>opaque</strong> — the tint is gone. The only difference is the
          border. Scroll so they cross a white card and the page ground.
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8 }}>
          <label style={{ fontFamily: 'var(--font-ui)', fontSize: 12, color: 'var(--ink-2)', whiteSpace: 'nowrap' }}>
            NEW edge {Math.round(alpha * 100)}%
          </label>
          <input type="range" min={0.08} max={0.30} step={0.02} value={alpha}
                 onChange={e => setAlpha(parseFloat(e.target.value))} style={{ flex: 1 }} />
        </div>
        <div style={{ fontFamily: 'var(--font-ui)', fontSize: 12, color: 'var(--mute)', marginTop: 4 }}>
          NOW is 8% — today&rsquo;s <code>--line</code>. Slide until the lower pill reads the way you want it.
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '0 20px 40px' }}>
        {Array.from({ length: 10 }, (_, i) => (
          <div key={i}>
            <div style={{
              marginTop: 14, background: 'var(--card)', border: '1px solid var(--line)',
              borderRadius: 14, padding: '26px 16px', boxShadow: 'var(--shadow-card)',
              fontFamily: 'var(--font-ui)', fontSize: 14, color: 'var(--ink)',
            }}>A white card</div>
            <div style={{
              height: 150, display: 'flex', alignItems: 'center',
              fontFamily: 'var(--font-ui)', fontSize: 13, color: 'var(--mute)',
            }}>Page ground</div>
          </div>
        ))}
        <div style={{ height: 180 }} />
      </div>

      <Pill alpha={0.08}  bottom={86} badge="NOW" />
      <Pill alpha={alpha} bottom={12} badge="NEW" />
    </div>
  )
}
