'use client'

// DASHBOARD-SCREEN-EXTRACT-02 — lifted verbatim out of `DashboardClient.tsx`.
//
// It was a module-level function in a 14k-line file, so it closed over nothing and this
// move changes no behaviour. What it changes is REACH: nothing could import it, so it
// could not be rendered by a harness or a mounting test.
//
// ⚠️ The body is UNCHANGED. Edit it in a separate commit so the move stays a move.

import { ZONE_DEFS, calculateZones } from '@/components/dashboard/dashboardHelpers'
import SignOutLink from '@/components/shared/SignOutLink'
import type { Zone } from '@/components/shared/ZoneBar'
import { MICRO_LABELS } from '@/components/shared/microLabels'
import Button from '@/components/ui/Button'
import { Wordmark } from '@/components/ui/Wordmark'
import { BRAND } from '@/lib/brand'
import { daysUntilRace, formatDate, formatRaceCountdown } from '@/lib/format'
import { parseLocalDate } from '@/lib/plan'
import { getSessionColor, getSessionLabel } from '@/lib/session-types'
import type { Plan } from '@/types/plan'

export default function OrientationScreen({ plan, firstName, zone2Ceiling, restingHR, maxHR, onDismiss }: {
  plan: Plan; firstName: string; zone2Ceiling: number | null
  restingHR: number | null; maxHR: number | null
  onDismiss: () => void
}) {
  const raceName   = plan.meta.race_name || 'your race'
  const raceDate   = plan.meta.race_date ? new Date(plan.meta.race_date) : null
  const raceDateStr = raceDate ? formatDate(raceDate, 'long') : null
  const totalWeeks = plan.weeks.length
  const daysToRace = daysUntilRace(raceDate)

  // Find first upcoming non-rest session
  const DOW_KEYS = ['mon','tue','wed','thu','fri','sat','sun']
  const now = new Date(); now.setHours(0, 0, 0, 0)
  let firstSession: { day: string; label: string; type: string } | null = null
  for (const week of plan.weeks) {
    const wDate = parseLocalDate((week as any).date)
    for (const key of DOW_KEYS) {
      const s = (week as any).sessions?.[key]
      if (!s || s.type === 'rest') continue
      const d = new Date(wDate)
      d.setDate(d.getDate() + DOW_KEYS.indexOf(key))
      if (d >= now) {
        firstSession = {
          // `?? ''` — the owner returns null on an unparseable date where a
          // bare toLocaleDateString rendered the string "Invalid Date".
          day: formatDate(d, 'weekday-long') ?? '',
          label: s.label || getSessionLabel(s),
          type: s.type,
        }
        break
      }
    }
    if (firstSession) break
  }

  const accent = firstSession ? getSessionColor(firstSession) : 'var(--accent)'
  const greeting = firstName ? `${firstName}, your` : 'Your'

  return (
    <div style={{
      // Own scroll context: the dashboard body-lock (overflow:hidden;
      // position:fixed, set on mount) leaves this early-return screen with no
      // scrollable ancestor, so it must scroll itself — otherwise content
      // taller than the viewport clips the CTA off-screen and bricks onboarding.
      // 'safe center' keeps the layout centred when it fits, but falls back to
      // top-aligned + scrollable when it overflows.
      height: '100dvh', overflowY: 'auto',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'safe center',
      background: 'var(--bg)', maxWidth: '480px', margin: '0 auto',
      padding: '32px 24px calc(32px + env(safe-area-inset-bottom, 0px))',
    }}>
      {/* Brand mark — Wordmark component sources text from BRAND.name */}
      <div style={{ marginBottom: 'var(--space-2)' }}>
        <Wordmark size="md" />
      </div>
      <div style={{ ...MICRO_LABELS.eyebrow, fontFamily: 'var(--font-ui)', color: 'var(--text-muted)', marginBottom: '40px' }}>
        {BRAND.voiceAnchor}
      </div>

      <div style={{ width: '100%', maxWidth: '340px' }}>
        {/* Headline */}
        <div style={{ fontFamily: 'var(--font-brand)', fontSize: '24px', fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '-0.4px', lineHeight: 1.25, marginBottom: 'var(--space-2)' }}>
          {greeting} plan is set.
        </div>
        <div style={{ fontFamily: 'var(--font-ui)', fontSize: '13px', color: 'var(--text-muted)', lineHeight: 1.6, marginBottom: 'var(--space-6)' }}>
          {totalWeeks} weeks. One session at a time.
        </div>

        {/* Race card */}
        {(raceName || raceDateStr) && (
          <div style={{ background: 'var(--card-bg)', borderRadius: '14px', border: '0.5px solid var(--border-col)', padding: '16px', marginBottom: 'var(--space-3)' }}>
            <div style={{ ...MICRO_LABELS.eyebrow, fontFamily: 'var(--font-ui)', color: 'var(--text-muted)', marginBottom: 'var(--space-2)' }}>Goal race</div>
            <div style={{ fontFamily: 'var(--font-brand)', fontSize: '17px', fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.2 }}>{raceName}</div>
            {raceDateStr && (
              <div style={{ fontFamily: 'var(--font-ui)', fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
                {raceDateStr}{daysToRace !== null && daysToRace > 0 ? ` · ${formatRaceCountdown(daysToRace)}` : ''}
              </div>
            )}
          </div>
        )}

        {/* First session card */}
        {firstSession && (
          <div style={{ background: 'var(--card-bg)', borderRadius: '14px', border: `0.5px solid var(--border-col)`, borderLeft: `4px solid ${accent}`, padding: '14px 16px', marginBottom: 'var(--space-3)' }}>
            <div style={{ ...MICRO_LABELS.eyebrow, fontFamily: 'var(--font-ui)', color: accent, marginBottom: '4px' }}>First session</div>
            <div style={{ fontFamily: 'var(--font-brand)', fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.2 }}>{firstSession.label}</div>
            <div style={{ fontFamily: 'var(--font-ui)', fontSize: '12px', color: 'var(--text-muted)', marginTop: '3px' }}>{firstSession.day}</div>
          </div>
        )}

        {/* ── ZONE INTRO ──────────────────────────────────────────────
            First visible use of "Hold the zone" anywhere in the product UI.
            Shows the full 5-zone system at the moment the user just got
            their plan — the moment they're most receptive to the framework
            the plan operates in. HR ranges from calculateZones() when HR
            data is set, otherwise zone names only (still useful). */}
        {(() => {
          const haveHR = restingHR != null && maxHR != null && maxHR > restingHR
          const zones = haveHR ? calculateZones(restingHR!, maxHR!) : null
          return (
            <>
              {/* Hold the zone eyebrow */}
              <div style={{
                display: 'flex', alignItems: 'center', gap: 'var(--space-2)',
                marginBottom: 'var(--space-2)',
              }}>
                <span style={{
                  width: '6px', height: '6px', borderRadius: '50%',
                  background: 'var(--moss)',
                  animation: 'ai-mark-pulse 2s ease-in-out infinite',
                }} />
                <span style={{
                  fontFamily: 'var(--font-ui)', fontSize: '11px', fontWeight: 700,
                  color: 'var(--moss)',
                  letterSpacing: '0.14em', textTransform: 'uppercase',
                }}>Hold the zone</span>
              </div>

              {/* Headline */}
              <div style={{
                fontFamily: 'var(--font-ui)', fontSize: '24px', fontWeight: 800,
                color: 'var(--ink)', letterSpacing: '-0.025em', lineHeight: 1.1,
                marginBottom: 'var(--space-2)',
              }}>
                These are <span style={{ color: 'var(--moss)' }}>your zones.</span>
              </div>
              <div style={{
                fontFamily: 'var(--font-ui)', fontSize: '13px',
                color: 'var(--mute)', lineHeight: 1.55, marginBottom: 'var(--space-4)',
              }}>
                Every session tells you which one. Hold the line. That&apos;s the whole job.
              </div>

              {/* Zone list — 5 rows */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', marginBottom: 'var(--space-5)' }}>
                {ZONE_DEFS.map(z => {
                  const isHome = z.zone === 2
                  const hr = zones?.find(zz => zz.zone === z.zone)
                  return (
                    <div key={z.zone} style={{
                      // ⚠️ A FIXED THIRD TRACK, NOT `auto` (founder, device review
                      // 2026-09-25: the zones "are all over the place"). Each row
                      // is its OWN grid, so `auto` sized the HR column to that
                      // row's content — `128–142` against `—` against a 2-digit
                      // value — and the numbers started at a different x on every
                      // line while the description column changed width to match.
                      // `tabular-nums` aligns digits WITHIN a cell; it cannot
                      // align cells ACROSS independent grids. 72px holds the
                      // widest real value at 13px with room to spare.
                      display: 'grid', gridTemplateColumns: '32px 1fr 72px',
                      gap: 'var(--space-3)', alignItems: 'center',
                      padding: '11px 13px',
                      background: 'var(--card)', border: '1px solid var(--line)',
                      borderLeft: isHome ? `3px solid ${z.colour}` : '1px solid var(--line)',
                      paddingLeft: isHome ? '11px' : '13px',
                      borderRadius: 'var(--radius-md)',
                    }}>
                      {/* Zone number badge */}
                      <div style={{
                        width: '32px', height: '32px', borderRadius: '50%',
                        background: z.colour,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontFamily: 'var(--font-ui)', fontSize: '12px', fontWeight: 800,
                        color: 'var(--card)', flexShrink: 0,
                      }}>{z.zone}</div>
                      {/* Name + description */}
                      <div style={{ minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                          <div style={{
                            fontFamily: 'var(--font-ui)', fontSize: '14px', fontWeight: 600,
                            color: 'var(--ink)', letterSpacing: '-0.005em',
                          }}>{z.name}</div>
                          {isHome && (
                            <span style={{
                              fontFamily: 'var(--font-ui)', fontSize: '9px', fontWeight: 700,
                              color: 'var(--moss)', background: 'var(--moss-soft)',
                              padding: '2px 6px', borderRadius: '3px',
                              letterSpacing: '0.08em', textTransform: 'uppercase',
                            }}>Your home</span>
                          )}
                        </div>
                        <div style={{
                          fontFamily: 'var(--font-ui)', fontSize: '11px',
                          color: 'var(--mute)', marginTop: '2px',
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        }}>{z.desc}</div>
                      </div>
                      {/* HR range or em-dash if no HR data */}
                      <div style={{
                        fontFamily: 'var(--font-ui)', fontSize: '13px', fontWeight: 600,
                        color: z.colour, fontVariantNumeric: 'tabular-nums',
                        textAlign: 'right', whiteSpace: 'nowrap',
                      }}>
                        {hr ? `${hr.minHR}–${hr.maxHR}` : '—'}
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* The whole job callout — brand position in two sentences */}
              <div style={{
                background: 'var(--moss-soft)',
                border: '1px solid var(--moss-mid)',
                borderRadius: 'var(--radius-md)',
                padding: '12px 14px',
                marginBottom: 'var(--space-5)',
              }}>
                <div style={{ ...MICRO_LABELS.eyebrow, fontFamily: 'var(--font-ui)',
                  color: 'var(--moss)',
                  marginBottom: '4px' }}>The whole job</div>
                <div style={{
                  fontFamily: 'var(--font-ui)', fontSize: '13px',
                  color: 'var(--ink)', lineHeight: 1.5,
                }}>
                  Easy when it&apos;s easy. Hard when it&apos;s hard. The grey middle is where amateurs go to stall, and where most of your improvement is hiding.
                </div>
              </div>

              {/* Zone-method disclosure — honest about how these were derived.
                  plan.meta.hr_zone_method is always written by the rule engine. */}
              {(() => {
                const method = (plan?.meta as any)?.hr_zone_method as string | undefined
                const note   = (plan?.meta as any)?.hr_assumption_note as string | undefined
                let msg: string | null = null
                if (!method || method === 'karvonen') {
                  // Karvonen: real data used — no disclaimer needed, but confirm it.
                  if (haveHR) msg = 'Zones personalised from your heart rate data.'
                } else if (method === 'karvonen_estimated_max') {
                  msg = 'Resting HR used. Max HR estimated from age. Add your measured max in Profile to refine.'
                } else if (method === 'percent_of_max') {
                  msg = 'Max HR used. Add your resting HR in Profile for more accurate zones.'
                } else {
                  // percent_of_estimated_max — no HR data at all
                  msg = note ?? 'Zones estimated from age: no HR data available. Add values in Profile, or connect Apple Health, to personalise.'
                }
                if (!msg) return null
                return (
                  <div style={{
                    fontFamily: 'var(--font-ui)', fontSize: '11px',
                    color: 'var(--mute)', lineHeight: 1.55,
                    marginBottom: 'var(--space-4)', textAlign: 'center',
                  }}>
                    {msg}
                  </div>
                )
              })()}
              {/* If HR isn't set at all, also prompt them to add values */}
              {!haveHR && !(plan?.meta as any)?.hr_zone_method && (
                <div style={{
                  fontFamily: 'var(--font-ui)', fontSize: '12px',
                  color: 'var(--mute)', lineHeight: 1.55,
                  marginBottom: 'var(--space-4)', textAlign: 'center',
                }}>
                  Add your resting + max HR in Profile to see your personal ranges.
                </div>
              )}
            </>
          )
        })()}

        {/* CTA */}
        <Button variant="primary" fullWidth
          onClick={onDismiss}>
          I&apos;m ready
        </Button>

        {/* ONBOARD-EXIT-01 — Orientation renders in front of the nav, so the
            Me screen (where sign-out lives) is unreachable from here. */}
        <SignOutLink />
      </div>
    </div>
  )
}
