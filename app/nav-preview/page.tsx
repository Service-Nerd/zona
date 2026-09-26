// NAV-TRANSLUCENT-02 — the A/B the founder asked for BEFORE the tint ships.
//
// 🔴 THE WHOLE POINT IS THE SECOND GROUND. Measured from his device captures:
// pure white at 0.82 is **16 levels** against the page ground (clearly visible)
// and **0 levels** against a white card (completely invisible). His 10:37
// capture had the pill over a card, which is why it read as "not translucent".
// It was never an alpha problem — the material vanishes against half the
// surfaces it crosses.
//
// The proposed warm off-white (`--nav-material`, channels 250/249/246) at 0.88
// measures **10 levels** against the ground and **8** against a card, with the
// label holding **4.86:1** on the worst real backdrop (the blurred band over the
// moss CTA). Same object, everywhere.
//
// ⚠️ A COOL tint would read better and was REJECTED BEFORE IT WAS PROPOSED:
// it is a palette regression against ADR-007 and Silvanto would have vetoed it
// by name. The measurement found the warm option that performs, so the veto
// never had to fire.
//
// ⚠️ THIS SHIPS NOTHING. Both pills are drawn inline here rather than importing
// `.nav-bar--floating`, so playing with it cannot move the app.

'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import NavTab from '@/components/ui/NavTab'

const TABS = [
  { id: 'today', label: 'Today' }, { id: 'plan', label: 'Plan' },
  { id: 'coach', label: 'Coach' }, { id: 'me', label: 'Me' },
] as const

/** Both materials, so the comparison is a value not a vibe. */
const MATERIALS = {
  // ⚠️ The proposed value is read from its TOKEN, not typed here — otherwise the
  // prototype and the thing it is proposing can drift, which is the whole class
  // this repo keeps paying for.
  current:  { tint: '255 255 255',            alpha: 0.82, name: 'NOW · white 0.82' },
  proposed: { tint: 'var(--nav-material)',    alpha: 0.88, name: 'NEW · warm 0.88' },
}

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

function Pill({ m, bottom, badge }: { m: typeof MATERIALS.current; bottom: number; badge: string }) {
  return (
    <div style={{
      position: 'fixed', left: '50%', transform: 'translateX(-50%)',
      bottom: `calc(${bottom}px + env(safe-area-inset-bottom, 0px))`,
      width: 'calc(100% - 32px)', maxWidth: 448,
      display: 'flex', alignItems: 'stretch',
      background: `rgb(${m.tint} / ${m.alpha})`,
      backdropFilter: 'blur(20px) saturate(1.6)',
      WebkitBackdropFilter: 'blur(20px) saturate(1.6)',
      border: '1px solid var(--line)', borderRadius: 999,
      boxShadow: 'var(--shadow-lifted)', zIndex: 3000,
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
  const scRef = useRef<HTMLDivElement>(null)
  const [behind, setBehind] = useState<'page ground' | 'a white card'>('page ground')

  // Report what is actually behind the lower pill, so the readout is measured
  // rather than assumed — the same discipline as every other check this week.
  const probe = useCallback(() => {
    // ⚠️ SAMPLE THE LOWER PILL'S OWN CENTRE, because the readout names it.
    // The first cut sampled `innerHeight - 120`, which is where the UPPER pill
    // sits — a readout measuring a different element from the one it labels is
    // the exact class this session has hit five times.
    // Lower pill: bottom 12, height 62 -> centre at innerHeight - 43.
    const y = window.innerHeight - 43
    const el = document.elementsFromPoint(window.innerWidth / 2, y)
      .find(e => e instanceof HTMLElement && (e as HTMLElement).dataset.ground)
    setBehind(((el as HTMLElement | undefined)?.dataset.ground as 'page ground') ?? 'page ground')
  }, [])
  useEffect(() => { probe() }, [probe])

  return (
    <div style={{ position: 'fixed', inset: 0, display: 'flex', flexDirection: 'column', background: 'var(--bg)' }}>
      <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--line)', background: 'var(--card)' }}>
        <div style={{ fontFamily: 'var(--font-brand)', fontSize: 15, fontWeight: 600, color: 'var(--ink)' }}>
          Nav material · A/B
        </div>
        <div style={{ fontFamily: 'var(--font-ui)', fontSize: 12, color: 'var(--mute)', marginTop: 3, lineHeight: 1.5 }}>
          Scroll so each pill crosses a <strong>white card</strong> and the <strong>page ground</strong>.
          NOW disappears over cards; NEW should hold on both.
        </div>
        <div style={{ fontFamily: 'var(--font-ui)', fontSize: 12, color: 'var(--ink)', marginTop: 6, fontVariantNumeric: 'tabular-nums' }}>
          behind the lower pill: <strong>{behind}</strong> ·{' '}
          <span style={{ color: 'var(--mute)' }}>
            NOW {behind === 'page ground' ? '16' : '0'} levels · NEW {behind === 'page ground' ? '10' : '8'}
          </span>
        </div>
      </div>

      <div ref={scRef} onScroll={probe} style={{ flex: 1, overflowY: 'auto', padding: '0 20px 40px' }}>
        {Array.from({ length: 10 }, (_, i) => (
          <div key={i}>
            <div data-ground="a white card" style={{
              marginTop: 14, background: 'var(--card)', border: '1px solid var(--line)',
              borderRadius: 14, padding: '26px 16px', boxShadow: 'var(--shadow-card)',
              fontFamily: 'var(--font-ui)', fontSize: 14, color: 'var(--ink)',
            }}>
              A white card — <strong>this</strong> is where the current pill vanishes
            </div>
            <div data-ground="page ground" style={{
              height: 150, display: 'flex', alignItems: 'center',
              fontFamily: 'var(--font-ui)', fontSize: 13, color: 'var(--mute)',
            }}>
              Page ground — the current pill reads clearly here
            </div>
          </div>
        ))}
        <div style={{ height: 180 }} />
      </div>

      <Pill m={MATERIALS.current}  bottom={86} badge="NOW" />
      <Pill m={MATERIALS.proposed} bottom={12} badge="NEW" />
    </div>
  )
}
