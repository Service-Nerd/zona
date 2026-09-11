// PhoneFrame — marketing device shell + a faithful STATIC Today screen.
// design_handoff_v2 Change 2. Public marketing surface only (homepage hero).
//
// WHY STATIC, not the real screen. The live Today screen lives in
// DashboardClient.tsx — a client component that needs auth, a generated plan
// and live user data, and the marketing page redirects signed-in visitors away.
// It cannot be mounted here. So this is a faithful composition built from the
// real Today anatomy using Warm Slate tokens, so it reads as the product and
// stays on-palette automatically. Purely presentational — no hooks, no handlers,
// no client boundary — so it renders inside the server-component page. The
// interactive shared components (NotificationBell, CoachByline, CoachNoteBlock,
// PendingAdjustmentBanner) can't be imported here (they'd need event handlers
// passed across the RSC boundary), so their markup is reproduced inline and
// kept in sync by hand. If those components change, update this still to match.
//
// WHAT IT SHOWS — the real Today screen's element ORDER, exactly:
//   wordmark + notification bell → context row + greeting + 56px restraint hero
//   ("8 km, / easy." — the number then the adverb, ink then moss, the screen's
//   signature; there is NO "Today" title on the real screen) → Kit's coach note
//   → date strip (week nav + 7 day cells) → "Hold the zone" voice anchor →
//   session card + CTA → four-tab nav with the real icons.
//
// SLT review 2026-09-11 (Make-A-Wish partnership made this a cold-audience
// first-impression surface) cut the plan-adjustment card that used to sit above
// the coach note. Two reasons, unanimous: it drew Confirm/Revert buttons nobody
// can press — a still pretending to be a demo — and "we rescheduled your
// session" is a claim every competitor makes. The kept coach note says
// "keep today just as dull", which no competitor would put on a homepage.
// The freed space restored the date strip (the only element that shows the
// week's STRUCTURE — the habit scaffold) and the voice anchor.
// Do NOT re-add an adjustment card here; the adaptivity claim belongs in page
// copy, where it can be stated honestly in a sentence.
//
// THE CROP IS STRUCTURAL, NOT MEASURED. content = CONTENT_H with
// overflow:hidden, so a composition that outgrows the box gets clipped at the
// fade — which is exactly the "screen scrolls" illusion the fade already
// implies. This replaced a hand-measured crop that silently broke: the content
// div is position:relative and the nav is static, so when the cards pushed the
// content ~32px past CONTENT_H it painted straight OVER the bottom nav and the
// nav vanished. A measurement maintained by memory is not a measurement.
//
// KNOWN CONSTRAINT (handoff): a device frame renders its screen ground dark when
// placed inside a --ground (dark) section — cause undiagnosed. KEEP THIS ON A
// LIGHT SECTION ONLY. The dark "receipt" band (Change 1) is text-only for the
// same reason.

import { BRAND } from '@/lib/brand'
import { Wordmark } from '@/components/ui/Wordmark'

const SCREEN_W = 320
const STATUS_H = 30
const CONTENT_H = 700
const NAV_H = 60

// The still's plan: week 6 of a 16-week build, so 10 weeks remain. Every
// number below is derived from these two so the screen is internally coherent
// — a visitor who reads "Week 6 of 16" and "10 weeks out" should be able to
// check the arithmetic. The countdown wording mirrors formatRaceCountdown()
// in DashboardClient (runners think in weeks; the unit flips to days inside
// the final week). It is NOT "84 days out" — that was the pre-2026 format.
const WEEK_N = 6
const TOTAL_WEEKS = 16
const COUNTDOWN = `${TOTAL_WEEKS - WEEK_N} weeks out`

/** Date-strip day cells. `date` is the calendar number, `dot` the session-type
 *  accent (null = rest day, no dot). Thu is selected/today. Mirrors the real
 *  DateStrip's DOW_LETTER order (Mon-first) and getDotColor() semantics. */
const DAYS = [
  { letter: 'M', date: 6,  dot: 'var(--s-easy)' },
  { letter: 'T', date: 7,  dot: 'var(--s-quality)' },
  { letter: 'W', date: 8,  dot: null },
  { letter: 'T', date: 9,  dot: 'var(--s-easy)', today: true },
  { letter: 'F', date: 10, dot: null },
  { letter: 'S', date: 11, dot: 'var(--s-inter)' },
  { letter: 'S', date: 12, dot: 'var(--s-long)' },
]

/** AIMark sparkle — copy of components/shared/AIMark.tsx (single-source glyph). */
function Sparkle({ size = 10, color = 'var(--warn)' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" aria-hidden="true">
      <path d="M5 1 L6 5 L10 6 L6 7 L5 11 L4 7 L0 6 L4 5 Z" fill={color} />
      <path d="M11 9 L11.4 10.6 L13 11 L11.4 11.4 L11 13 L10.6 11.4 L9 11 L10.6 10.6 Z" fill={color} />
    </svg>
  )
}

/** Kit byline — copy of CoachByline: gradient avatar with anchored AIMark,
 *  name + role line. Coach surfaces use the 'warn' amber variant. */
function KitByline({ role }: { role: string }) {
  const initial = BRAND.coachName.charAt(0).toUpperCase()
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
      <span style={{
        position: 'relative', width: '22px', height: '22px', borderRadius: '50%',
        background: 'var(--warn)',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        color: 'var(--card)', fontSize: '11px', fontWeight: 700, letterSpacing: '-0.02em',
        flexShrink: 0,
      }}>
        {initial}
        <span style={{
          position: 'absolute', bottom: '-3px', right: '-3px',
          background: 'var(--warn-bg)', borderRadius: '50%', padding: '2px',
          display: 'inline-flex', lineHeight: 0,
        }}>
          <Sparkle size={10} color="var(--warn)" />
        </span>
      </span>
      <span style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.15 }}>
        <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--ink)', letterSpacing: '-0.005em' }}>
          {BRAND.coachName}
        </span>
        <span style={{
          fontSize: '10px', fontWeight: 600, color: 'var(--warn)',
          letterSpacing: '0.06em', textTransform: 'uppercase',
        }}>{role}</span>
      </span>
    </span>
  )
}

/** Bottom-nav tab — the real DashboardClient nav icons (Today · Plan · Coach ·
 *  Me; Strava is admin-only and has no tab — CLAUDE.md). SVGs copied from
 *  DashboardClient IconToday/IconPlan/IconCoach/IconMe. */
function NavTab({ label, active, children }: { label: string; active: boolean; children: React.ReactNode }) {
  const color = active ? 'var(--moss)' : 'var(--mute)'
  return (
    <div style={{
      flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', gap: '4px',
    }}>
      {children}
      <span style={{ fontSize: '9px', fontWeight: active ? 700 : 500, color, letterSpacing: '0.02em' }}>
        {label}
      </span>
    </div>
  )
}

export function PhoneFrame() {
  return (
    <div
      aria-hidden="true"
      style={{
        // Frame outer — 340 wide (320 + 10px padding each axis).
        width: SCREEN_W + 20, height: STATUS_H + CONTENT_H + NAV_H + 20,
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

      {/* Screen — warm-slate ground. pointerEvents none: purely decorative. */}
      <div style={{
        width: SCREEN_W, height: STATUS_H + CONTENT_H + NAV_H,
        borderRadius: '36px', overflow: 'hidden',
        background: 'var(--bg)', color: 'var(--ink)',
        display: 'flex', flexDirection: 'column',
        fontFamily: 'var(--font-ui)', pointerEvents: 'none',
      }}>
        {/* ── Status bar — 30px ─────────────────────────────────────────── */}
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

        {/* ── Content — fixed CONTENT_H. overflow:hidden is load-bearing:
            this div is position:relative and the nav below is static, so
            anything spilling past CONTENT_H paints straight over the nav and
            the nav disappears. Clipping here makes that class of regression
            impossible instead of relying on someone re-measuring. ────────── */}
        <div style={{ height: CONTENT_H, flexShrink: 0, position: 'relative', overflow: 'hidden' }}>

          {/* Wordmark row + notification bell (paid affordance). No "Today"
              title — the real screen leads with the hero. */}
          <div style={{
            padding: '12px 14px 0 18px', display: 'flex', alignItems: 'center',
            justifyContent: 'space-between',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              {/* The REAL wordmark component — not a hand-rolled span. The
                  previous inline copy rendered lowercase at weight 600 with
                  +0.14em tracking and no NN-moss accent, i.e. a different
                  logo from the one the app and the rest of the site ship.
                  Wordmark is pure/presentational (no hooks, no handlers) so it
                  imports cleanly into this server component. */}
              <Wordmark size="xs" />
              <span style={{ position: 'relative', width: '8px', height: '8px' }}>
                <span style={{ position: 'absolute', inset: '-3px', borderRadius: '50%', background: 'var(--moss-soft)' }} />
                <span style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: 'var(--moss)' }} />
              </span>
            </div>
            {/* Notification bell — copy of NotificationBell (unread moss dot) */}
            <span style={{ position: 'relative', width: '28px', height: '28px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
                stroke="var(--ink-2)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                <path d="M13.73 21a2 2 0 0 1-3.46 0" />
              </svg>
              <span style={{
                position: 'absolute', top: '1px', right: '2px',
                width: '8px', height: '8px', borderRadius: '50%',
                background: 'var(--moss)', border: '1.5px solid var(--bg)',
              }} />
            </span>
          </div>

          {/* Hero block — context row · greeting · 56px two-line restraint hero */}
          <div style={{ padding: '16px 18px 0' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
              <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--mute)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                Base · Week {WEEK_N}
              </span>
              <div style={{ flex: 1, height: '1px', background: 'var(--line)' }} />
              <span style={{
                fontSize: '11px', fontWeight: 600, color: 'var(--moss)',
                letterSpacing: '0.04em', background: 'var(--moss-soft)',
                borderRadius: '20px', padding: '3px 9px',
              }}>{COUNTDOWN}</span>
            </div>

            <div style={{ fontSize: '15px', fontWeight: 500, color: 'var(--mute)', marginBottom: '4px', lineHeight: 1 }}>
              Good morning
            </div>
            <div style={{ lineHeight: 1 }}>
              <span style={{ fontSize: '56px', fontWeight: 800, color: 'var(--ink)', letterSpacing: '-2.5px', fontVariantNumeric: 'tabular-nums' }}>8 km,</span>
              <br />
              <span style={{ fontSize: '56px', fontWeight: 800, color: 'var(--moss)', letterSpacing: '-2.5px' }}>easy.</span>
            </div>
          </div>

          {/* Kit's coach note — copy of CoachNoteBlock (aiGenerated) */}
          <div style={{ padding: '18px 18px 0' }}>
            <div style={{ position: 'relative', background: 'var(--warn-bg)', borderRadius: '14px', padding: '16px 18px 16px 26px' }}>
              <span style={{ position: 'absolute', left: '8px', top: '16px', bottom: '16px', width: '3px', borderRadius: '2px', background: 'var(--warn)' }} />
              <div style={{ marginBottom: '10px' }}>
                <KitByline role="Your coach" />
              </div>
              <div style={{ fontSize: '14px', lineHeight: 1.55, color: 'var(--coach-ink)' }}>
                Yesterday held Zone 2 the whole way. That&rsquo;s the win. Keep today just as dull.
              </div>
            </div>
          </div>

          {/* Date strip — copy of DateStrip. The only element that shows the
              week's STRUCTURE rather than a message: seven days, what's on
              them, where you are. Restored on the SLT's reading that a cold
              visitor reads a week strip faster than any sentence, and because
              week-strip navigation is a named reference-aesthetic anchor
              (CLAUDE.md). Static: the real one is a client component with
              swipe handlers, so its markup is reproduced by hand here. */}
          <div style={{ marginTop: '18px', borderBottom: '0.5px solid var(--line)', paddingBottom: '8px' }}>
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '0 16px 8px',
            }}>
              <span style={{ color: 'var(--mute)', lineHeight: 0 }}>
                <svg width="16" height="16" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                  <path d="M13 4L7 10L13 16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
              <span style={{
                fontSize: '11px', fontWeight: 600, color: 'var(--mute)',
                letterSpacing: '0.08em', textTransform: 'uppercase',
              }}>Week {WEEK_N} of {TOTAL_WEEKS}</span>
              <span style={{ color: 'var(--ink-2)', lineHeight: 0 }}>
                <svg width="16" height="16" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                  <path d="M7 4L13 10L7 16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', padding: '0 8px', gap: '2px' }}>
              {DAYS.map((d, i) => (
                <div key={i} style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center',
                  gap: '3px', padding: '2px',
                }}>
                  <span style={{
                    fontSize: '10px', letterSpacing: '0.04em', textTransform: 'uppercase',
                    color: d.today ? 'var(--moss)' : 'var(--ink-2)',
                  }}>{d.letter}</span>
                  <div style={{
                    width: '26px', height: '26px', borderRadius: '50%',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: d.today ? 'var(--moss)' : 'transparent',
                  }}>
                    <span style={{
                      fontSize: '13px', fontWeight: d.today ? 700 : 500,
                      color: d.today ? 'var(--card)' : 'var(--ink)',
                      fontVariantNumeric: 'tabular-nums',
                    }}>{d.date}</span>
                  </div>
                  <span style={{
                    width: '4px', height: '4px', borderRadius: '50%',
                    background: d.dot ?? 'transparent',
                  }} />
                </div>
              ))}
            </div>
          </div>

          {/* Hold the zone — BRAND.voiceAnchor, the in-product voice moment.
              In-product content, not marketing copy, so it does not collide
              with the "never two locked brand lines on one surface" rule. */}
          <div style={{ padding: '12px 18px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--moss)', flexShrink: 0 }} />
            <span style={{
              fontSize: '11px', fontWeight: 700, color: 'var(--moss)',
              letterSpacing: '0.12em', textTransform: 'uppercase',
            }}>Hold the zone · 132&ndash;145 bpm today</span>
          </div>

          {/* Today's session — section label + session card + zone bar + CTA */}
          <div style={{ padding: '14px 18px 0' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
              <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--mute)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                Today&apos;s session
              </span>
              <span style={{ fontSize: '10px', color: 'var(--mute-2)' }}>Zone 2</span>
            </div>

            {/* Session card — left accent (easy = --s-easy), name + detail, metric */}
            <div style={{
              display: 'flex', alignItems: 'stretch',
              background: 'var(--card)', border: '1px solid var(--line-strong)',
              borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-card)', overflow: 'hidden',
            }}>
              <div style={{ width: '3px', flexShrink: 0, background: 'var(--s-easy)', borderRadius: '2px 0 0 2px' }} />
              <div style={{ flex: 1, padding: '14px 12px 14px 14px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--ink)', lineHeight: 1.2 }}>Easy run</div>
                  <div style={{ fontSize: '12px', color: 'var(--mute)', marginTop: '2px', lineHeight: 1.3 }}>
                    {/* Pace is a BAND — the engine emits "6:30–7:30 /km" and
                        never a single easy pace. A lone "6:30 /km" is a format
                        the product does not produce. */}
                    Zone 2 · &lt; 145 bpm · 6:30&ndash;7:30 /km
                  </div>
                </div>
                <div style={{ fontSize: '17px', fontWeight: 700, color: 'var(--ink)', fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.3px', lineHeight: 1 }}>
                  8 km
                </div>
              </div>
            </div>

            {/* Zone bar — 5 segments, Zone 2 lit (easy). Glance-only, no labels. */}
            <div style={{ display: 'flex', gap: '3px', marginTop: '10px' }}>
              {[1, 2, 3, 4, 5].map(z => (
                <div key={z} style={{ flex: 1, height: '4px', borderRadius: '2px', background: z === 2 ? 'var(--s-easy)' : 'var(--bg-soft)' }} />
              ))}
            </div>

            {/* Primary CTA — the last element the crop MUST show (measured). */}
            <div style={{
              marginTop: '10px', width: '100%', padding: '14px', textAlign: 'center',
              borderRadius: 'var(--radius-md)', background: 'var(--moss)',
              color: 'var(--card)', fontSize: '14px', fontWeight: 600, letterSpacing: '0.02em',
            }}>Log this session</div>
          </div>

          {/* Bottom fade — 32px, sits in the gap BELOW the CTA, never over it */}
          <div style={{
            position: 'absolute', left: 0, right: 0, bottom: 0, height: '32px',
            background: 'linear-gradient(to bottom, rgba(243,240,235,0) 0%, var(--bg) 100%)',
          }} />
        </div>

        {/* ── Bottom nav — 60px, top hairline, four tabs, real icons ─────── */}
        <div style={{
          height: NAV_H, flexShrink: 0,
          borderTop: '0.5px solid var(--line-strong)',
          background: 'var(--card)',
          display: 'flex', alignItems: 'center',
        }}>
          <NavTab label="Today" active>
            <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
              <rect x="3" y="11" width="4" height="8" rx="1" fill="var(--moss)" />
              <rect x="9" y="7" width="4" height="12" rx="1" fill="var(--moss)" />
              <rect x="15" y="4" width="4" height="15" rx="1" fill="var(--moss)" />
            </svg>
          </NavTab>
          <NavTab label="Plan" active={false}>
            <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
              <rect x="3" y="3" width="16" height="16" rx="2" stroke="var(--mute)" strokeWidth="1.2" />
              <line x1="7" y1="1" x2="7" y2="5" stroke="var(--mute)" strokeWidth="1.2" strokeLinecap="round" />
              <line x1="15" y1="1" x2="15" y2="5" stroke="var(--mute)" strokeWidth="1.2" strokeLinecap="round" />
              <line x1="3" y1="8" x2="19" y2="8" stroke="var(--mute)" strokeWidth="1.2" />
            </svg>
          </NavTab>
          <NavTab label="Coach" active={false}>
            <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
              <circle cx="11" cy="8" r="3.5" stroke="var(--mute)" strokeWidth="1.2" />
              <path d="M4 19c0-3.866 3.134-7 7-7h.5c3.866 0 7 3.134 7 7" stroke="var(--mute)" strokeWidth="1.2" strokeLinecap="round" />
              <line x1="15" y1="4" x2="18" y2="1" stroke="var(--mute)" strokeWidth="1.2" strokeLinecap="round" />
              <line x1="16" y1="1" x2="18" y2="3" stroke="var(--mute)" strokeWidth="1.2" strokeLinecap="round" />
            </svg>
          </NavTab>
          <NavTab label="Me" active={false}>
            <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
              <circle cx="11" cy="8" r="3.5" stroke="var(--mute)" strokeWidth="1.2" />
              <path d="M4 19c0-3.866 3.134-7 7-7h.5c3.866 0 7 3.134 7 7" stroke="var(--mute)" strokeWidth="1.2" strokeLinecap="round" />
            </svg>
          </NavTab>
        </div>
      </div>
    </div>
  )
}
