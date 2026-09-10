// PhoneFrame — marketing device shell + a faithful STATIC Today screen.
// design_handoff_v2 Change 2. Public marketing surface only (homepage hero).
//
// WHY STATIC, not the real screen. The live Today screen lives in
// DashboardClient.tsx — a client component that needs auth, a generated plan
// and live user data, and the marketing page redirects signed-in visitors away.
// It cannot be mounted here. So this is a faithful composition built from the
// real Today anatomy (ui-patterns.md § SessionCard / Session Card Layout /
// screen-architecture.md) using Warm Slate tokens, so it reads as the product
// and stays on-palette automatically. Purely presentational — no hooks, no
// handlers, no client boundary — so it renders inside the server-component page.
//
// THE CROP IS MEASURED, NOT CHOSEN (handoff Change 2). The content area is a
// fixed 654px: 30px status bar + 654px content + 60px nav = the 744px screen.
// The content is authored to fit that height with the "Log this session" CTA —
// the last element the shot must show — fully visible above a 32px bottom fade,
// so the fade can only ever sit over empty space, never over content. If the
// composition below grows past the CTA, raise CONTENT_H by the same amount and
// keep the CTA above the fade. Pinned by phoneFrame.test.tsx.
//
// KNOWN CONSTRAINT (handoff): a device frame renders its screen ground dark when
// placed inside a --ground (dark) section — cause undiagnosed. KEEP THIS ON A
// LIGHT SECTION ONLY. The dark "receipt" band (Change 1) is text-only for the
// same reason.

import { BRAND } from '@/lib/brand'

const SCREEN_W = 320
const STATUS_H = 30
const CONTENT_H = 654
const NAV_H = 60

/** Bottom-nav tab — matches the real app's four tabs (Today · Plan · Coach · Me;
 *  Strava is admin-only and has no tab — CLAUDE.md). Minimal glyphs, not the
 *  full inline-SVG icon set, because this is a still, not the live nav. */
function NavTab({ label, active }: { label: string; active: boolean }) {
  const color = active ? 'var(--moss)' : 'var(--mute)'
  return (
    <div style={{
      flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', gap: '4px',
    }}>
      <div style={{
        width: '18px', height: '18px', borderRadius: '5px',
        border: `1.5px solid ${color}`,
        background: active ? 'var(--moss-soft)' : 'transparent',
      }} />
      <span style={{
        fontSize: '9px', fontWeight: active ? 700 : 500, color,
        letterSpacing: '0.02em',
      }}>{label}</span>
    </div>
  )
}

export function PhoneFrame() {
  return (
    <div
      aria-hidden="true"
      style={{
        // Frame outer — 340 × 764 (320 + 10px padding each axis).
        width: SCREEN_W + 20, height: 764,
        background: 'var(--ground)',
        borderRadius: '46px',
        padding: '10px',
        position: 'relative',
        boxShadow: '0 1px 2px rgba(26,26,26,.06), 0 24px 60px -20px rgba(26,26,26,.28)',
        flexShrink: 0,
      }}
    >
      {/* Notch — 86 × 22, centred on the frame */}
      <div style={{
        position: 'absolute', top: '20px', left: '50%', transform: 'translateX(-50%)',
        width: '86px', height: '22px', borderRadius: '12px',
        background: 'var(--ground)', zIndex: 2,
      }} />

      {/* Screen — 320 × 744, warm-slate ground */}
      <div style={{
        width: SCREEN_W, height: STATUS_H + CONTENT_H + NAV_H,
        borderRadius: '36px', overflow: 'hidden',
        background: 'var(--bg)', color: 'var(--ink)',
        display: 'flex', flexDirection: 'column',
        fontFamily: 'var(--font-ui)',
      }}>
        {/* ── Status bar — 30px ─────────────────────────────────────────── */}
        <div style={{
          height: STATUS_H, flexShrink: 0, padding: '0 20px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <span style={{
            fontSize: '11px', fontWeight: 600, color: 'var(--ink)',
            fontVariantNumeric: 'tabular-nums',
          }}>6:12</span>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: '5px' }}>
            {/* signal bars 4/6/8/10 */}
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: '2px' }}>
              {[4, 6, 8, 10].map(h => (
                <div key={h} style={{ width: '3px', height: `${h}px`, borderRadius: '1px', background: 'var(--ink)', opacity: 0.75 }} />
              ))}
            </div>
            {/* battery outline 16×9 */}
            <div style={{
              width: '16px', height: '9px', borderRadius: '2px',
              border: '1px solid var(--ink)', opacity: 0.75,
            }} />
          </div>
        </div>

        {/* ── Content — fixed 654px, authored to fit ────────────────────── */}
        <div style={{ height: CONTENT_H, flexShrink: 0, position: 'relative' }}>
          <div style={{ padding: '8px 18px 0', display: 'flex', flexDirection: 'column', gap: '18px' }}>

            {/* Header — wordmark chrome + greeting + voice anchor */}
            <div>
              <div style={{
                fontSize: '12px', fontWeight: 600, color: 'var(--ink)',
                letterSpacing: '0.14em', textTransform: 'lowercase', marginBottom: '14px',
              }}>{BRAND.name.toLowerCase()}</div>
              <div style={{
                fontFamily: 'var(--font-brand)', fontSize: '26px', fontWeight: 700,
                lineHeight: 1.1, letterSpacing: '-0.02em', color: 'var(--ink)',
              }}>Today</div>
              <div style={{ fontSize: '13px', color: 'var(--mute)', marginTop: '4px' }}>
                Tuesday · Week 6 of 14
              </div>
            </div>

            {/* Session card — the main object. Left accent (easy = --s-easy),
                metric hierarchy (zone · HR · pace · distance/duration), coach note. */}
            <div style={{
              display: 'flex', alignItems: 'stretch',
              background: 'var(--card)', border: '1px solid var(--line)',
              borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-card)',
              overflow: 'hidden',
            }}>
              <div style={{ width: '3px', flexShrink: 0, background: 'var(--s-easy)' }} />
              <div style={{ flex: 1, padding: '16px 16px 16px 15px' }}>
                <div style={{
                  fontSize: '10px', fontWeight: 700, color: 'var(--mute)',
                  textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '8px',
                }}>Easy run</div>
                <div style={{
                  fontFamily: 'var(--font-brand)', fontSize: '19px', fontWeight: 600,
                  color: 'var(--ink)', marginBottom: '12px',
                }}>Easy run — Zone 2</div>
                <div style={{
                  display: 'flex', gap: '16px', flexWrap: 'wrap',
                  fontSize: '13px', color: 'var(--ink-2)', marginBottom: '12px',
                }}>
                  <div><strong style={{ color: 'var(--ink)' }}>8 km</strong> · 55 min</div>
                  <div><strong style={{ color: 'var(--ink)' }}>&lt; 145 bpm</strong></div>
                  <div>6:30–7:00 /km</div>
                </div>
                <div style={{
                  fontSize: '12px', lineHeight: 1.5, color: 'var(--mute)',
                  borderTop: '1px solid var(--line)', paddingTop: '10px', fontStyle: 'italic',
                }}>
                  Keep HR below your Zone 2 ceiling — walk if it climbs.
                </div>
              </div>
            </div>

            {/* Voice anchor strip — brand moment (BRAND.voiceAnchor is in-product) */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: '8px',
              fontSize: '13px', color: 'var(--moss)', fontWeight: 600,
            }}>
              <span style={{ width: '3px', height: '16px', background: 'var(--moss)', borderRadius: '2px' }} />
              {BRAND.voiceAnchor}
            </div>

            {/* Primary CTA — the last element the crop MUST show (measured). */}
            <button style={{
              width: '100%', padding: '14px', border: 'none',
              borderRadius: 'var(--radius-md)', background: 'var(--moss)',
              color: 'var(--card)', fontSize: '15px', fontWeight: 600, fontFamily: 'var(--font-ui)',
              cursor: 'default',
            }}>Log this session</button>
          </div>

          {/* Bottom fade — 32px, sits in the gap BELOW the CTA, never over it */}
          <div style={{
            position: 'absolute', left: 0, right: 0, bottom: 0, height: '32px',
            background: 'linear-gradient(to bottom, rgba(243,240,235,0) 0%, var(--bg) 100%)',
            pointerEvents: 'none',
          }} />
        </div>

        {/* ── Bottom nav — 60px, top hairline, four tabs ─────────────────── */}
        <div style={{
          height: NAV_H, flexShrink: 0,
          borderTop: '0.5px solid var(--line-strong)',
          background: 'var(--card)',
          display: 'flex', alignItems: 'center',
        }}>
          <NavTab label="Today" active />
          <NavTab label="Plan" active={false} />
          <NavTab label="Coach" active={false} />
          <NavTab label="Me" active={false} />
        </div>
      </div>
    </div>
  )
}
