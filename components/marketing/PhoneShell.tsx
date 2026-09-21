/**
 * DESIGN-V3 — the device shell, extracted from PhoneFrame so there is ONE
 * phone on this site rather than two.
 *
 * The v3 handoff adds Plan and Coach screens beside Today. Building a second
 * frame for them would put the status bar, the notch, the screen radius and
 * the four-tab nav in two files, which is how the mockup and the product
 * drift apart — the exact failure `realComponents.test.ts` was written for
 * when this still said "8 km" and the app said "8km".
 *
 * `PhoneFrame` (Today only, server component, no hooks) and `TabbedPhone`
 * (three screens, client, owns tab state) both render through this.
 *
 * ⚠️ `overflow: hidden` on the content box is load-bearing and is why the
 * screens can be authored without measuring. The box is `position: relative`
 * and the nav below it is static, so anything spilling past CONTENT_H paints
 * straight over the nav and the nav disappears. Clipping here makes that
 * class of regression impossible rather than a thing to remember.
 */

import React from 'react'

/** Device geometry. Exported so a screen can size itself against the frame
 *  rather than guessing, and so there is one definition of "the phone". */
export const SCREEN_W = 320
export const STATUS_H = 30
export const CONTENT_H = 700
export const NAV_H = 60

export type PhoneTab = 'Today' | 'Plan' | 'Coach' | 'Me'

/** The four nav icons, so a screen never redraws one. */
export const TAB_ICONS: Record<PhoneTab, (c: string) => React.ReactNode> = {
  Today: c => (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
      <rect x="3" y="11" width="4" height="8" rx="1" fill={c} />
      <rect x="9" y="7" width="4" height="12" rx="1" fill={c} />
      <rect x="15" y="4" width="4" height="15" rx="1" fill={c} />
    </svg>
  ),
  Plan: c => (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
      <rect x="3" y="3" width="16" height="16" rx="2" stroke={c} strokeWidth="1.2" />
      <line x1="7" y1="1" x2="7" y2="5" stroke={c} strokeWidth="1.2" strokeLinecap="round" />
      <line x1="15" y1="1" x2="15" y2="5" stroke={c} strokeWidth="1.2" strokeLinecap="round" />
      <line x1="3" y1="8" x2="19" y2="8" stroke={c} strokeWidth="1.2" />
    </svg>
  ),
  Coach: c => (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
      <circle cx="11" cy="8" r="3.5" stroke={c} strokeWidth="1.2" />
      <path d="M4 19c0-3.866 3.134-7 7-7h.5c3.866 0 7 3.134 7 7" stroke={c} strokeWidth="1.2" strokeLinecap="round" />
      <line x1="15" y1="4" x2="18" y2="1" stroke={c} strokeWidth="1.2" strokeLinecap="round" />
      <line x1="16" y1="1" x2="18" y2="3" stroke={c} strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  ),
  Me: c => (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
      <circle cx="11" cy="8" r="3.5" stroke={c} strokeWidth="1.2" />
      <path d="M4 19c0-3.866 3.134-7 7-7h.5c3.866 0 7 3.134 7 7" stroke={c} strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  ),
}

const TAB_ORDER: PhoneTab[] = ['Today', 'Plan', 'Coach', 'Me']

/**
 * @param onTab  When given, the nav becomes real buttons and the frame stops
 *               being aria-hidden: a control a visitor can press is not
 *               decoration. Without it the frame is a still, exactly as
 *               before.
 */
export function PhoneShell({
  activeTab, onTab, children,
}: {
  activeTab: PhoneTab
  onTab?: (t: PhoneTab) => void
  children: React.ReactNode
}) {
  const interactive = typeof onTab === 'function'
  return (
    <div
      aria-hidden={interactive ? undefined : 'true'}
      style={{
        width: SCREEN_W + 20, height: STATUS_H + CONTENT_H + NAV_H + 20,
        background: 'var(--ground)',
        borderRadius: '46px',
        padding: '10px',
        position: 'relative',
        boxShadow: 'var(--shadow-device)',
        flexShrink: 0,
      }}
    >
      {/* Notch — 86 x 22, centred on the frame */}
      <div style={{
        position: 'absolute', top: '20px', left: '50%', transform: 'translateX(-50%)',
        width: '86px', height: '22px', borderRadius: '12px',
        background: 'var(--ground)', zIndex: 2,
      }} />

      <div style={{
        width: SCREEN_W, height: STATUS_H + CONTENT_H + NAV_H,
        borderRadius: '36px', overflow: 'hidden',
        background: 'var(--bg)', color: 'var(--ink)',
        display: 'flex', flexDirection: 'column',
        fontFamily: 'var(--font-ui)',
        pointerEvents: interactive ? undefined : 'none',
      }}>
        {/* Status bar */}
        <div style={{
          height: STATUS_H, flexShrink: 0, padding: '0 20px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--ink)', fontVariantNumeric: 'tabular-nums' }}>6:12</span>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: '5px' }}>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: '2px' }}>
              {[4, 6, 8, 10].map(h => (
                <div key={h} style={{ width: '3px', height: `${h}px`, borderRadius: '1px', background: 'var(--ink)', opacity: 0.75 }} />
              ))}
            </div>
            <div style={{ width: '16px', height: '9px', borderRadius: '2px', border: '1px solid var(--ink)', opacity: 0.75 }} />
          </div>
        </div>

        <div style={{ height: CONTENT_H, flexShrink: 0, position: 'relative', overflow: 'hidden' }}>
          {children}
        </div>

        {/* Bottom nav */}
        <div style={{
          height: NAV_H, flexShrink: 0,
          borderTop: '0.5px solid var(--line-strong)',
          background: 'var(--card)',
          display: 'flex', alignItems: 'center',
        }}>
          {TAB_ORDER.map(t => {
            const active = t === activeTab
            const colour = active ? 'var(--moss-strong)' : 'var(--mute)'
            const inner = (
              <>
                {TAB_ICONS[t](colour)}
                <span style={{ fontSize: '10px', fontWeight: active ? 700 : 500, color: colour, letterSpacing: '0.01em' }}>{t}</span>
              </>
            )
            const shared: React.CSSProperties = {
              flex: 1, display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center', gap: '3px',
              // 44pt minimum tap target (iOS HIG); the nav is 60px so the
              // cell is already tall enough, this guarantees it stays so.
              minHeight: 44,
            }
            return interactive ? (
              <button
                key={t} type="button" onClick={() => onTab!(t)}
                aria-current={active ? 'true' : undefined}
                style={{ ...shared, background: 'none', border: 'none', cursor: 'pointer', padding: 0, font: 'inherit' }}
              >{inner}</button>
            ) : (
              <div key={t} style={shared}>{inner}</div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
