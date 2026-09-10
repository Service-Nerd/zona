// PhoneFrame — marketing device shell + a faithful STATIC Today screen.
// design_handoff_v2 Change 2. Public marketing surface only (homepage hero).
//
// WHY STATIC, not the real screen. The live Today screen lives in
// DashboardClient.tsx — a client component that needs auth, a generated plan
// and live user data, and the marketing page redirects signed-in visitors away.
// It cannot be mounted here. So this is a faithful composition built from the
// real Today anatomy (DashboardClient TodayScreen: wordmark row → context row →
// greeting + 56px two-line hero → date strip → "Hold the zone" → session card →
// zone bar → CTA) using Warm Slate tokens, so it reads as the product and stays
// on-palette automatically. Purely presentational — no hooks, no handlers, no
// client boundary — so it renders inside the server-component page.
//
// THE ANATOMY IS COPIED, NOT INVENTED. The signature of the real Today screen
// is the giant 56px two-line restraint statement ("8 km, / easy.") — the number
// then the adverb, ink then moss. There is NO "Today" title on the real screen.
// If the live TodayScreen hero, context row or session-card shape changes, update
// this still to match — it exists to look like the product, not like a brochure.
//
// THE CROP IS MEASURED, NOT CHOSEN (handoff Change 2). The content area is a
// fixed 654px: 30px status bar + 654px content + 60px nav = the 744px screen.
// The content is authored to fit that height with the "Log this session" CTA —
// the last element the shot must show — fully visible above a 32px bottom fade,
// so the fade can only ever sit over empty space, never over content. If the
// composition below grows past the CTA, raise CONTENT_H by the same amount and
// keep the CTA above the fade.
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

/** Date-strip day cell — matches DashboardClient DateStrip: day letter, date
 *  circle (moss fill on today), session dot beneath. */
function DayCell({ letter, date, today, dotColor }: {
  letter: string; date: string; today?: boolean; dotColor?: string
}) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px',
      padding: '4px 2px',
    }}>
      <span style={{
        fontSize: '10px', letterSpacing: '0.04em', textTransform: 'uppercase',
        color: today ? 'var(--moss)' : 'var(--ink-2)',
      }}>{letter}</span>
      <div style={{
        width: '26px', height: '26px', borderRadius: '50%',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: today ? 'var(--moss)' : 'transparent',
      }}>
        <span style={{
          fontSize: '13px', fontWeight: today ? 600 : 400,
          color: today ? 'var(--card)' : 'var(--mute)',
          fontVariantNumeric: 'tabular-nums',
        }}>{date}</span>
      </div>
      <div style={{
        width: '4px', height: '4px', borderRadius: '50%',
        background: dotColor ?? 'transparent',
      }} />
    </div>
  )
}

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

          {/* Wordmark row — brand chrome + moss dot. No "Today" title: the real
              screen leads with the hero, not a page heading. */}
          <div style={{
            padding: '12px 18px 0', display: 'flex', alignItems: 'center', gap: '6px',
          }}>
            <span style={{
              fontSize: '13px', fontWeight: 600, color: 'var(--ink)',
              letterSpacing: '0.14em', textTransform: 'lowercase',
            }}>{BRAND.name.toLowerCase()}</span>
            <span style={{ position: 'relative', width: '8px', height: '8px' }}>
              <span style={{ position: 'absolute', inset: '-3px', borderRadius: '50%', background: 'var(--moss-soft)' }} />
              <span style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: 'var(--moss)' }} />
            </span>
          </div>

          {/* Hero block — context row · greeting · 56px two-line restraint hero */}
          <div style={{ padding: '18px 18px 0' }}>
            {/* Context row: phase · Week N ——— race-countdown pill */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
              <span style={{
                fontSize: '11px', fontWeight: 600, color: 'var(--mute)',
                letterSpacing: '0.08em', textTransform: 'uppercase',
              }}>Base · Week 6</span>
              <div style={{ flex: 1, height: '1px', background: 'var(--line)' }} />
              <span style={{
                fontSize: '11px', fontWeight: 600, color: 'var(--moss)',
                letterSpacing: '0.04em', background: 'var(--moss-soft)',
                borderRadius: '20px', padding: '3px 9px',
              }}>84 days out</span>
            </div>

            {/* Greeting */}
            <div style={{
              fontSize: '15px', fontWeight: 500, color: 'var(--mute)',
              marginBottom: '4px', lineHeight: 1,
            }}>Good morning</div>

            {/* The signature hero — number (ink) then adverb (moss), 56px */}
            <div style={{ lineHeight: 1 }}>
              <span style={{
                fontSize: '56px', fontWeight: 800, color: 'var(--ink)',
                letterSpacing: '-2.5px', fontVariantNumeric: 'tabular-nums',
              }}>8 km,</span>
              <br />
              <span style={{
                fontSize: '56px', fontWeight: 800, color: 'var(--moss)',
                letterSpacing: '-2.5px',
              }}>easy.</span>
            </div>
          </div>

          {/* Date strip — week of day cells, today filled moss */}
          <div style={{
            marginTop: '20px', paddingBottom: '10px',
            borderBottom: '0.5px solid var(--line-strong)',
          }}>
            <div style={{
              display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)',
              padding: '0 8px', gap: '2px',
            }}>
              <DayCell letter="M" date="9" dotColor="var(--s-easy)" />
              <DayCell letter="T" date="10" today dotColor="var(--s-easy)" />
              <DayCell letter="W" date="11" dotColor="var(--s-quality)" />
              <DayCell letter="T" date="12" />
              <DayCell letter="F" date="13" dotColor="var(--s-easy)" />
              <DayCell letter="S" date="14" dotColor="var(--s-long)" />
              <DayCell letter="S" date="15" />
            </div>
          </div>

          {/* Hold the zone — daily brand anchor, moss, above the session card */}
          <div style={{
            padding: '12px 18px 0', display: 'flex', alignItems: 'center', gap: '8px',
          }}>
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--moss)' }} />
            <span style={{
              fontSize: '11px', fontWeight: 700, color: 'var(--moss)',
              letterSpacing: '0.12em', textTransform: 'uppercase',
            }}>Hold the zone · Z2 today</span>
          </div>

          {/* Today's session — section label + session card + zone bar + CTA */}
          <div style={{ padding: '14px 18px 0' }}>
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              marginBottom: '10px',
            }}>
              <span style={{
                fontSize: '10px', fontWeight: 700, color: 'var(--mute)',
                letterSpacing: '0.08em', textTransform: 'uppercase',
              }}>Today&apos;s session</span>
              <span style={{ fontSize: '10px', color: 'var(--mute-2)' }}>Zone 2</span>
            </div>

            {/* Session card — left accent (easy = --s-easy), name + detail, right metric */}
            <div style={{
              display: 'flex', alignItems: 'stretch',
              background: 'var(--card)', border: '1px solid var(--line-strong)',
              borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-card)',
              overflow: 'hidden',
            }}>
              <div style={{ width: '3px', flexShrink: 0, background: 'var(--s-easy)', borderRadius: '2px 0 0 2px' }} />
              <div style={{
                flex: 1, padding: '14px 12px 14px 14px',
                display: 'flex', alignItems: 'center', gap: '10px',
              }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--ink)', lineHeight: 1.2 }}>
                    Easy run
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--mute)', marginTop: '2px', lineHeight: 1.3 }}>
                    Zone 2 · &lt; 145 bpm · 6:30 /km
                  </div>
                </div>
                <div style={{
                  fontSize: '17px', fontWeight: 700, color: 'var(--ink)',
                  fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.3px', lineHeight: 1,
                }}>8 km</div>
              </div>
            </div>

            {/* Zone bar — 5 segments, Zone 2 lit (easy). Glance-only, no labels. */}
            <div style={{ display: 'flex', gap: '3px', marginTop: '10px' }}>
              {[1, 2, 3, 4, 5].map(z => (
                <div key={z} style={{
                  flex: 1, height: '4px', borderRadius: '2px',
                  background: z === 2 ? 'var(--s-easy)' : 'var(--bg-soft)',
                }} />
              ))}
            </div>

            {/* Primary CTA — the last element the crop MUST show (measured). */}
            <button style={{
              marginTop: '10px', width: '100%', padding: '14px', border: 'none',
              borderRadius: 'var(--radius-md)', background: 'var(--moss)',
              color: 'var(--card)', fontSize: '14px', fontWeight: 600,
              fontFamily: 'var(--font-ui)', letterSpacing: '0.02em', cursor: 'default',
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
